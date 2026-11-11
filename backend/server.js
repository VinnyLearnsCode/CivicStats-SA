import { createReadStream } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createDataStore, DataStoreError } from "./data-store.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const webRoot = resolve(root, "frontend");
const geoRoot = resolve(webRoot, "assets", "geojson");
const censusDataRoot = resolve(webRoot, "assets", "data");
const treasuryApiRoot = "https://municipaldata.treasury.gov.za/api";
const citiesNetworkApiRoot = "https://sacities.net/wp-json/wp/v2";
const nasaPowerApiRoot = "https://power.larc.nasa.gov/api";
const worldBankApiRoot = "https://api.worldbank.org/v2";
const providerCacheTtlMs = 5 * 60 * 1000;
const earthRadiusKm = 6371.0088;
const levelFiles = new Map([
  ["ADM1", "south-africa-adm1.geojson"],
  ["ADM2", "south-africa-adm2.geojson"],
  ["ADM3", "south-africa-adm3.geojson"]
]);
const provinceCodes = new Map([
  ["EC", "Eastern Cape"],
  ["FS", "Free State"],
  ["GP", "Gauteng"],
  ["KZN", "KwaZulu-Natal"],
  ["LP", "Limpopo"],
  ["MP", "Mpumalanga"],
  ["NC", "Northern Cape"],
  ["NW", "North West"],
  ["WC", "Western Cape"]
]);
const censusBoundaryCodes = new Map([
  ["greater tubatse/fetakgomo", "LIM476"],
  ["kai garib", "NC082"],
  ["khai-ma", "NC067"],
  ["kheis", "NC084"],
  ["mafikeng", "NW383"],
  ["mbizana", "EC443"],
  ["mbombela", "MP326"],
  ["modimolle/mookgophong", "LIM368"],
  ["sol plaatjie", "NC091"],
  ["ventersdorp/tlokwe", "NW405"]
]);

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function jsonResponse(response, status, value) {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(value));
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.length > 0 &&
      pointInRing(point, geometry.coordinates[0]) &&
      !geometry.coordinates.slice(1).some((ring) => pointInRing(point, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      polygon.length > 0 &&
      pointInRing(point, polygon[0]) &&
      !polygon.slice(1).some((ring) => pointInRing(point, ring))
    );
  }
  return false;
}

function representativePoint(feature) {
  const coordinates = [];
  const collect = (value) => {
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      coordinates.push(value);
      return;
    }
    value.forEach(collect);
  };
  collect(feature.geometry.coordinates);
  if (!coordinates.length) return null;

  const bounds = coordinates.reduce(
    (box, [longitude, latitude]) => ({
      minX: Math.min(box.minX, longitude),
      maxX: Math.max(box.maxX, longitude),
      minY: Math.min(box.minY, latitude),
      maxY: Math.max(box.maxY, latitude)
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
  for (const divisions of [12, 24, 48]) {
    for (let row = 1; row < divisions; row += 1) {
      for (let column = 1; column < divisions; column += 1) {
        const point = [
          bounds.minX + ((bounds.maxX - bounds.minX) * column) / divisions,
          bounds.minY + ((bounds.maxY - bounds.minY) * row) / divisions
        ];
        if (pointInGeometry(point, feature.geometry)) return point;
      }
    }
  }
  return coordinates[0];
}

function ringAreaKm2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [longitude1, latitude1] = ring[index];
    const [longitude2, latitude2] = ring[(index + 1) % ring.length];
    const latitude1Radians = (latitude1 * Math.PI) / 180;
    const latitude2Radians = (latitude2 * Math.PI) / 180;
    const longitudeDeltaRadians = ((longitude2 - longitude1) * Math.PI) / 180;
    area += longitudeDeltaRadians *
      (2 + Math.sin(latitude1Radians) + Math.sin(latitude2Radians));
  }
  return Math.abs((area * earthRadiusKm ** 2) / 2);
}

function polygonAreaKm2(rings) {
  if (!Array.isArray(rings) || !rings.length) return 0;
  return Math.max(
    0,
    ringAreaKm2(rings[0]) - rings.slice(1).reduce((total, ring) => total + ringAreaKm2(ring), 0)
  );
}

function geometryAreaKm2(geometry) {
  if (!geometry) return null;
  let area;
  if (geometry.type === "Polygon") {
    area = polygonAreaKm2(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    area = geometry.coordinates.reduce((total, polygon) => total + polygonAreaKm2(polygon), 0);
  } else {
    return null;
  }
  return Number.isFinite(area) && area > 0 ? Number(area.toFixed(1)) : null;
}

async function loadBoundaries() {
  const entries = await Promise.all(
    [...levelFiles].map(async ([level, filename]) => {
      const contents = await readFile(resolve(geoRoot, filename), "utf8");
      const collection = JSON.parse(contents);
      if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
        throw new Error(`Invalid ${level} boundary GeoJSON`);
      }
      return [level, collection];
    })
  );
  return new Map(entries);
}

function parseCsv(text, filename) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const contents = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error(`Census dataset ${filename} contains an unterminated quoted field.`);
  if (field !== "" || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (rows.length < 2) throw new Error(`Census dataset ${filename} has no data rows.`);

  const headers = rows[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error(`Census dataset ${filename} has invalid or duplicate columns.`);
  }
  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`Census dataset ${filename} row ${index + 2} has an unexpected number of columns.`);
    }
    return Object.fromEntries(headers.map((header, column) => {
      const value = values[column].trim();
      const parsed = value === "" ? null : Number(value);
      return [header, value !== "" && Number.isFinite(parsed) ? parsed : value];
    }));
  });
}

function normalizeCensusName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/\b(local|district|metropolitan)?\s*municipality\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalProvinceName(value) {
  return normalizeCensusName(value) === "nothern cape" ? "Northern Cape" : value;
}

async function loadCensusMunicipalities() {
  const filenames = {
    people: "person-indicators-muni.csv",
    age: "age-distribution-muni.csv",
    housing: "housing-info-muni.csv"
  };
  const datasets = await Promise.all(Object.entries(filenames).map(async ([name, filename]) => {
    const contents = await readFile(resolve(censusDataRoot, filename), "utf8");
    return [name, parseCsv(contents, filename)];
  }));
  const datasetsByName = new Map(datasets);
  const people = datasetsByName.get("people");
  const ages = datasetsByName.get("age");
  const housing = datasetsByName.get("housing");
  const uniqueByCode = (records, filename) => {
    const result = new Map();
    records.forEach((record) => {
      const code = record.muni_code;
      if (typeof code !== "string" || !code || result.has(code)) {
        throw new Error(`Census dataset ${filename} contains a missing or duplicate municipality code.`);
      }
      result.set(code, record);
    });
    return result;
  };
  const peopleByCode = uniqueByCode(people, filenames.people);
  const agesByCode = uniqueByCode(ages, filenames.age);
  const housingByCode = uniqueByCode(housing, filenames.housing);

  if (peopleByCode.size !== 213 || agesByCode.size !== 213 || housingByCode.size !== 213) {
    throw new Error("Census 2022 municipal datasets must each contain all 213 municipality records.");
  }

  return people.map((record) => {
    const code = record.muni_code;
    const ageRecord = agesByCode.get(code);
    const housingRecord = housingByCode.get(code);
    if (!ageRecord || !housingRecord ||
      ageRecord.name !== record.name || housingRecord.name !== record.name ||
      ageRecord.prov_code !== record.prov_code || housingRecord.prov_code !== record.prov_code) {
      throw new Error(`Census datasets disagree for municipality code ${code}.`);
    }
    return {
      ...record,
      ...Object.fromEntries(Object.entries(ageRecord).filter(([key]) =>
        !["prov_code", "dc_code", "muni_code", "name"].includes(key)
      )),
      ...Object.fromEntries(Object.entries(housingRecord).filter(([key]) =>
        !["prov_code", "dc_code", "muni_code", "name"].includes(key)
      ))
    };
  });
}

async function loadElectricityLighting() {
  const filename = "electricity-lighting-muni.csv";
  const contents = await readFile(resolve(censusDataRoot, filename), "utf8");
  const records = parseCsv(contents, filename);
  const byCode = new Map();
  for (const record of records) {
    const code = record.muni_code;
    if (typeof code !== "string" || !code || byCode.has(code) ||
      typeof record.name !== "string" ||
      ![record.electricity_lighting_share_2011, record.electricity_lighting_share_2022]
        .every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      throw new Error(`Stats SA electricity-lighting dataset ${filename} contains an invalid or duplicate record.`);
    }
    byCode.set(code, {
      name: record.name,
      share2011: record.electricity_lighting_share_2011,
      share2022: record.electricity_lighting_share_2022
    });
  }
  if (byCode.size !== 213) {
    throw new Error("Stats SA electricity-lighting data must contain all 213 municipal records.");
  }
  return byCode;
}

async function loadProvincialGdpR() {
  const filename = "provincial-gdp-r.json";
  const dataset = JSON.parse(await readFile(resolve(censusDataRoot, filename), "utf8"));
  const expectedProvinces = new Set(provinceCodes.values());
  const years = Array.isArray(dataset.years) ? dataset.years : [];
  const records = Array.isArray(dataset.provinces) ? dataset.provinces : [];
  const metrics = [
    "gdpCurrentPricesRandMillions",
    "gdpContributionPercent",
    "gdpConstant2015PricesRandMillions",
    "realGdpGrowthPercent"
  ];
  const provinceNames = new Set(records.map((record) => record.province));
  if (dataset.source?.publisher !== "Statistics South Africa" ||
    dataset.source?.reportNumber !== "P0441.2" ||
    dataset.source?.geographyLevel !== "Province" ||
    !dataset.source?.url?.startsWith("https://") ||
    years.length !== 11 || years[0] !== 2014 || years.at(-1) !== 2024 ||
    new Set(years).size !== years.length ||
    records.length !== expectedProvinces.size ||
    provinceNames.size !== expectedProvinces.size ||
    [...expectedProvinces].some((province) => !provinceNames.has(province))) {
    throw new Error("Stats SA provincial GDP-R data is missing source metadata or complete 2014–2024 provincial coverage.");
  }
  for (const record of records) {
    for (const metric of metrics) {
      const values = record[metric];
      if (!values || years.some((year) => !Number.isFinite(values[String(year)]))) {
        throw new Error(`Stats SA GDP-R data has an incomplete ${metric} series for ${record.province}.`);
      }
    }
    const activities = record.industryGvaCurrentPricesRandMillions;
    if (!activities || Object.keys(activities).length === 0 ||
      Object.values(activities).some((values) =>
        years.some((year) => !Number.isFinite(values[String(year)])))) {
      throw new Error(`Stats SA GDP-R industry data is incomplete for ${record.province}.`);
    }
  }
  return dataset;
}

async function loadProvincialUnemployment() {
  const filename = "provincial-unemployment.json";
  const dataset = JSON.parse(await readFile(resolve(censusDataRoot, filename), "utf8"));
  const expectedProvinces = new Set(provinceCodes.values());
  const periods = Array.isArray(dataset.periods) ? dataset.periods : [];
  const records = Array.isArray(dataset.records) ? dataset.records : [];
  const periodCodes = new Set(periods.map((period) => period.code));
  const keys = new Set();
  if (!dataset.source?.publisher || !dataset.source?.title || !dataset.source?.sourceUrl ||
    periods.length === 0 || periodCodes.size !== periods.length ||
    records.length !== expectedProvinces.size * periods.length) {
    throw new Error("Provincial unemployment data is missing source metadata or complete province-period coverage.");
  }
  for (const record of records) {
    const key = `${record.quarter}:${record.province}`;
    if (!expectedProvinces.has(record.province) || !periodCodes.has(record.quarter) || keys.has(key) ||
      !Number.isFinite(record.officialRate) || record.officialRate < 0 || record.officialRate > 100 ||
      !Number.isFinite(record.lu3Rate) || record.lu3Rate < 0 || record.lu3Rate > 100) {
      throw new Error(`Provincial unemployment data contains an invalid or duplicate record: ${key}.`);
    }
    keys.add(key);
  }
  return dataset;
}

async function loadMunicipalCouncillors2021(censusMunicipalities) {
  const filename = "municipal-councillors-2021.json";
  const dataset = JSON.parse(await readFile(resolve(censusDataRoot, filename), "utf8"));
  const censusByCode = new Map(censusMunicipalities.map((record) => [record.muni_code, record]));
  const recordsByCode = new Map();
  if (dataset.source?.publisher !== "Electoral Commission of South Africa" ||
    dataset.source?.publishedDate !== "2021-11-20" ||
    !dataset.source?.url?.startsWith("https://") ||
    dataset.totalMunicipalities !== 213 ||
    !Array.isArray(dataset.records) ||
    dataset.records.length !== dataset.totalMunicipalities) {
    throw new Error("IEC elected-councillor data is missing provenance or complete 2021 municipal coverage.");
  }

  for (const record of dataset.records) {
    const censusRecord = censusByCode.get(record.municipalityCode);
    if (!censusRecord || recordsByCode.has(record.municipalityCode) ||
      record.municipality !== censusRecord.name ||
      record.province !== provinceCodes.get(censusRecord.prov_code) ||
      !Array.isArray(record.parties) || record.parties.length === 0) {
      throw new Error(`IEC 2021 councillor data has an invalid or duplicate municipality: ${record.municipalityCode}.`);
    }

    const partyNames = new Set();
    let totalSeats = 0;
    for (const party of record.parties) {
      const { name, wardSeats, proportionalRepresentationSeats, totalSeats: partySeats } = party;
      if (typeof name !== "string" || !name.trim() || partyNames.has(name) ||
        !Number.isSafeInteger(wardSeats) || wardSeats < 0 ||
        !Number.isSafeInteger(proportionalRepresentationSeats) || proportionalRepresentationSeats < 0 ||
        !Number.isSafeInteger(partySeats) ||
        partySeats !== wardSeats + proportionalRepresentationSeats || partySeats === 0) {
        throw new Error(`IEC 2021 councillor data has an invalid party-seat record for ${record.municipalityCode}.`);
      }
      partyNames.add(name);
      totalSeats += partySeats;
    }
    if (!Number.isSafeInteger(record.totalSeats) || record.totalSeats !== totalSeats) {
      throw new Error(`IEC 2021 councillor seat totals do not reconcile for ${record.municipalityCode}.`);
    }
    recordsByCode.set(record.municipalityCode, record);
  }

  if (recordsByCode.size !== censusByCode.size) {
    throw new Error("IEC 2021 councillor data must cover all 213 Census municipality codes.");
  }
  return { source: dataset.source, recordsByCode };
}

function safeMunicipality(feature, boundaries, censusRecords) {
  const point = representativePoint(feature);
  const findParent = (level) =>
    boundaries.get(level)?.features.find((candidate) =>
      point && pointInGeometry(point, candidate.geometry)
    ) ?? null;
  const provinceFeature = findParent("ADM1");
  const districtFeature = findParent("ADM2");
  const municipality = {
    id: feature.properties.shapeID,
    name: feature.properties.shapeName,
    level: feature.properties.shapeType,
    province: canonicalProvinceName(provinceFeature?.properties.shapeName ?? null),
    provinceId: provinceFeature?.properties.shapeID ?? null,
    district: districtFeature?.properties.shapeName ?? null,
    districtId: districtFeature?.properties.shapeID ?? null,
    areaKm2: geometryAreaKm2(feature.geometry),
    areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon."
  };
  const censusRecord = findCensusMunicipality(municipality, censusRecords);

  return {
    ...municipality,
    officialCode: censusRecord?.muni_code ?? null,
    category: municipality.district === municipality.name
      ? "Category A · Metropolitan municipality"
      : "Category B · Local municipality"
  };
}

function safeGeography(feature, boundaries, municipalities, metropolitanNames) {
  const { shapeID: id, shapeName: rawName, shapeType: level } = feature.properties;
  const name = level === "ADM1" ? canonicalProvinceName(rawName) : rawName;
  if (level === "ADM3") return municipalities.find((item) => item.id === id);

  const point = representativePoint(feature);
  const province = level === "ADM1"
    ? feature
    : boundaries.get("ADM1")?.features.find((candidate) =>
      point && pointInGeometry(point, candidate.geometry)
    );
  const isMetropolitan = metropolitanNames.has(name);
  return {
    id,
    name,
    level,
    province: canonicalProvinceName(province?.properties.shapeName ?? null),
    provinceId: level === "ADM1" ? id : province?.properties.shapeID ?? null,
    district: level === "ADM2" ? name : null,
    districtId: level === "ADM2" ? id : null,
    areaKm2: geometryAreaKm2(feature.geometry),
    areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon.",
    category: level === "ADM1"
      ? "Province"
      : isMetropolitan
        ? "Category A · Metropolitan municipality"
        : "Category C · District municipality",
    officialCode: null
  };
}

function findCensusMunicipality(municipality, censusRecords) {
  if (municipality.level !== "ADM3") return null;
  const boundaryName = normalizeCensusName(municipality.name);
  const code = censusBoundaryCodes.get(boundaryName);
  if (code) return censusRecords.find((record) => record.muni_code === code) ?? null;

  const provinceCode = [...provinceCodes].find(([, province]) =>
    normalizeCensusName(province) === normalizeCensusName(municipality.province)
  )?.[0];
  if (!provinceCode) return null;
  const matches = censusRecords.filter((record) =>
    record.prov_code === provinceCode &&
    normalizeCensusName(record.name) === boundaryName
  );
  if (matches.length > 1) {
    throw new Error("More than one Census municipality matches this boundary. No record was selected.");
  }
  return matches[0] ?? null;
}

function buildBasicServicesPilotScore(record, year, electricityRecord) {
  if (!record || year !== 2022 || !electricityRecord) return null;
  const households = record.households_2022;
  const waterSchemeHouseholds = record.water_scheme_2022;
  const flushToiletHouseholds = record.flush_toilet_2022;
  if (!Number.isFinite(households) || households <= 0 ||
    !Number.isFinite(waterSchemeHouseholds) || waterSchemeHouseholds < 0 || waterSchemeHouseholds > households ||
    !Number.isFinite(flushToiletHouseholds) || flushToiletHouseholds < 0 || flushToiletHouseholds > households ||
    !Number.isFinite(electricityRecord.share2022) || electricityRecord.share2022 < 0 || electricityRecord.share2022 > 100) {
    return null;
  }
  const components = [
    {
      id: "water-scheme-households",
      label: "Households reporting a water-scheme source",
      value: Number(((waterSchemeHouseholds / households) * 100).toFixed(2)),
      unit: "% of households",
      source: "Stats SA Census 2022"
    },
    {
      id: "flush-toilet-households",
      label: "Households reporting a flush toilet",
      value: Number(((flushToiletHouseholds / households) * 100).toFixed(2)),
      unit: "% of households",
      source: "Stats SA Census 2022"
    },
    {
      id: "electricity-main-lighting",
      label: "Households reporting electricity as main lighting source",
      value: electricityRecord.share2022,
      unit: "% of households",
      source: "Stats SA Census 2022 Municipal fact sheet"
    }
  ];
  return {
    name: "Basic services pilot",
    score: Number((components.reduce((sum, component) => sum + component.value, 0) / components.length).toFixed(1)),
    scale: 100,
    year: 2022,
    method: "Equal-weighted arithmetic mean of the three displayed household shares. All three verified Census 2022 values are required; missing inputs are never treated as zero.",
    limitation: "This is a household service-access pilot, not a complete municipal performance rating. Census responses describe 2022 conditions and do not measure current service quality, continuity or council responsibility.",
    components
  };
}

function normalizeMunicipalityName(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function providerErrorMessage(error) {
  return error instanceof Error ? error.message : "The data provider request failed.";
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function hashValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

class RequestBodyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

async function readJsonBody(request, maximumBytes = 8192) {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLocaleLowerCase();
  if (contentType !== "application/json") {
    throw new RequestBodyError("Content-Type must be application/json.", 415);
  }
  const declaredBytes = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
    throw new RequestBodyError("Request body is too large.", 413);
  }
  const chunks = [];
  let bytes = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBytes) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    if (!tooLarge) chunks.push(chunk);
  }
  if (tooLarge) throw new RequestBodyError("Request body is too large.", 413);
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestBodyError("Request body must contain valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError("Request body must be a JSON object.");
  }
  return value;
}

function isAuthorizedAdmin(request, adminToken) {
  const authorization = request.headers.authorization;
  if (!adminToken || typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(adminToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function requireAdmin(request, response, adminToken, adminRequests) {
  if (!adminToken) {
    jsonResponse(response, 503, {
      error: "Administrative access is not configured.",
      code: "ADMIN_NOT_CONFIGURED"
    });
    return false;
  }
  const now = Date.now();
  const address = request.socket.remoteAddress ?? "unknown";
  const previous = adminRequests.get(address);
  if (!previous || now - previous.startedAt >= 15 * 60 * 1000) {
    if (adminRequests.size >= 1000) {
      for (const [key, requestWindow] of adminRequests) {
        if (now - requestWindow.startedAt >= 15 * 60 * 1000) adminRequests.delete(key);
      }
      if (adminRequests.size >= 1000) adminRequests.delete(adminRequests.keys().next().value);
    }
    adminRequests.set(address, { startedAt: now, count: 1 });
  } else if (previous.count >= 60) {
    response.setHeader("retry-after", "900");
    jsonResponse(response, 429, {
      error: "Too many administrative requests. Try again later.",
      code: "ADMIN_RATE_LIMITED"
    });
    return false;
  } else {
    previous.count += 1;
  }
  if (!isAuthorizedAdmin(request, adminToken)) {
    response.setHeader("www-authenticate", "Bearer");
    jsonResponse(response, 401, {
      error: "Administrator authentication is required.",
      code: "ADMIN_AUTH_REQUIRED"
    });
    return false;
  }
  return true;
}

function treasuryImportMetadata(municipality, year) {
  return {
    sourceId: "national-treasury",
    sourceName: "National Treasury · Municipal Money",
    sourceUrl: "https://municipaldata.treasury.gov.za/",
    datasetId: "national-treasury-municipal-finance",
    datasetTitle: "Municipal finance facts",
    datasetUrl: "https://municipaldata.treasury.gov.za/docs",
    municipalityCode: municipality.officialCode,
    municipalityName: municipality.name,
    provinceName: municipality.province,
    sourceCode: municipality.officialCode,
    reportingPeriod: String(year),
    unit: "ZAR",
    updateFrequency: "Check weekly; import only when source data changes",
    apiUrl: null,
    records: [],
    issues: []
  };
}

function createProviderClient(fetchImpl) {
  const cache = new Map();

  async function getJson(url, { timeoutMs = 15000 } = {}) {
    const key = url.toString();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < providerCacheTtlMs) return cached.value;

    const response = await fetchImpl(key, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const value = await response.json();
    if (value?.error || value?.status === "error") {
      throw new Error("Provider returned an error response.");
    }
    cache.set(key, { value, fetchedAt: Date.now() });
    return value;
  }

  async function getText(url) {
    const key = url.toString();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < providerCacheTtlMs) return cached.value;

    const response = await fetchImpl(key, {
      headers: { accept: "text/html,application/xml,text/xml" },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const value = await response.text();
    cache.set(key, { value, fetchedAt: Date.now() });
    return value;
  }

  return { getJson, getText };
}

function treasuryMemberName(record) {
  return record["municipality.name"] ||
    record["municipality.long_name"]?.split(",")[0]?.trim() ||
    "";
}

function matchTreasuryMunicipality(boundaryMunicipality, records) {
  const boundaryName = normalizeMunicipalityName(boundaryMunicipality.name);
  const boundaryProvince = normalizeMunicipalityName(boundaryMunicipality.province);
  const matches = records.filter((record) =>
    normalizeMunicipalityName(treasuryMemberName(record)) === boundaryName &&
    normalizeMunicipalityName(record["municipality.province_name"]) === boundaryProvince
  );
  if (matches.length > 1) {
    throw new Error("More than one Treasury municipality matches this boundary. No record was selected.");
  }
  return matches[0] ?? null;
}

function safePublicHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || !url.hostname.includes(".") ||
      isIP(url.hostname) || url.hostname.toLocaleLowerCase().endsWith(".localhost") ||
      url.hostname.toLocaleLowerCase().endsWith(".local")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeTreasuryReportUrl(value) {
  const url = safePublicHttpUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname.toLocaleLowerCase();
  return ["lg.treasury.gov.za", "mfma.treasury.gov.za", "treasury.gov.za"].includes(hostname)
    ? url
    : null;
}

function safeCitiesNetworkPublications(posts) {
  if (!Array.isArray(posts)) throw new Error("The South African Cities Network returned an unexpected response.");
  return posts.flatMap((post) => {
    let url;
    try {
      url = new URL(post.link);
    } catch {
      return [];
    }
    if (url.protocol !== "https:" || url.hostname !== "sacities.net") return [];
    return [{
      id: post.id,
      date: post.date,
      url: url.toString(),
      title: String(post.title?.rendered ?? "").replace(/<[^>]*>/g, "").trim(),
      summary: String(post.excerpt?.rendered ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    }];
  });
}

function validateProviderCollection(value, name) {
  if (!value || value.status !== "ok" || !Array.isArray(value.data)) {
    throw new Error(`${name} returned an unexpected response.`);
  }
  return value;
}

function localSourceStatus(source, status, detail, checkedAt) {
  return {
    id: source.id,
    name: source.name,
    status,
    detail,
    url: source.url,
    ...(source.portalUrl ? { portalUrl: source.portalUrl } : {}),
    ...(source.apiUrl ? { apiUrl: source.apiUrl } : {}),
    checkedAt
  };
}

async function checkExternalPortal(getText, url) {
  const response = await getText(new URL(url));
  return response.length > 0;
}

function configureLocalCors(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return;
  }
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(parsedOrigin.hostname);
  if (parsedOrigin.protocol === "http:" && localHost && parsedOrigin.port === "5500") {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-methods", "GET, OPTIONS");
    response.setHeader("access-control-allow-headers", "Accept");
  }
}

async function loadTreasuryMembers(providerClient) {
  const endpoint = new URL(`${treasuryApiRoot}/cubes/municipalities/members/municipality`);
  endpoint.searchParams.set("pagesize", "1000");
  const response = await providerClient.getJson(endpoint);
  if (!Array.isArray(response.data)) throw new Error("National Treasury returned an invalid municipality directory.");
  return response.data;
}

async function loadTreasuryCubeList(providerClient) {
  const response = await providerClient.getJson(new URL(`${treasuryApiRoot}/cubes`));
  return validateProviderCollection(response, "National Treasury");
}

async function loadTreasuryAggregate(providerClient, cube, demarcationCode, year, drilldown) {
  const endpoint = new URL(`${treasuryApiRoot}/cubes/${cube}/aggregate`);
  endpoint.searchParams.set("drilldown", drilldown);
  endpoint.searchParams.set(
    "cut",
    `demarcation.code:"${demarcationCode}"|financial_year_end.year:${year}|financial_period.period:${year}|period_length.length:"year"`
  );
  endpoint.searchParams.set("aggregates", "amount.sum");
  endpoint.searchParams.set("pagesize", "10000");
  const response = await providerClient.getJson(endpoint);
  if (response.status !== "ok" || !Array.isArray(response.cells)) {
    throw new Error(`National Treasury returned an invalid ${cube} response.`);
  }
  return {
    rows: response.cells,
    totalRecords: response.total_cell_count ?? response.cells.length,
    sourceUrl: endpoint.toString()
  };
}

async function loadTreasuryUifw(providerClient, demarcationCode, year) {
  const endpoint = new URL(`${treasuryApiRoot}/cubes/uifwexp/facts`);
  endpoint.searchParams.set(
    "cut",
    `demarcation.code:"${demarcationCode}"|financial_year_end.year:${year}`
  );
  endpoint.searchParams.set("pagesize", "10000");
  const response = await providerClient.getJson(endpoint);
  if (!Array.isArray(response.data)) {
    throw new Error("National Treasury returned an invalid UIFW expenditure response.");
  }
  const rows = response.data.filter((record) =>
    record["demarcation.code"] === demarcationCode &&
    record["financial_year_end.year"] === year
  );
  return {
    rows,
    totalRecords: response.total_fact_count ?? rows.length,
    sourceUrl: endpoint.toString()
  };
}

async function loadTreasurySupplemental(providerClient, demarcationCode, year) {
  const queries = [
    ["financialPosition", "financial_position_v2",
      "demarcation.code|demarcation.label|financial_year_end.year|item.code|item.label|amount_type.code|amount_type.label"],
    ["capital", "capital_v2",
      "demarcation.code|demarcation.label|financial_year_end.year|function.code|function.label|item.code|item.label|capital_type.code|capital_type.label|amount_type.code|amount_type.label"],
    ["grants", "grants_v2",
      "demarcation.code|demarcation.label|financial_year_end.year|grant.code|grant.label|amount_type.code|amount_type.label"],
    ["repairsMaintenance", "repmaint_v2",
      "demarcation.code|demarcation.label|financial_year_end.year|item.code|item.label|amount_type.code|amount_type.label"]
  ];
  const results = await Promise.allSettled([
    ...queries.map(([, cube, drilldown]) =>
      loadTreasuryAggregate(providerClient, cube, demarcationCode, year, drilldown)
    ),
    loadTreasuryUifw(providerClient, demarcationCode, year)
  ]);
  const output = {};
  queries.forEach(([key], index) => {
    const result = results[index];
    output[key] = result.status === "fulfilled"
      ? result.value
      : { rows: [], totalRecords: 0, sourceUrl: null, error: providerErrorMessage(result.reason) };
  });
  const uifwResult = results.at(-1);
  output.uifw = uifwResult.status === "fulfilled"
    ? uifwResult.value
    : { rows: [], totalRecords: 0, sourceUrl: null, error: providerErrorMessage(uifwResult.reason) };
  return output;
}

async function loadTreasuryFacts(providerClient, municipality, year) {
  const members = await loadTreasuryMembers(providerClient);
  const member = matchTreasuryMunicipality(municipality, members);
  if (!member) {
    return {
      municipality,
      year,
      source: "National Treasury · Municipal Money",
      sourceUrl: "https://municipaldata.treasury.gov.za/",
      treasuryMunicipality: null,
      rows: [],
      totalRecords: 0,
      supplemental: {},
      checkedAt: new Date().toISOString()
    };
  }

  const demarcationCode = member["municipality.demarcation_code"];
  const [incomeAndExpenditure, supplemental] = await Promise.all([
    loadTreasuryAggregate(
      providerClient,
      "incexp_v2",
      demarcationCode,
      year,
      "demarcation.code|demarcation.label|financial_year_end.year|function.code|function.label|item.code|item.label|amount_type.code|amount_type.label"
    ),
    loadTreasurySupplemental(providerClient, demarcationCode, year)
  ]);
  return {
    municipality,
    year,
    source: "National Treasury · Municipal Money",
    sourceUrl: incomeAndExpenditure.sourceUrl,
    treasuryMunicipality: {
      code: demarcationCode,
      name: member["municipality.name"]
    },
    rows: incomeAndExpenditure.rows,
    totalRecords: incomeAndExpenditure.totalRecords,
    supplemental,
    checkedAt: new Date().toISOString()
  };
}

function buildTreasuryImport(municipality, year, facts) {
  const input = treasuryImportMetadata(municipality, year);
  input.sourceCode = facts.treasuryMunicipality?.code ?? "unmatched";
  input.apiUrl = facts.sourceUrl ?? null;
  const groups = [
    ["income_expenditure", { rows: facts.rows, sourceUrl: facts.sourceUrl }],
    ...Object.entries(facts.supplemental ?? {})
  ];

  if (!facts.treasuryMunicipality) {
    input.issues.push({
      severity: "error",
      code: "TREASURY_MUNICIPALITY_NOT_MATCHED",
      message: "No Treasury municipality matched the selected municipality and province."
    });
  }
  if (facts.year !== year) {
    input.issues.push({
      severity: "error",
      code: "REPORTING_PERIOD_MISMATCH",
      message: "Treasury returned a different financial reporting year."
    });
  }

  let sourceRows = 0;
  const seenRecords = new Set();
  for (const [category, section] of groups) {
    if (section?.error) {
      input.issues.push({
        severity: "warning",
        code: "SOURCE_SECTION_UNAVAILABLE",
        message: `${category}: ${section.error}`
      });
      continue;
    }
    if (!Array.isArray(section?.rows)) {
      input.issues.push({
        severity: "error",
        code: "INVALID_SOURCE_SECTION",
        message: `${category} did not contain a valid records collection.`
      });
      continue;
    }
    sourceRows += section.rows.length;
    section.rows.forEach((sourceRecord, index) => {
      if (!sourceRecord || typeof sourceRecord !== "object" || Array.isArray(sourceRecord)) {
        input.issues.push({
          severity: "error",
          code: "INVALID_SOURCE_RECORD",
          message: `${category} contains a record that is not an object.`
        });
        return;
      }
      const sourceCode = sourceRecord["demarcation.code"];
      if (sourceCode != null && sourceCode !== input.sourceCode) {
        input.issues.push({
          severity: "error",
          code: "RECORD_GEOGRAPHY_MISMATCH",
          message: `${category} contains a record for a different Treasury municipality.`
        });
        return;
      }
      const recordYear = sourceRecord["financial_year_end.year"];
      if (recordYear != null && recordYear !== year) {
        input.issues.push({
          severity: "error",
          code: "RECORD_PERIOD_MISMATCH",
          message: `${category} contains a record for a different financial year.`
        });
        return;
      }
      const amount = sourceRecord["amount.sum"] ?? sourceRecord.amount;
      if (amount != null && (typeof amount !== "number" || !Number.isFinite(amount))) {
        input.issues.push({
          severity: "error",
          code: "INVALID_NUMERIC_VALUE",
          message: `${category} contains a non-numeric amount.`
        });
        return;
      }
      const dimensions = Object.fromEntries(
        Object.entries(sourceRecord)
          .filter(([key]) => key !== "amount.sum" && key !== "amount")
          .sort(([left], [right]) => left.localeCompare(right))
      );
      const recordHash = hashValue({ category, sourceRecord });
      if (seenRecords.has(recordHash)) {
        input.issues.push({
          severity: "error",
          code: "DUPLICATE_SOURCE_RECORD",
          message: `${category} contains a duplicate source record.`
        });
        return;
      }
      seenRecords.add(recordHash);
      const recordKey = Object.keys(dimensions).length > 0
        ? `${category}:${hashValue(dimensions)}`
        : `${category}:${index}`;
      input.records.push({
        recordKey,
        sourceUrl: section.sourceUrl ?? facts.sourceUrl ?? input.datasetUrl,
        sourceRecord: { category, ...sourceRecord }
      });
    });
  }
  if (sourceRows === 0 && input.issues.length === 0) {
    input.issues.push({
      severity: "error",
      code: "NO_SOURCE_RECORDS",
      message: "Treasury returned no records for the selected municipality and year."
    });
  }
  return input;
}

export async function createTreasuryImportProcessor({
  fetchImpl = globalThis.fetch,
  dataStore
} = {}) {
  if (!dataStore ||
    typeof dataStore.persistImport !== "function" ||
    typeof dataStore.logFailedImport !== "function") {
    throw new TypeError("A persistent data store is required for Treasury imports.");
  }
  const [boundaries, censusMunicipalities] = await Promise.all([
    loadBoundaries(),
    loadCensusMunicipalities()
  ]);
  const municipalities = boundaries.get("ADM3").features.map((feature) =>
    safeMunicipality(feature, boundaries, censusMunicipalities)
  );
  const providerClient = createProviderClient(fetchImpl);

  return async function processTreasuryImport(payload, job) {
    const municipality = municipalities.find((item) =>
      item.level === "ADM3" && item.officialCode === payload?.municipalityCode
    );
    const year = payload?.year;
    if (!municipality || !Number.isInteger(year) ||
      year < 2019 || year > new Date().getUTCFullYear()) {
      throw new TypeError("The queued Treasury import request is invalid.");
    }

    let facts;
    try {
      facts = await loadTreasuryFacts(providerClient, municipality, year);
    } catch (error) {
      if (job?.attempt_count >= job?.max_attempts) {
        await dataStore.logFailedImport(
          treasuryImportMetadata(municipality, year),
          providerErrorMessage(error)
        );
      }
      throw error;
    }
    return dataStore.persistImport(buildTreasuryImport(municipality, year, facts));
  };
}

async function loadNasaPowerClimatology(providerClient, feature) {
  const coordinates = representativePoint(feature);
  if (!coordinates) throw new Error("No representative point could be calculated for this boundary.");

  const endpoint = new URL(`${nasaPowerApiRoot}/temporal/climatology/point`);
  endpoint.searchParams.set("parameters", "T2M,PRECTOTCORR");
  endpoint.searchParams.set("community", "RE");
  endpoint.searchParams.set("longitude", coordinates[0].toFixed(5));
  endpoint.searchParams.set("latitude", coordinates[1].toFixed(5));
  endpoint.searchParams.set("format", "JSON");
  const response = await providerClient.getJson(endpoint);
  const parameters = response?.properties?.parameter;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const temperature = parameters?.T2M;
  const precipitation = parameters?.PRECTOTCORR;
  const isValidSeries = (series) => series &&
    months.every((month) => Number.isFinite(series[month]) && series[month] !== -999);
  if (!isValidSeries(temperature) || !isValidSeries(precipitation) ||
    !Number.isFinite(temperature.ANN) || !Number.isFinite(precipitation.ANN)) {
    throw new Error("NASA POWER returned incomplete monthly climatology data.");
  }

  return {
    geography: {
      name: feature.properties.shapeType === "ADM1"
        ? canonicalProvinceName(feature.properties.shapeName)
        : feature.properties.shapeName,
      level: feature.properties.shapeType
    },
    coordinates: {
      latitude: Number(coordinates[1].toFixed(5)),
      longitude: Number(coordinates[0].toFixed(5))
    },
    annual: {
      temperatureC: temperature.ANN,
      precipitationMmPerDay: precipitation.ANN
    },
    monthly: months.map((month) => ({
      month,
      temperatureC: temperature[month],
      precipitationMmPerDay: precipitation[month]
    })),
    source: {
      publisher: "NASA Langley Research Center · POWER",
      source: response.header?.sources?.join(", ") ?? "NASA POWER",
      period: response.header?.range ?? "NASA POWER climatology period not reported",
      temperatureUnit: response.parameters?.T2M?.units ?? "C",
      precipitationUnit: response.parameters?.PRECTOTCORR?.units ?? "mm/day",
      url: "https://power.larc.nasa.gov/"
    },
    sourceUrl: endpoint.toString(),
    checkedAt: new Date().toISOString()
  };
}

async function loadWorldBankNationalEconomy(providerClient) {
  const definitions = [
    ["gdpCurrentUsd", "NY.GDP.MKTP.CD", "GDP (current US$)", "current US$"],
    ["gdpGrowth", "NY.GDP.MKTP.KD.ZG", "GDP growth (annual %)", "%"],
    ["agricultureShare", "NV.AGR.TOTL.ZS", "Agriculture value added", "% of GDP"],
    ["industryShare", "NV.IND.TOTL.ZS", "Industry value added", "% of GDP"],
    ["servicesShare", "NV.SRV.TOTL.ZS", "Services value added", "% of GDP"]
  ];
  const results = await Promise.allSettled(definitions.map(async ([key, code, label, unit]) => {
    const endpoint = new URL(`${worldBankApiRoot}/country/ZAF/indicator/${code}`);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("per_page", "100");
    const response = await providerClient.getJson(endpoint, { timeoutMs: 8000 });
    if (!Array.isArray(response) || !Array.isArray(response[1])) {
      throw new Error(`World Bank returned an invalid ${code} response.`);
    }
    const values = response[1].flatMap((record) => {
      const year = Number.parseInt(record.date, 10);
      return Number.isInteger(year) && typeof record.value === "number" && Number.isFinite(record.value)
        ? [{ year, value: record.value }]
        : [];
    }).sort((left, right) => left.year - right.year);
    if (!values.length) throw new Error(`World Bank returned no numeric observations for ${code}.`);
    return {
      key,
      code,
      label,
      unit,
      values,
      sourceUrl: endpoint.toString()
    };
  }));
  const indicators = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const [key, code, label, unit] = definitions[index];
    return {
      key,
      code,
      label,
      unit,
      values: [],
      sourceUrl: null,
      error: providerErrorMessage(result.reason)
    };
  });
  if (!indicators.some((indicator) => indicator.values.length)) {
    throw new Error("World Bank returned no numeric national economic indicators.");
  }
  return {
    country: "South Africa",
    geographyLevel: "National",
    indicators,
    source: {
      publisher: "World Bank",
      dataset: "World Development Indicators",
      url: "https://data.worldbank.org/country/south-africa",
      note: "These are national-level indicators, not provincial or municipal economic output."
    },
    checkedAt: new Date().toISOString()
  };
}

async function loadTreasuryCapitalAcquisitions(providerClient, municipality, year) {
  const members = await loadTreasuryMembers(providerClient);
  const member = matchTreasuryMunicipality(municipality, members);
  if (!member) {
    return {
      municipality,
      year,
      treasuryMunicipality: null,
      rows: [],
      totalRecords: 0,
      source: {
        publisher: "National Treasury · Municipal Money",
        dataset: "Capital Acquisition (v2)",
        url: "https://municipaldata.treasury.gov.za/docs#cube-capital_v2",
        apiUrl: null,
        unit: "ZAR",
        note: "Section 71 mSCOA capital acquisition records are expenditure categories, not a named project register."
      },
      checkedAt: new Date().toISOString()
    };
  }

  const result = await loadTreasuryAggregate(
    providerClient,
    "capital_v2",
    member["municipality.demarcation_code"],
    year,
    "demarcation.code|demarcation.label|financial_year_end.year|function.code|function.label|item.code|item.label|capital_type.code|capital_type.label|amount_type.code|amount_type.label"
  );
  const rows = result.rows.filter((row) =>
    row["demarcation.code"] === member["municipality.demarcation_code"] &&
    row["financial_year_end.year"] === year
  );
  return {
    municipality,
    year,
    treasuryMunicipality: {
      code: member["municipality.demarcation_code"],
      name: treasuryMemberName(member)
    },
    rows,
    totalRecords: result.totalRecords,
    source: {
      publisher: "National Treasury · Municipal Money",
      dataset: "Capital Acquisition (v2)",
      url: "https://municipaldata.treasury.gov.za/docs#cube-capital_v2",
      apiUrl: result.sourceUrl,
      unit: "ZAR",
      note: "Section 71 mSCOA capital acquisition records describe purchase, repair and renewal of capital assets by financial and functional category. They do not identify individual project names, locations, schedules or contractors."
    },
    checkedAt: new Date().toISOString()
  };
}

const namedProjectYears = new Set(["2017/2018", "2019/2020", "2020/2021", "2021/2022", "2022/2023", "2023/2024"]);
const namedProjectsApi = "https://municipalmoney.gov.za/api/v1/infrastructure/search";

function normalizeNamedProject(record) {
  const expenditure = Array.isArray(record.expenditure) ? record.expenditure : [];
  return {
    id: String(record.id ?? ""),
    name: String(record.project_description ?? "Unnamed infrastructure project"),
    projectNumber: record.project_number == null ? null : String(record.project_number),
    type: record.project_type == null ? null : String(record.project_type),
    function: record.function == null ? null : String(record.function),
    ward: record.ward_location == null ? null : String(record.ward_location),
    status: record.status == null ? null : String(record.status),
    financialYear: record.financial_year == null ? null : String(record.financial_year),
    expenditure: expenditure.filter((entry) => entry && Number.isFinite(Number(entry.amount))).map((entry) => ({
      amount: Number(entry.amount),
      financialYear: String(entry.financial_year?.budget_year ?? entry.financial_year ?? ""),
      budgetPhase: String(entry.budget_phase?.name ?? entry.budget_phase ?? "Not specified")
    }))
  };
}

async function loadNamedInfrastructureProjects(providerClient, municipality, year) {
  const projects = [];
  let total = 0;
  // The public API returns 150 records per page; cap collection to prevent a
  // provider response from creating unbounded memory or request work.
  for (let page = 1; page <= 8; page += 1) {
    const endpoint = new URL(namedProjectsApi);
    endpoint.searchParams.set("municipality", municipality.name);
    endpoint.searchParams.set("province", municipality.province);
    endpoint.searchParams.set("financial_year", year);
    endpoint.searchParams.set("page", String(page));
    const result = await providerClient.getJson(endpoint, { timeoutMs: 20000 });
    const pageProjects = Array.isArray(result.results) ? result.results :
      Array.isArray(result.results?.projects) ? result.results.projects :
        Array.isArray(result.projects) ? result.projects : [];
    total = Number.isFinite(Number(result.count)) ? Number(result.count) : total;
    projects.push(...pageProjects.map(normalizeNamedProject));
    if (!result.next || !pageProjects.length || projects.length >= 1200) break;
  }
  return {
    municipality: { name: municipality.name, province: municipality.province },
    financialYear: year,
    projects,
    totalRecords: total || projects.length,
    truncated: total > projects.length,
    source: {
      publisher: "National Treasury and OpenUp · Municipal Money",
      dataset: "Municipal infrastructure projects",
      url: "https://municipalmoney.gov.za/infrastructure/projects/",
      apiUrl: namedProjectsApi,
      note: "The source dataset is available through FY 2023/2024. Project type describes the source classification and is not a completion status."
    },
    checkedAt: new Date().toISOString()
  };
}

async function loadTreasuryMunicipalDocuments(providerClient, municipality) {
  const members = await loadTreasuryMembers(providerClient);
  const member = matchTreasuryMunicipality(municipality, members);
  if (!member) {
    return {
      municipality,
      treasuryMunicipality: null,
      officialMunicipalWebsite: null,
      auditRecords: [],
      sourceUrl: "https://municipaldata.treasury.gov.za/api/cubes/audit_opinions",
      checkedAt: new Date().toISOString()
    };
  }

  const code = member["municipality.demarcation_code"];
  const endpoint = new URL(`${treasuryApiRoot}/cubes/audit_opinions/facts`);
  endpoint.searchParams.set("cut", `demarcation.code:"${code}"`);
  endpoint.searchParams.set("pagesize", "100");
  const response = await providerClient.getJson(endpoint);
  if (!Array.isArray(response.data)) {
    throw new Error("National Treasury returned an invalid audit-report document response.");
  }
  const auditRecords = response.data
    .filter((record) =>
      record["demarcation.code"] === code &&
      Number.isInteger(record["financial_year_end.year"])
    )
    .map((record) => ({
      year: record["financial_year_end.year"],
      opinion: record["opinion.label"] ?? null,
      reportUrl: safeTreasuryReportUrl(record["opinion.report_url"])
    }))
    .sort((left, right) => right.year - left.year);
  return {
    municipality,
    treasuryMunicipality: {
      code,
      name: treasuryMemberName(member)
    },
    officialMunicipalWebsite: safePublicHttpUrl(member["municipality.url"]),
    auditRecords,
    sourceUrl: endpoint.toString(),
    checkedAt: new Date().toISOString()
  };
}

async function loadTreasuryAuditOpinions(providerClient, municipality, year) {
  const members = await loadTreasuryMembers(providerClient);
  const member = matchTreasuryMunicipality(municipality, members);
  if (!member) {
    return {
      municipality,
      year,
      source: "Auditor-General South Africa · via National Treasury",
      sourceUrl: "https://municipaldata.treasury.gov.za/",
      rows: [],
      checkedAt: new Date().toISOString()
    };
  }

  const endpoint = new URL(`${treasuryApiRoot}/cubes/audit_opinions/facts`);
  endpoint.searchParams.set(
    "cut",
    `demarcation.code:"${member["municipality.demarcation_code"]}"|financial_year_end.year:${year}`
  );
  endpoint.searchParams.set("pagesize", "100");
  const response = await providerClient.getJson(endpoint);
  if (!Array.isArray(response.data)) {
    throw new Error("National Treasury returned an invalid audit-opinion response.");
  }
  const rows = response.data.filter((record) =>
    record["demarcation.code"] === member["municipality.demarcation_code"] &&
    record["financial_year_end.year"] === year
  );
  return {
    municipality,
    year,
    source: "Auditor-General South Africa · via National Treasury",
    sourceUrl: endpoint.toString(),
    rows: rows.map((record) => {
      return {
        year: record["financial_year_end.year"],
        opinion: record["opinion.label"] ?? null,
        reportUrl: safeTreasuryReportUrl(record["opinion.report_url"])
      };
    }),
    checkedAt: new Date().toISOString()
  };
}

async function loadCitiesNetworkPosts(providerClient, count = 12) {
  const endpoint = new URL(`${citiesNetworkApiRoot}/posts`);
  endpoint.searchParams.set("per_page", String(count));
  endpoint.searchParams.set("_fields", "id,date,link,title,excerpt");
  const response = await providerClient.getJson(endpoint);
  return safeCitiesNetworkPublications(response);
}

async function respondFromProvider(response, providerName, operation) {
  try {
    jsonResponse(response, 200, await operation());
  } catch (error) {
    jsonResponse(response, 502, {
      error: `${providerName} could not provide this data: ${providerErrorMessage(error)}`,
      code: "PROVIDER_UNAVAILABLE"
    });
  }
}

function sendStaticFile(response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    jsonResponse(response, 400, { error: "Invalid URL path." });
    return;
  }

  const relativePath = decodedPath === "/" ? "html/index.html" : decodedPath.slice(1);
  const filename = resolve(webRoot, relativePath);
  if (filename !== webRoot && !filename.startsWith(`${webRoot}${sep}`)) {
    jsonResponse(response, 404, { error: "Not found." });
    return;
  }

  const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/geo+json; charset=utf-8"],
    [".csv", "text/csv; charset=utf-8"],
    [".svg", "image/svg+xml"]
  ]);
  const contentType = contentTypes.get(extname(filename).toLowerCase());
  if (!contentType) {
    jsonResponse(response, 404, { error: "Not found." });
    return;
  }

  createReadStream(filename)
    .once("error", (error) => {
      if (error.code === "ENOENT") {
        jsonResponse(response, 404, { error: "Not found." });
      } else {
        jsonResponse(response, 500, { error: "Unable to read the requested file." });
      }
    })
    .once("open", () => {
      response.writeHead(200, {
        "content-type": contentType,
        "x-content-type-options": "nosniff",
        "cache-control": "public, max-age=300"
      });
    })
    .pipe(response);
}

export async function createAppServer({
  fetchImpl = globalThis.fetch,
  dataStore = createDataStore(),
  adminToken = process.env.CIVICSTATS_ADMIN_TOKEN
} = {}) {
  if (adminToken != null &&
    (typeof adminToken !== "string" || Buffer.byteLength(adminToken) < 32)) {
    throw new Error("CIVICSTATS_ADMIN_TOKEN must be at least 32 bytes.");
  }
  const boundaries = await loadBoundaries();
  const sources = JSON.parse(await readFile(resolve(webRoot, "assets", "data-sources.json"), "utf8"));
  const providerClient = createProviderClient(fetchImpl);
  const censusMunicipalities = await loadCensusMunicipalities();
  const electricityLighting = await loadElectricityLighting();
  for (const record of censusMunicipalities) {
    const electricity = electricityLighting.get(record.muni_code);
    if (!electricity || electricity.name !== record.name) {
      throw new Error(`Stats SA electricity-lighting data does not match Census municipality ${record.muni_code}.`);
    }
  }
  const provincialGdpR = await loadProvincialGdpR();
  const provincialUnemployment = await loadProvincialUnemployment();
  const municipalCouncillors2021 = await loadMunicipalCouncillors2021(censusMunicipalities);
  const municipalities = boundaries.get("ADM3").features.map((feature) =>
    safeMunicipality(feature, boundaries, censusMunicipalities)
  );
  const metropolitanNames = new Set(municipalities
    .filter((municipality) => municipality.district === municipality.name)
    .map((municipality) => municipality.name));
  const geographies = [...boundaries.values()].flatMap((collection) =>
    collection.features.map((feature) =>
      safeGeography(feature, boundaries, municipalities, metropolitanNames)
    )
  );
  const adminRequests = new Map();

  return createServer((request, response) => {
    configureLocalCors(request, response);
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader(
      "content-security-policy",
      "default-src 'self'; style-src 'self' https://unpkg.com https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; script-src 'self' https://unpkg.com; img-src 'self' data:; connect-src 'self' https://municipaldata.treasury.gov.za https://sacities.net https://power.larc.nasa.gov;"
    );

    let url;
    try {
      url = new URL(request.url, "http://localhost");
    } catch {
      jsonResponse(response, 400, { error: "Invalid request URL." });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-max-age": "600" });
      response.end();
      return;
    }

    const treasuryImportPath = url.pathname === "/api/admin/imports/treasury";
    const approveImportMatch = url.pathname.match(/^\/api\/admin\/imports\/(\d+)\/approve$/);
    const rejectImportMatch = url.pathname.match(/^\/api\/admin\/imports\/(\d+)\/reject$/);
    if (request.method === "POST" &&
      (treasuryImportPath || approveImportMatch || rejectImportMatch)) {
      if (!requireAdmin(request, response, adminToken, adminRequests)) return;
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }

      if (approveImportMatch) {
        const importId = Number(approveImportMatch[1]);
        void dataStore.approveImport(importId).then((result) => {
          jsonResponse(response, 200, result);
        }).catch((error) => {
          if (error instanceof DataStoreError) {
            jsonResponse(response, error.status, { error: error.message, code: error.code });
            return;
          }
          console.error("Data import approval failed.", providerErrorMessage(error));
          jsonResponse(response, 500, {
            error: "The import could not be approved.",
            code: "IMPORT_APPROVAL_FAILED"
          });
        });
        return;
      }

      if (rejectImportMatch) {
        void (async () => {
          let body;
          try {
            body = await readJsonBody(request);
          } catch (error) {
            const status = error instanceof RequestBodyError ? error.status : 400;
            jsonResponse(response, status, {
              error: error instanceof RequestBodyError ? error.message : "Invalid request body.",
              code: "INVALID_REQUEST_BODY"
            });
            return;
          }
          try {
            const result = await dataStore.rejectImport(
              Number(rejectImportMatch[1]),
              typeof body.reason === "string" ? body.reason : ""
            );
            jsonResponse(response, 200, result);
          } catch (error) {
            if (error instanceof DataStoreError) {
              jsonResponse(response, error.status, { error: error.message, code: error.code });
              return;
            }
            console.error("Data import rejection failed.", providerErrorMessage(error));
            jsonResponse(response, 500, {
              error: "The import could not be rejected.",
              code: "IMPORT_REJECTION_FAILED"
            });
          }
        })();
        return;
      }

      void (async () => {
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          const status = error instanceof RequestBodyError ? error.status : 400;
          jsonResponse(response, status, {
            error: error instanceof RequestBodyError ? error.message : "Invalid request body.",
            code: "INVALID_REQUEST_BODY"
          });
          return;
        }
        const municipalityCode = typeof body.municipalityCode === "string"
          ? body.municipalityCode.trim()
          : "";
        const municipality = municipalities.find((item) =>
          item.level === "ADM3" && item.officialCode === municipalityCode
        );
        if (!municipality) {
          jsonResponse(response, 400, {
            error: "municipalityCode must match an official Census municipality code.",
            code: "INVALID_MUNICIPALITY_CODE"
          });
          return;
        }
        const year = body.year;
        if (!Number.isInteger(year) || year < 2019 || year > new Date().getUTCFullYear()) {
          jsonResponse(response, 400, {
            error: "Financial reporting year must be from 2019 through the current year.",
            code: "INVALID_REPORTING_PERIOD"
          });
          return;
        }

        try {
          const result = await dataStore.enqueueImport({ municipalityCode, year });
          jsonResponse(response, 202, {
            ...result,
            status: result.status,
            message: result.duplicate
              ? "An equivalent Treasury import is already queued or processing."
              : "Treasury import queued for background processing."
          });
        } catch (error) {
          console.error("Treasury import could not be queued.", providerErrorMessage(error));
          jsonResponse(response, 503, {
            error: "The Treasury import could not be added to the durable queue.",
            code: "IMPORT_QUEUE_UNAVAILABLE"
          });
        }
      })();
      return;
    }

    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      jsonResponse(response, 405, { error: "This method is not supported." });
      return;
    }

    if (url.pathname === "/api/health") {
      jsonResponse(response, 200, {
        status: "ok",
        boundaryLevels: Object.fromEntries(
          [...boundaries].map(([level, collection]) => [level, collection.features.length])
        ),
        censusMunicipalityRecords: censusMunicipalities.length,
        electricityMunicipalityRecords: electricityLighting.size,
        provincialGdpRecords: provincialGdpR.provinces.length,
        electionMunicipalityRecords: municipalCouncillors2021.recordsByCode.size
      });
      return;
    }

    if (url.pathname === "/api/health/db") {
      if (!dataStore) {
        jsonResponse(response, 503, {
          status: "error",
          database: { connected: false, provider: "PostgreSQL", query_test: "failed" }
        });
        return;
      }
      void dataStore.checkHealth().then(() => {
        jsonResponse(response, 200, {
          status: "ok",
          database: { connected: true, provider: "PostgreSQL", query_test: "passed" }
        });
      }).catch(() => {
        jsonResponse(response, 503, {
          status: "error",
          database: { connected: false, provider: "PostgreSQL", query_test: "failed" }
        });
      });
      return;
    }

    if (url.pathname === "/api/sources") {
      jsonResponse(response, 200, { sources });
      return;
    }

    if (url.pathname === "/api/data/availability") {
      if (!dataStore) {
        jsonResponse(response, 200, { storage: "not_configured", datasets: [] });
        return;
      }
      void dataStore.getAvailability().then((result) => {
        jsonResponse(response, 200, result);
      }).catch((error) => {
        console.error("Data availability lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "Persistent data storage is unavailable.",
          code: "DATA_STORE_UNAVAILABLE"
        });
      });
      return;
    }

    if (url.pathname === "/api/admin/imports") {
      if (!requireAdmin(request, response, adminToken, adminRequests)) return;
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }
      const limit = Number(url.searchParams.get("limit") ?? "20");
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        jsonResponse(response, 400, {
          error: "limit must be an integer from 1 through 100.",
          code: "INVALID_LIMIT"
        });
        return;
      }
      void dataStore.listImports(limit).then((imports) => {
        jsonResponse(response, 200, { imports });
      }).catch((error) => {
        console.error("Import history lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "Import history is unavailable.",
          code: "IMPORT_HISTORY_UNAVAILABLE"
        });
      });
      return;
    }

    if (url.pathname === "/api/admin/import-queue") {
      if (!requireAdmin(request, response, adminToken, adminRequests)) return;
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }
      const limit = Number(url.searchParams.get("limit") ?? "20");
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        jsonResponse(response, 400, {
          error: "limit must be an integer from 1 through 100.",
          code: "INVALID_LIMIT"
        });
        return;
      }
      void dataStore.listQueuedImports(limit).then((jobs) => {
        jsonResponse(response, 200, { jobs });
      }).catch((error) => {
        console.error("Import queue lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "The import queue is unavailable.",
          code: "IMPORT_QUEUE_UNAVAILABLE"
        });
      });
      return;
    }

    const queuedImportMatch = url.pathname.match(
      /^\/api\/admin\/import-queue\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
    );
    if (queuedImportMatch) {
      if (!requireAdmin(request, response, adminToken, adminRequests)) return;
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }
      void dataStore.getQueuedImport(queuedImportMatch[1]).then((job) => {
        jsonResponse(response, 200, { job });
      }).catch((error) => {
        if (error instanceof DataStoreError) {
          jsonResponse(response, error.status, { error: error.message, code: error.code });
          return;
        }
        console.error("Import queue status lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "Import queue status is unavailable.",
          code: "IMPORT_QUEUE_UNAVAILABLE"
        });
      });
      return;
    }

    const importDetailMatch = url.pathname.match(/^\/api\/admin\/imports\/(\d+)$/);
    if (importDetailMatch) {
      if (!requireAdmin(request, response, adminToken, adminRequests)) return;
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isSafeInteger(offset) || offset < 0) {
        jsonResponse(response, 400, {
          error: "limit must be 1 through 100 and offset must be a non-negative integer.",
          code: "INVALID_PAGINATION"
        });
        return;
      }
      void dataStore.getImport(Number(importDetailMatch[1]), { limit, offset }).then((result) => {
        jsonResponse(response, 200, result);
      }).catch((error) => {
        if (error instanceof DataStoreError) {
          jsonResponse(response, error.status, { error: error.message, code: error.code });
          return;
        }
        console.error("Import detail lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "Import details are unavailable.",
          code: "IMPORT_DETAIL_UNAVAILABLE"
        });
      });
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) {
      jsonResponse(response, 404, { error: "Unknown administrative endpoint." });
      return;
    }

    const treasuryDataMatch = url.pathname.match(/^\/api\/data\/municipalities\/([^/]+)\/treasury$/);
    if (treasuryDataMatch) {
      let code;
      try {
        code = decodeURIComponent(treasuryDataMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality code." });
        return;
      }
      const municipality = municipalities.find((item) =>
        item.level === "ADM3" && item.officialCode === code
      );
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      const year = Number(url.searchParams.get("year") ?? "2024");
      if (!Number.isInteger(year) || year < 2019 || year > new Date().getUTCFullYear()) {
        jsonResponse(response, 400, {
          error: "Financial reporting year must be from 2019 through the current year."
        });
        return;
      }
      if (!dataStore) {
        jsonResponse(response, 503, {
          error: "Persistent data storage is not configured.",
          code: "DATA_STORE_NOT_CONFIGURED"
        });
        return;
      }
      void dataStore.getTreasuryRecords(code, String(year)).then((result) => {
        const validationStatus = result.latestImport
          ? result.latestImport.status === "approved"
            ? "verified"
            : result.latestImport.status === "awaiting_review"
              ? "awaiting_validation"
              : "incomplete"
          : result.dataset?.validation_status ?? "not_imported";
        jsonResponse(response, 200, {
          municipality,
          reportingPeriod: String(year),
          available: result.records.length > 0,
          validationStatus,
          publicationStatus: result.records.length > 0 ? "published" : "unpublished",
          latestImport: result.latestImport,
          source: result.dataset,
          records: result.records
        });
      }).catch((error) => {
        console.error("Published Treasury data lookup failed.", providerErrorMessage(error));
        jsonResponse(response, 503, {
          error: "Published Treasury data is unavailable.",
          code: "DATA_LOOKUP_FAILED"
        });
      });
      return;
    }

    if (url.pathname === "/api/integrations") {
      const checkedAt = new Date().toISOString();
      const nasaProbe = new URL(`${nasaPowerApiRoot}/temporal/climatology/point`);
      nasaProbe.searchParams.set("parameters", "T2M,PRECTOTCORR");
      nasaProbe.searchParams.set("community", "RE");
      nasaProbe.searchParams.set("longitude", "28.0473");
      nasaProbe.searchParams.set("latitude", "-26.2041");
      nasaProbe.searchParams.set("format", "JSON");
      const worldBankProbe = new URL(`${worldBankApiRoot}/country/ZAF/indicator/NY.GDP.MKTP.CD`);
      worldBankProbe.searchParams.set("format", "json");
      worldBankProbe.searchParams.set("per_page", "1");
      void Promise.allSettled([
        loadTreasuryCubeList(providerClient),
        providerClient.getJson(new URL(`${treasuryApiRoot}/cubes/audit_opinions/facts?pagesize=1`)),
        loadCitiesNetworkPosts(providerClient, 5),
        providerClient.getJson(nasaProbe),
        providerClient.getJson(worldBankProbe)
      ]).then(([treasury, agsa, sacn, nasa, worldBank]) => {
        const treasuryCubeNames = treasury.status === "fulfilled"
          ? treasury.value.data.map((cube) => cube.name)
          : [];
        const sourceStatus = (id, status, detail) =>
          localSourceStatus(sources.find((source) => source.id === id), status, detail, checkedAt);
        const integrations = [
          sourceStatus("geoboundaries", "loaded", "ADM1, ADM2 and ADM3 boundaries are served from the bundled, attributed geoBoundaries release."),
          sourceStatus(
            "treasury",
            treasury.status === "fulfilled" && treasuryCubeNames.includes("incexp_v2")
              ? "connected"
              : "unavailable",
            treasury.status === "fulfilled" && treasuryCubeNames.includes("incexp_v2")
              ? "Live Treasury API verified; municipal annual finance facts are available on request."
              : treasury.status === "rejected"
                ? providerErrorMessage(treasury.reason)
                : "Treasury responded, but the municipal finance cube is not available."
          ),
          sourceStatus(
            "agsa",
            agsa.status === "fulfilled" && Array.isArray(agsa.value.data) ? "connected-via-treasury" : "unavailable",
            agsa.status === "fulfilled" && Array.isArray(agsa.value.data)
              ? "Live audit-opinion records and report links are served through National Treasury."
              : agsa.status === "rejected"
                ? providerErrorMessage(agsa.reason)
                : "Treasury returned an invalid audit-opinion response."
          ),
          sourceStatus(
            "stats-sa",
            "loaded",
            "Census 2022 municipal population, age, household, dwelling, water, sanitation and cooking-energy tables are bundled for all 213 municipalities. Figures are from Stats SA's 2023 Provinces at a Glance publication."
          ),
          sourceStatus(
            "stats-sa-electricity",
            "loaded",
            "Stats SA Census municipal fact sheet values for the household share reporting electricity as the main lighting source in 2011 and 2022, matched to all 213 municipalities. This is not a measure of grid connection or supply reliability."
          ),
          sourceStatus(
            "stats-sa-gdp-r",
            "loaded",
            "Stats SA Provincial GDP release P0441.2: current-price GDP, provincial contributions, real growth and industry activity for all nine provinces, 2014–2024. No municipal GDP is inferred."
          ),
          sourceStatus(
            "stats-sa-qlfs",
            "loaded",
            "Stats SA QLFS Q3 2026 provincial unemployment and LU3 estimates for all nine provinces, with Q3 2025 and Q2 2026 comparisons."
          ),
          sourceStatus(
            "nasa-power",
            nasa.status === "fulfilled" && nasa.value?.properties?.parameter?.T2M
              ? "connected"
              : "unavailable",
            nasa.status === "fulfilled" && nasa.value?.properties?.parameter?.T2M
              ? `NASA POWER climatology API verified; monthly temperature and precipitation normals use the source's reported period.`
              : nasa.status === "rejected"
                ? providerErrorMessage(nasa.reason)
                : "NASA POWER returned an invalid climatology response."
          ),
          sourceStatus(
            "world-bank-wdi",
            worldBank.status === "fulfilled" && Array.isArray(worldBank.value?.[1])
              ? "connected"
              : "unavailable",
            worldBank.status === "fulfilled" && Array.isArray(worldBank.value?.[1])
              ? "World Bank World Development Indicators API verified; national economic series are available on request."
              : worldBank.status === "rejected"
                ? providerErrorMessage(worldBank.reason)
                : "World Bank returned an invalid WDI response."
          ),
          sourceStatus("salga", "portal-only", "Official SALGA publications portal linked. No public structured data API has been verified."),
          sourceStatus(
            "sacn",
            sacn.status === "fulfilled" ? "connected" : "unavailable",
            sacn.status === "fulfilled"
              ? "Live South African Cities Network publications feed verified."
              : providerErrorMessage(sacn.reason)
          )
        ];
        jsonResponse(response, 200, { checkedAt, integrations });
      }).catch((error) => {
        jsonResponse(response, 502, {
          error: `Unable to check provider integrations: ${providerErrorMessage(error)}`,
          code: "PROVIDER_UNAVAILABLE"
        });
      });
      return;
    }

    if (url.pathname === "/api/census/municipalities") {
      const requestedYear = url.searchParams.get("year") ?? "2022";
      if (!["2011", "2022"].includes(requestedYear)) {
        jsonResponse(response, 400, { error: "Census reporting year must be 2011 or 2022." });
        return;
      }
      const censusYear = Number(requestedYear);
      const records = municipalities.flatMap((municipality) => {
        const censusRecord = findCensusMunicipality(municipality, censusMunicipalities);
        if (!censusRecord) return [];
        const population = censusRecord[`total_pop_${censusYear}`];
        const households = censusRecord[`households_${censusYear}`];
        const waterSchemeHouseholds = censusRecord[`water_scheme_${censusYear}`];
        const flushToiletHouseholds = censusRecord[`flush_toilet_${censusYear}`];
        const electricityRecord = electricityLighting.get(censusRecord.muni_code);
        const areaKm2 = censusRecord.area_km2;
        if (![population, households, waterSchemeHouseholds, areaKm2].every(Number.isFinite) ||
          !electricityRecord || areaKm2 <= 0) {
          return [];
        }
        return [{
          id: municipality.id,
          name: municipality.name,
          province: municipality.province,
          censusCode: censusRecord.muni_code,
          year: censusYear,
          population,
          populationGrowthPercent: Number.isFinite(censusRecord.growth_rate_2011_to_2022)
            ? censusRecord.growth_rate_2011_to_2022
            : null,
          households,
          waterSchemeHouseholds,
          waterSchemeSharePercent: households > 0
            ? Number(((waterSchemeHouseholds / households) * 100).toFixed(2))
            : null,
          flushToiletHouseholds,
          flushToiletSharePercent: Number.isFinite(flushToiletHouseholds) && households > 0
            ? Number(((flushToiletHouseholds / households) * 100).toFixed(2))
            : null,
          electricityLightingSharePercent: censusYear === 2011
            ? electricityRecord.share2011
            : electricityRecord.share2022,
          basicServicesPilot: buildBasicServicesPilotScore(censusRecord, censusYear, electricityRecord),
          sourceAreaKm2: areaKm2,
          populationDensityPerKm2: Number((population / areaKm2).toFixed(2))
        }];
      });
      jsonResponse(response, 200, {
        year: censusYear,
        total: records.length,
        source: "Statistics South Africa · Census 2022: Provinces at a Glance",
        sourceUrl: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf",
        electricitySource: {
          publisher: "Statistics South Africa",
          title: "Census 2022 Municipal fact sheet",
          reportNumber: "03-01-82",
          reportingPeriods: [2011, 2022],
          indicator: "Households reporting electricity as the main source of energy for lighting",
          unit: "% of households",
          url: "https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf",
          note: "This household indicator describes the reported main source of energy for lighting. It does not measure grid connection status, electricity availability or service reliability."
        },
        methodology: "Population density is calculated as the source-reported total population divided by the area_km2 value in the bundled Census extract. Water scheme share is calculated from source-reported household counts. Municipality boundaries use geoBoundaries ADM3, 2020 vintage; this is a derived thematic view and not an official statistical classification.",
        records
      });
      return;
    }

    if (url.pathname === "/api/labour/provinces") {
      jsonResponse(response, 200, {
        ...provincialUnemployment,
        totalProvinces: new Set(provincialUnemployment.records.map((record) => record.province)).size
      });
      return;
    }

    if (url.pathname === "/api/economy/national") {
      void respondFromProvider(response, "World Bank World Development Indicators", () =>
        loadWorldBankNationalEconomy(providerClient)
      );
      return;
    }

    if (url.pathname === "/api/economy/provinces") {
      const requestedYear = url.searchParams.get("year") ?? "2024";
      if (!/^\d{4}$/.test(requestedYear) || !provincialGdpR.years.includes(Number(requestedYear))) {
        jsonResponse(response, 400, {
          error: `GDP-R reporting year must be one of ${provincialGdpR.years.join(", ")}.`
        });
        return;
      }
      const year = Number(requestedYear);
      const yearKey = String(year);
      const records = provincialGdpR.provinces.map((record) => ({
        province: record.province,
        gdpCurrentPricesRandMillions: record.gdpCurrentPricesRandMillions[yearKey],
        gdpContributionPercent: record.gdpContributionPercent[yearKey],
        gdpConstant2015PricesRandMillions: record.gdpConstant2015PricesRandMillions[yearKey],
        realGdpGrowthPercent: record.realGdpGrowthPercent[yearKey],
        industries: Object.entries(record.industryGvaCurrentPricesRandMillions).map(([activity, values]) => ({
          activity,
          gvaCurrentPricesRandMillions: values[yearKey]
        }))
      }));
      jsonResponse(response, 200, {
        year,
        availableYears: provincialGdpR.years,
        unit: provincialGdpR.source.unit,
        national: {
          gdpCurrentPricesRandMillions: provincialGdpR.national.gdpCurrentPricesRandMillions[yearKey],
          gdpConstant2015PricesRandMillions: provincialGdpR.national.gdpConstant2015PricesRandMillions[yearKey],
          realGdpGrowthPercent: provincialGdpR.national.realGdpGrowthPercent[yearKey]
        },
        source: provincialGdpR.source,
        records
      });
      return;
    }

    const climateMatch = url.pathname.match(/^\/api\/geographies\/(ADM1|ADM2|ADM3)\/([^/]+)\/climate$/);
    if (climateMatch) {
      const [, level, encodedId] = climateMatch;
      let id;
      try {
        id = decodeURIComponent(encodedId);
      } catch {
        jsonResponse(response, 400, { error: "Invalid geography reference." });
        return;
      }
      const feature = boundaries.get(level)?.features.find((entry) => entry.properties.shapeID === id);
      if (!feature) {
        jsonResponse(response, 404, { error: "Geography not found." });
        return;
      }
      void respondFromProvider(response, "NASA POWER climatology", () =>
        loadNasaPowerClimatology(providerClient, feature)
      );
      return;
    }

    if (url.pathname === "/api/publications/sacn") {
      const requestedCount = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);
      if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 20) {
        jsonResponse(response, 400, { error: "Publication limit must be a whole number between 1 and 20." });
        return;
      }
      void respondFromProvider(response, "South African Cities Network", async () => ({
        source: "South African Cities Network",
        sourceUrl: `${citiesNetworkApiRoot}/posts`,
        checkedAt: new Date().toISOString(),
        publications: await loadCitiesNetworkPosts(providerClient, requestedCount)
      }));
      return;
    }

    const projectsMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/projects$/);
    if (projectsMatch) {
      let id;
      try {
        id = decodeURIComponent(projectsMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      if (municipality.level !== "ADM3") {
        jsonResponse(response, 400, { error: "Capital acquisitions are reported for municipalities, not this geography level." });
        return;
      }
      const requestedYear = url.searchParams.get("year") ?? String(new Date().getUTCFullYear());
      const year = Number(requestedYear);
      if (!/^\d{4}$/.test(requestedYear) || !Number.isInteger(year) ||
        year < 2019 || year > new Date().getUTCFullYear()) {
        jsonResponse(response, 400, { error: "Capital acquisition reporting year must be from 2019 through the current year." });
        return;
      }
      void respondFromProvider(response, "National Treasury capital-acquisition data", () =>
        loadTreasuryCapitalAcquisitions(providerClient, municipality, year)
      );
      return;
    }

    const namedProjectsMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/named-projects$/);
    if (namedProjectsMatch) {
      let id;
      try {
        id = decodeURIComponent(namedProjectsMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      if (municipality.level !== "ADM3") {
        jsonResponse(response, 400, { error: "Named infrastructure projects are available for municipalities, not this geography level." });
        return;
      }
      const year = url.searchParams.get("year") ?? "2023/2024";
      if (!namedProjectYears.has(year)) {
        jsonResponse(response, 400, { error: "Named-project reporting year must be one of the years published by the source." });
        return;
      }
      void respondFromProvider(response, "National Treasury named infrastructure projects", () =>
        loadNamedInfrastructureProjects(providerClient, municipality, year)
      );
      return;
    }

    const documentsMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/documents$/);
    if (documentsMatch) {
      let id;
      try {
        id = decodeURIComponent(documentsMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      if (municipality.level !== "ADM3") {
        jsonResponse(response, 400, { error: "Municipal documents are available for municipalities, not this geography level." });
        return;
      }
      void respondFromProvider(response, "National Treasury municipal document catalogue", () =>
        loadTreasuryMunicipalDocuments(providerClient, municipality)
      );
      return;
    }

    if (url.pathname === "/api/geographies") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100).toLocaleLowerCase();
      const filtered = query
        ? geographies.filter((item) =>
          [item.name, item.province, item.district, item.officialCode]
            .some((value) => value?.toLocaleLowerCase().includes(query))
        )
        : geographies;
      jsonResponse(response, 200, { total: filtered.length, geographies: filtered });
      return;
    }

    if (url.pathname === "/api/municipalities") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100).toLocaleLowerCase();
      const filtered = query
        ? municipalities.filter((item) => item.name.toLocaleLowerCase().includes(query))
        : municipalities;
      jsonResponse(response, 200, {
        total: filtered.length,
        municipalities: filtered
      });
      return;
    }

    if (url.pathname.startsWith("/api/geo/")) {
      const level = url.pathname.slice("/api/geo/".length).toUpperCase();
      const collection = boundaries.get(level);
      if (!collection || !levelFiles.has(level)) {
        jsonResponse(response, 404, { error: "Unknown boundary level." });
        return;
      }
      response.writeHead(200, {
        ...jsonHeaders,
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800"
      });
      response.end(JSON.stringify(collection));
      return;
    }

    const financeMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/finance$/);
    if (financeMatch) {
      let id;
      try {
        id = decodeURIComponent(financeMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      const year = Number.parseInt(url.searchParams.get("year") ?? "2024", 10);
      if (!Number.isInteger(year) || year < 2019 || year > new Date().getUTCFullYear()) {
        jsonResponse(response, 400, { error: "Financial reporting year must be from 2019 through the current year." });
        return;
      }
      void respondFromProvider(response, "National Treasury", () =>
        loadTreasuryFacts(providerClient, municipality, year)
      );
      return;
    }

    const auditMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/audit$/);
    if (auditMatch) {
      let id;
      try {
        id = decodeURIComponent(auditMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      const year = Number.parseInt(url.searchParams.get("year") ?? "2024", 10);
      if (!Number.isInteger(year) || year < 2011 || year > new Date().getUTCFullYear()) {
        jsonResponse(response, 400, { error: "Audit reporting year must be from 2011 through the current year." });
        return;
      }
      void respondFromProvider(response, "National Treasury audit-opinion data", () =>
        loadTreasuryAuditOpinions(providerClient, municipality, year)
      );
      return;
    }

    const politicsMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/politics$/);
    if (politicsMatch) {
      let id;
      try {
        id = decodeURIComponent(politicsMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      const censusRecord = findCensusMunicipality(municipality, censusMunicipalities);
      const electionRecord = censusRecord
        ? municipalCouncillors2021.recordsByCode.get(censusRecord.muni_code)
        : null;
      if (!electionRecord) {
        jsonResponse(response, 404, { error: "No matched IEC councillor record is available for this municipality." });
        return;
      }
      jsonResponse(response, 200, {
        municipality,
        election: {
          year: 2021,
          publishedDate: municipalCouncillors2021.source.publishedDate,
          municipalityCode: electionRecord.municipalityCode,
          totalSeats: electionRecord.totalSeats,
          parties: electionRecord.parties,
          source: municipalCouncillors2021.source
        },
        latestElection: {
          year: 2026,
          checkedDate: "2026-11-10",
          update: "The IEC reported results declared on 9 November 2026 and ordered a revote for one Siyancuma voting district on 10 November 2026. This application has not imported a verified 2026 municipal seat dataset; consult the IEC for current results.",
          resultsUrl: "https://results.elections.org.za/home/Downloads/ME-Results",
          wardCouncillorsUrl: "https://www.elections.org.za/pw/StatsData/List-Of-Current-Ward-Councillors"
        }
      });
      return;
    }

    const censusMatch = url.pathname.match(/^\/api\/municipalities\/([^/]+)\/census$/);
    if (censusMatch) {
      let id;
      try {
        id = decodeURIComponent(censusMatch[1]);
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      const record = findCensusMunicipality(municipality, censusMunicipalities);
      if (!record) {
        jsonResponse(response, 200, {
          municipality,
          census: null,
          availability: municipality.level === "ADM3"
            ? "No Census 2022 municipal record was matched to this boundary."
            : "The bundled Census dataset currently contains municipality-level records only."
        });
        return;
      }
      jsonResponse(response, 200, {
        municipality,
        census: {
          officialCode: record.muni_code,
          districtCode: record.dc_code,
          provinceCode: record.prov_code,
          indicators: record
        },
        basicServicesPilot: buildBasicServicesPilotScore(record, 2022, electricityLighting.get(record.muni_code)),
        source: {
          publisher: "Statistics South Africa",
          title: "Census 2022: Provinces at a Glance",
          publicationDate: "2023-10-10",
          reportingPeriods: [2011, 2022],
          url: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf",
          extractionUrl: "https://github.com/afrith/census-2022-muni-stats",
          extractionDescription: "Cleaned municipal tables extracted from the Stats SA publication; Stats SA is the original data source."
        },
        electricity: {
          indicators: {
            electricityLightingSharePercent2011: electricityLighting.get(record.muni_code).share2011,
            electricityLightingSharePercent2022: electricityLighting.get(record.muni_code).share2022
          },
          source: {
            publisher: "Statistics South Africa",
            title: "Census 2022 Municipal fact sheet",
            reportNumber: "03-01-82",
            reportingPeriods: [2011, 2022],
            indicator: "Households reporting electricity as the main source of energy for lighting",
            unit: "% of households",
            url: "https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf",
            note: "This household indicator describes the reported main source of energy for lighting. It does not measure grid connection status, electricity availability or service reliability."
          }
        },
        matchMethod: censusBoundaryCodes.has(normalizeCensusName(municipality.name))
          ? "Official Census municipality code crosswalk for a boundary name that differs from the 2022 source name."
          : "Normalized municipality name and province."
      });
      return;
    }

    if (url.pathname.startsWith("/api/municipalities/")) {
      let id;
      try {
        id = decodeURIComponent(url.pathname.slice("/api/municipalities/".length));
      } catch {
        jsonResponse(response, 400, { error: "Invalid municipality reference." });
        return;
      }
      const municipality = municipalities.find((item) => item.id === id);
      if (!municipality) {
        jsonResponse(response, 404, { error: "Municipality not found." });
        return;
      }
      jsonResponse(response, 200, {
        municipality,
        indicators: [],
        availability: "Census 2022 population and household indicators are available from the municipality Census endpoint. Financial indicators are available from National Treasury endpoints."
      });
      return;
    }

    sendStaticFile(response, url.pathname);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }
  const dataStore = createDataStore();
  if (dataStore) {
    try {
      await dataStore.migrate();
    } catch {
      console.error("Database migrations could not be checked; starting the web server with database features unavailable.");
    }
  }
  const server = await createAppServer({ dataStore });
  server.on("close", () => {
    if (dataStore) {
      void dataStore.close().catch((error) =>
        console.error("Database connection pool could not be closed.", providerErrorMessage(error))
      );
    }
  });
  const host = process.env.HOST ?? "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`CivicStats SA ready on ${host}:${port}`);
  });
}
