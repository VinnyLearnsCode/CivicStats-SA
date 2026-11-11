import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  createAppServer,
  createTreasuryImportProcessor
} from "../backend/server.js";
import { processQueuedImportOnce } from "../backend/worker.js";

let server;
let baseUrl;

before(async () => {
  server = await createAppServer({ dataStore: null, adminToken: null });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
});

async function get(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

test("health reports the bundled South African boundary feature counts", async () => {
  const response = await get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    boundaryLevels: { ADM1: 9, ADM2: 52, ADM3: 213 },
    censusMunicipalityRecords: 213,
    electricityMunicipalityRecords: 213,
    provincialGdpRecords: 9,
    electionMunicipalityRecords: 213
  });
});

test("database health fails safely when DATABASE_URL is not configured", async () => {
  const response = await get("/api/health/db");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "error",
    database: { connected: false, provider: "PostgreSQL", query_test: "failed" }
  });
});

test("database health reports real query success and failure without diagnostics", async () => {
  let queryWorks = true;
  const probeServer = await createAppServer({
    dataStore: {
      async checkHealth() {
        if (!queryWorks) throw new Error("secret host and password must not appear");
      }
    },
    adminToken: null
  });
  await new Promise((resolve) => probeServer.listen(0, "127.0.0.1", resolve));
  const probeUrl = `http://127.0.0.1:${probeServer.address().port}/api/health/db`;
  try {
    const healthy = await fetch(probeUrl);
    assert.equal(healthy.status, 200);
    assert.deepEqual(await healthy.json(), {
      status: "ok",
      database: { connected: true, provider: "PostgreSQL", query_test: "passed" }
    });

    queryWorks = false;
    const unavailable = await fetch(probeUrl);
    assert.equal(unavailable.status, 503);
    const body = await unavailable.text();
    assert.match(body, /"connected":false/);
    assert.doesNotMatch(body, /secret|password|host/);
  } finally {
    await new Promise((resolve, reject) => probeServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("municipality search returns Johannesburg and a contained Gauteng hierarchy", async () => {
  const search = await get("/api/municipalities?q=Johannesburg");
  assert.equal(search.status, 200);
  const result = await search.json();
  const johannesburg = result.municipalities.find((item) => item.name === "City of Johannesburg");
  assert.ok(johannesburg);
  assert.equal(johannesburg.province, "Gauteng");
  assert.equal(johannesburg.district, "City of Johannesburg");

  const profile = await get(`/api/municipalities/${encodeURIComponent(johannesburg.id)}`);
  assert.equal(profile.status, 200);
  const body = await profile.json();
  assert.equal(body.municipality.id, johannesburg.id);
  assert.ok(Number.isFinite(body.municipality.areaKm2));
  assert.ok(body.municipality.areaKm2 > 0);
  assert.match(body.municipality.areaMethod, /Approximate spherical area/);
  assert.deepEqual(body.indicators, []);
  assert.match(body.availability, /Census 2022/);
});

test("local and district municipalities and source provenance are available", async () => {
  const results = await get("/api/municipalities");
  const municipalityBody = await results.json();
  assert.equal(municipalityBody.total, 213);
  assert.ok(municipalityBody.municipalities.some((item) => item.name === "Mogalakwena"));

  const sourcesResponse = await get("/api/sources");
  const { sources } = await sourcesResponse.json();
  const boundarySource = sources.find((source) => source.id === "geoboundaries");
  assert.equal(boundarySource.status, "loaded");
  assert.match(boundarySource.license, /CC BY/);
  assert.equal(sources.find((source) => source.id === "treasury").status, "live-api");
  assert.equal(sources.find((source) => source.id === "agsa").status, "via-treasury");
  assert.equal(sources.find((source) => source.id === "stats-sa").status, "loaded");
  assert.match(sources.find((source) => source.id === "stats-sa").detail, /213 municipalities/);
  assert.equal(sources.find((source) => source.id === "stats-sa-electricity").status, "loaded");
  assert.match(sources.find((source) => source.id === "stats-sa-electricity").detail, /main source for lighting/);
  assert.equal(sources.find((source) => source.id === "stats-sa-gdp-r").status, "loaded");
  assert.match(sources.find((source) => source.id === "stats-sa-gdp-r").detail, /2014–2024/);
  assert.equal(sources.find((source) => source.id === "stats-sa-qlfs").status, "loaded");
  assert.match(sources.find((source) => source.id === "stats-sa-qlfs").detail, /Q3 2026/);
  assert.equal(sources.find((source) => source.id === "iec-council-2021").status, "loaded");
  assert.match(sources.find((source) => source.id === "iec-council-2021").detail, /all 213/);
  assert.equal(sources.find((source) => source.id === "iec-current-elections").status, "portal-only");
  assert.match(sources.find((source) => source.id === "iec-current-elections").detail, /does not yet import/);
  assert.equal(sources.find((source) => source.id === "iec-current-ward-councillors").status, "portal-only");
  assert.match(sources.find((source) => source.id === "iec-current-ward-councillors").detail, /full municipal council/);
  assert.equal(sources.find((source) => source.id === "nasa-power").status, "live-api");
  assert.equal(sources.find((source) => source.id === "world-bank-wdi").status, "live-api");
  assert.match(sources.find((source) => source.id === "treasury").detail, /financial position/);
});

test("geographic directory exposes unique IDs, hierarchy, classifications and code search", async () => {
  const response = await get("/api/geographies");
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.total, 274);
  assert.ok(result.geographies.some((item) => item.level === "ADM1" && item.name === "Northern Cape"));
  assert.ok(!result.geographies.some((item) => item.level === "ADM1" && item.name === "Nothern Cape"));
  assert.deepEqual(
    Object.fromEntries(["ADM1", "ADM2", "ADM3"].map((level) => [
      level,
      result.geographies.filter((item) => item.level === level).length
    ])),
    { ADM1: 9, ADM2: 52, ADM3: 213 }
  );
  const ids = result.geographies.map((item) => item.id);
  assert.equal(ids.every((id) => typeof id === "string" && id.length > 0), true);
  assert.equal(new Set(ids).size, ids.length, "boundary identifiers must be unique across levels");

  const province = result.geographies.find((item) => item.level === "ADM1" && item.name === "Limpopo");
  const district = result.geographies.find((item) => item.level === "ADM2" && item.name === "Waterberg");
  const localMunicipality = result.geographies.find((item) =>
    item.level === "ADM3" && item.name === "Mogalakwena"
  );
  const metro = result.geographies.find((item) =>
    item.level === "ADM3" && item.name === "City of Johannesburg"
  );
  assert.ok(province);
  assert.ok(district);
  assert.ok(localMunicipality);
  assert.ok(metro);
  assert.equal(district.provinceId, province.id);
  assert.equal(district.province, province.name);
  assert.equal(localMunicipality.provinceId, province.id);
  assert.equal(localMunicipality.districtId, district.id);
  assert.ok(result.geographies.some((item) =>
    item.level === "ADM2" && item.provinceId === province.id && item.id === district.id
  ));
  assert.ok(result.geographies.some((item) =>
    item.level === "ADM3" && item.districtId === district.id && item.id === localMunicipality.id
  ));
  assert.equal(localMunicipality.officialCode, "LIM367");
  assert.equal(localMunicipality.category, "Category B · Local municipality");
  assert.equal(metro.category, "Category A · Metropolitan municipality");
  assert.equal(district.category, "Category C · District municipality");

  const search = await get("/api/geographies?q=LIM367").then((item) => item.json());
  assert.equal(search.total, 1);
  assert.equal(search.geographies[0].id, localMunicipality.id);

  const boundaries = await get("/api/geo/ADM1");
  assert.equal(boundaries.status, 200);
  assert.match(boundaries.headers.get("cache-control"), /max-age=86400/);
});

test("IEC 2021 party seat counts cover all municipalities and keep ward and PR seats distinct", async () => {
  const { municipalities } = await get("/api/municipalities").then((response) => response.json());
  const records = [];
  for (const municipality of municipalities) {
    const response = await get(`/api/municipalities/${encodeURIComponent(municipality.id)}/politics`);
    assert.equal(response.status, 200, municipality.name);
    const result = await response.json();
    assert.equal(result.municipality.id, municipality.id);
    assert.equal(result.election.year, 2021);
    assert.equal(result.election.publishedDate, "2021-11-20");
    assert.equal(result.election.source.publisher, "Electoral Commission of South Africa");
    assert.equal(result.latestElection.year, 2026);
    assert.match(result.latestElection.update, /revote/);
    assert.equal(result.election.parties.reduce((total, party) => total + party.totalSeats, 0), result.election.totalSeats);
    assert.equal(result.election.parties.every((party) =>
      party.totalSeats === party.wardSeats + party.proportionalRepresentationSeats
    ), true);
    records.push(result.election);
  }
  assert.equal(records.length, 213);

  const johannesburg = records.find((record) => record.municipalityCode === "JHB");
  assert.equal(johannesburg.totalSeats, 270);
  assert.equal(johannesburg.parties.find((party) => party.name === "AFRICAN NATIONAL CONGRESS").totalSeats, 91);
  assert.equal(johannesburg.parties.find((party) => party.name === "DEMOCRATIC ALLIANCE").totalSeats, 71);

  const mogalakwena = records.find((record) => record.municipalityCode === "LIM367");
  assert.equal(mogalakwena.totalSeats, 64);
  assert.equal(mogalakwena.parties.find((party) => party.name === "AFRICAN NATIONAL CONGRESS").totalSeats, 42);
  assert.equal(records.every((record) => record.parties.every((party) =>
    !Object.hasOwn(party, "nameOfCouncillor") && !Object.hasOwn(party, "idNumber")
  )), true);
});

test("Census 2011 and 2022 records are available for every municipality", async () => {
  const municipalitiesResponse = await get("/api/municipalities");
  const { municipalities } = await municipalitiesResponse.json();
  const missing = [];

  for (const municipality of municipalities) {
    const response = await get(`/api/municipalities/${encodeURIComponent(municipality.id)}/census`);
    assert.equal(response.status, 200, municipality.name);
    const body = await response.json();
    if (!body.census) {
      missing.push(municipality.name);
      continue;
    }
    assert.equal(body.census.indicators.prov_code.length > 0, true, municipality.name);
    assert.equal(body.source.publisher, "Statistics South Africa", municipality.name);
    assert.deepEqual(body.source.reportingPeriods, [2011, 2022], municipality.name);
  }

  assert.deepEqual(missing, [], `Census records were not mapped: ${missing.join(", ")}`);
});

test("Census profile returns source-linked population, age and household indicators", async () => {
  const search = await get("/api/municipalities?q=Mogalakwena");
  const { municipalities } = await search.json();
  const mogalakwena = municipalities.find((item) => item.name === "Mogalakwena");
  const response = await get(`/api/municipalities/${encodeURIComponent(mogalakwena.id)}/census`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.census.officialCode, "LIM367");
  assert.equal(result.census.indicators.total_pop_2011, 304585);
  assert.equal(result.census.indicators.total_pop_2022, 378198);
  assert.equal(result.census.indicators.households_2022, 109294);
  assert.equal(result.census.indicators.age_15_to_34_2022, 121925);
  assert.equal(result.census.indicators.water_scheme_2022, 65373);
  assert.equal(result.electricity.indicators.electricityLightingSharePercent2011, 91.8);
  assert.equal(result.electricity.indicators.electricityLightingSharePercent2022, 97.2);
  assert.equal(result.electricity.source.publisher, "Statistics South Africa");
  assert.match(result.electricity.source.url, /Census_2022_Municipal_factsheet-Web\.pdf/);
  assert.equal(result.source.title, "Census 2022: Provinces at a Glance");
  assert.match(result.source.url, /Provinces_at_a_Glance\.pdf/);

  const sourceCsv = await get("/assets/data/person-indicators-muni.csv");
  assert.equal(sourceCsv.status, 200);
  assert.match(sourceCsv.headers.get("content-type"), /text\/csv/);
});

test("Census map layers return complete 2011 and 2022 municipal measures with explicit methods", async () => {
  for (const year of [2011, 2022]) {
    const response = await get(`/api/census/municipalities?year=${year}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.year, year);
    assert.equal(result.total, 213);
    assert.equal(result.records.length, 213);
    assert.equal(result.records.every((record) => record.year === year), true);
    assert.match(result.methodology, /Population density is calculated/);
    assert.match(result.sourceUrl, /Provinces_at_a_Glance\.pdf/);
    assert.equal(result.electricitySource.publisher, "Statistics South Africa");
    assert.match(result.electricitySource.url, /Census_2022_Municipal_factsheet-Web\.pdf/);
    assert.equal(result.records.every((record) =>
      Number.isFinite(record.electricityLightingSharePercent) &&
      record.electricityLightingSharePercent >= 0 &&
      record.electricityLightingSharePercent <= 100
    ), true);

    const mogalakwena = result.records.find((record) => record.censusCode === "LIM367");
    const censusResponse = await get("/api/municipalities/" + encodeURIComponent(mogalakwena.id) + "/census");
    const census = await censusResponse.json();
    assert.equal(mogalakwena.population, census.census.indicators[`total_pop_${year}`]);
    assert.equal(mogalakwena.households, census.census.indicators[`households_${year}`]);
    assert.equal(mogalakwena.populationDensityPerKm2, Number((mogalakwena.population / mogalakwena.sourceAreaKm2).toFixed(2)));
    assert.equal(mogalakwena.waterSchemeSharePercent, Number(((mogalakwena.waterSchemeHouseholds / mogalakwena.households) * 100).toFixed(2)));
  }
});

test("Census electricity-for-lighting map data covers all municipalities at the source reporting years", async () => {
  const expected = new Map([
    ["LIM367", [91.8, 97.2]],
    ["JHB", [90.8, 94.1]],
    ["EKU", [82.2, 93.1]],
    ["TSH", [88.6, 91.8]]
  ]);
  for (const [index, year] of [2011, 2022].entries()) {
    const response = await get(`/api/census/municipalities?year=${year}`);
    assert.equal(response.status, 200);
    const { records } = await response.json();
    assert.equal(records.length, 213);
    for (const [code, values] of expected) {
      assert.equal(records.find((record) => record.censusCode === code)?.electricityLightingSharePercent, values[index]);
    }
  }
});

test("Stats SA provincial GDP-R returns nine provinces, source-linked activity and valid years", async () => {
  for (const year of [2014, 2024]) {
    const response = await get(`/api/economy/provinces?year=${year}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.year, year);
    assert.deepEqual(result.availableYears, [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    assert.equal(result.records.length, 9);
    assert.equal(result.source.publisher, "Statistics South Africa");
    assert.equal(result.source.reportNumber, "P0441.2");
    assert.match(result.source.url, /P044122024\.pdf/);
    assert.equal(result.records.every((record) =>
      Number.isFinite(record.gdpCurrentPricesRandMillions) &&
      Number.isFinite(record.gdpContributionPercent) &&
      Number.isFinite(record.realGdpGrowthPercent) &&
      record.industries.length === 10 &&
      record.industries.every((industry) => Number.isFinite(industry.gvaCurrentPricesRandMillions))
    ), true);
  }
  const latest = await (await get("/api/economy/provinces?year=2024")).json();
  const gauteng = latest.records.find((record) => record.province === "Gauteng");
  assert.equal(gauteng.gdpCurrentPricesRandMillions, 2442020);
  assert.equal(gauteng.gdpContributionPercent, 33.2);
  assert.equal(latest.national.gdpCurrentPricesRandMillions, 7352449);
});

test("provincial GDP-R endpoint rejects unsupported and malformed years", async () => {
  for (const year of ["2013", "2025", "2024abc", "2014.5"]) {
    const response = await get(`/api/economy/provinces?year=${year}`);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /GDP-R reporting year/);
  }
});

test("Census map layers reject unsupported or malformed reporting periods", async () => {
  for (const year of ["2001", "2022abc", "2011.5"]) {
    const response = await get(`/api/census/municipalities?year=${year}`);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /2011 or 2022/);
  }
});

test("unknown geography, unsupported methods and missing static files return explicit errors", async () => {
  assert.equal((await get("/api/geo/ADM9")).status, 404);
  assert.equal((await get("/api/municipalities/%E0%A4%A")).status, 400);
  assert.equal((await get("/not-a-file.js")).status, 404);
  const post = await get("/api/health", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
});

test("the browser application is served with security headers", async () => {
  const response = await get("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const html = await response.text();
  assert.match(html, /National geographic explorer/);
  assert.match(html, /id="indicator-guide"/);
  assert.match(html, /aria-label="Open indicator guide"/);
  assert.match(html, /nav-link-planned[^>]*disabled[^>]*>.*?Roads &amp; transport.*?Planned/);
  assert.doesNotMatch(html, /data-view="(?:reports|history|research|profile|settings|imports)"/);
  assert.doesNotMatch(html, /data-view="(?:national|workspace)"/);
});

test("the stylesheet, browser application and bundled source catalogue are served", async () => {
  const [stylesheet, application, sourceCatalogue, index] = await Promise.all([
    get("/css/app.css"),
    get("/js/app.js"),
    get("/assets/data-sources.json"),
    get("/html/index.html")
  ]);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type"), /text\/css/);
  const stylesheetText = await stylesheet.text();
  assert.match(stylesheetText, /\.nav-link-planned/);
  assert.match(stylesheetText, /\.map-data-table-panel/);
  assert.match(stylesheetText, /\.visually-hidden/);
  assert.match(stylesheetText, /\.retry-button/);
  assert.match(stylesheetText, /\.compare-mobile-card/);
  assert.match(stylesheetText, /\.map-legend-band-rank/);
  assert.match(stylesheetText, /\.leaflet-interactive:focus-visible/);
  assert.equal(application.status, 200);
  assert.match(application.headers.get("content-type"), /javascript/);
  const applicationScript = await application.text();
  assert.match(applicationScript, /project-search-input/);
  assert.match(applicationScript, /compare-share/);
  assert.match(applicationScript, /searchParams\.set\("compare"/);
  assert.match(applicationScript, /indicatorGuideEntries/);
  assert.match(applicationScript, /renderIndicatorGuide/);
  assert.match(applicationScript, /Provincial economy & labour/);
  assert.match(applicationScript, /function renderMapDataTable/);
  assert.match(applicationScript, /Band 1 is lowest and Band 5 is highest/);
  assert.match(applicationScript, /Band \$\{index \+ 1\}/);
  assert.match(applicationScript, /function handleMapRegionKeydown/);
  assert.match(applicationScript, /ArrowRight: 1/);
  assert.match(applicationScript, /Press Enter or Space to open this area/);
  assert.match(applicationScript, /Use the arrow keys to review results/);
  assert.match(applicationScript, /function addDetailError/);
  assert.match(applicationScript, /Retrying…/);
  assert.match(applicationScript, /Retry Census data/);
  assert.match(applicationScript, /function renderMobileComparison/);
  assert.match(applicationScript, /compare-mobile-data/);
  assert.equal(index.status, 200);
  const indexHtml = await index.text();
  assert.match(indexHtml, /role="combobox" aria-autocomplete="list"/);
  assert.match(indexHtml, /map-data-table-toggle/);
  assert.match(indexHtml, /aria-describedby="map-keyboard-instructions"/);
  assert.match(indexHtml, /id="map-keyboard-hint"/);
  assert.match(indexHtml, /aria-live="polite"/);
  assert.equal(sourceCatalogue.status, 200);
  const sources = await sourceCatalogue.json();
  assert.ok(sources.some((source) => source.id === "geoboundaries"));
});

test("live provider routes return source-linked finance, audit and publication records", async () => {
  const treasuryMunicipality = {
    "municipality.demarcation_code": "LIM367",
    "municipality.name": "Mogalakwena",
    "municipality.province_name": "Limpopo",
    "municipality.url": "https://www.mogalakwena.gov.za/"
  };
  const financeRow = {
    "demarcation.code": "LIM367",
    "demarcation.label": "Mogalakwena",
    "financial_year_end.year": 2024,
    "function.code": "1110",
    "function.label": "Mayor and Council",
    "item.code": "1600",
    "item.label": "Operational Revenue",
    "amount_type.code": "AUDA",
    "amount_type.label": "Audited",
    "amount.sum": 123456
  };
  const auditRow = {
    "demarcation.code": "LIM367",
    "demarcation.label": "Mogalakwena",
    "financial_year_end.year": 2024,
    "opinion.label": "Unqualified",
    "opinion.report_url": "http://mfma.treasury.gov.za/reports/2024.pdf"
  };
  const treasurySupplementRows = {
    financial_position_v2: [{
      "item.label": "Cash and cash equivalents",
      "amount_type.code": "AUDA",
      "amount_type.label": "Audited Actual",
      "amount.sum": 500000
    }],
    capital_v2: [{
      "demarcation.code": "LIM367",
      "demarcation.label": "Mogalakwena",
      "financial_year_end.year": 2024,
      "function.code": "3210",
      "function.label": "Water Management",
      "item.code": "8010",
      "item.label": "Water infrastructure",
      "capital_type.code": "NEW",
      "capital_type.label": "New assets",
      "amount_type.code": "AUDA",
      "amount_type.label": "Audited Actual",
      "amount.sum": 250000
    }],
    grants_v2: [{
      "grant.label": "Equitable Share",
      "amount_type.code": "AUDA",
      "amount_type.label": "Audited Actual",
      "amount.sum": 75000
    }],
    repmaint_v2: [{
      "item.label": "Repairs and maintenance",
      "amount_type.code": "AUDA",
      "amount_type.label": "Audited Actual",
      "amount.sum": 12000
    }]
  };
  const climateResponse = {
    properties: {
      parameter: {
        T2M: { JAN: 20, FEB: 21, MAR: 22, APR: 23, MAY: 24, JUN: 25, JUL: 26, AUG: 25, SEP: 24, OCT: 23, NOV: 22, DEC: 21, ANN: 23 },
        PRECTOTCORR: { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 6, SEP: 5, OCT: 4, NOV: 3, DEC: 2, ANN: 4 }
      }
    },
    header: { sources: ["MERRA2"], range: "25-year climatology, January 2001 - December 2025" },
    parameters: { T2M: { units: "C" }, PRECTOTCORR: { units: "mm/day" } }
  };
  const fakeFetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/api/cubes") {
      return Response.json({ status: "ok", data: [{ name: "incexp_v2" }, { name: "audit_opinions" }] });
    }
    if (url.pathname.endsWith("/members/municipality")) {
      return Response.json({ status: "ok", data: [treasuryMunicipality] });
    }
    if (url.pathname.endsWith("/incexp_v2/aggregate")) {
      return Response.json({ status: "ok", total_cell_count: 1, cells: [financeRow] });
    }
    for (const [cube, rows] of Object.entries(treasurySupplementRows)) {
      if (url.pathname.endsWith(`/${cube}/aggregate`)) {
        return Response.json({ status: "ok", total_cell_count: rows.length, cells: rows });
      }
    }
    if (url.pathname.endsWith("/uifwexp/facts")) {
      return Response.json({
        status: "ok",
        total_fact_count: 1,
        data: [{ "demarcation.code": "LIM367", "financial_year_end.year": 2024, "item.label": "Irregular expenditure", amount: 3000 }]
      });
    }
    if (url.pathname.endsWith("/audit_opinions/facts")) {
      return Response.json({ status: "ok", data: [auditRow] });
    }
    if (url.hostname === "power.larc.nasa.gov") return Response.json(climateResponse);
    if (url.hostname === "api.worldbank.org") {
      const code = url.pathname.split("/").at(-1);
      const values = {
        "NY.GDP.MKTP.CD": [{ date: "2024", value: 401144998373.585 }, { date: "2025", value: 427184325997.307 }],
        "NY.GDP.MKTP.KD.ZG": [{ date: "2024", value: 0.5 }],
        "NV.AGR.TOTL.ZS": [{ date: "2024", value: 2.5 }],
        "NV.IND.TOTL.ZS": [{ date: "2024", value: 24.2 }],
        "NV.SRV.TOTL.ZS": [{ date: "2024", value: 63.1 }]
      };
      return Response.json([{ page: 1, total: 1 }, values[code] ?? []]);
    }
    if (url.pathname.endsWith("/wp/v2/posts")) {
      return Response.json([{
        id: 8,
        date: "2025-01-15T08:30:00",
        link: "https://sacities.net/publication/example/",
        title: { rendered: "<p>Example publication</p>" },
        excerpt: { rendered: "<p>Original publisher summary</p>" }
      }]);
    }
    throw new Error(`Unexpected provider URL: ${url}`);
  };
  const providerServer = await createAppServer({ fetchImpl: fakeFetch });
  await new Promise((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
  const providerUrl = `http://127.0.0.1:${providerServer.address().port}`;
  try {
    const municipalities = await fetch(`${providerUrl}/api/municipalities?q=Mogalakwena`).then((response) => response.json());
    const mogalakwena = municipalities.municipalities.find((item) => item.name === "Mogalakwena");
    const [financeResponse, auditResponse, projectsResponse, documentsResponse, publicationsResponse, integrationsResponse, climateFetchResponse, economyResponse] = await Promise.all([
      fetch(`${providerUrl}/api/municipalities/${encodeURIComponent(mogalakwena.id)}/finance?year=2024`),
      fetch(`${providerUrl}/api/municipalities/${encodeURIComponent(mogalakwena.id)}/audit?year=2024`),
      fetch(`${providerUrl}/api/municipalities/${encodeURIComponent(mogalakwena.id)}/projects?year=2024`),
      fetch(`${providerUrl}/api/municipalities/${encodeURIComponent(mogalakwena.id)}/documents`),
      fetch(`${providerUrl}/api/publications/sacn?limit=1`),
      fetch(`${providerUrl}/api/integrations`),
      fetch(`${providerUrl}/api/geographies/ADM3/${encodeURIComponent(mogalakwena.id)}/climate`),
      fetch(`${providerUrl}/api/economy/national`)
    ]);
    assert.equal(financeResponse.status, 200);
    const finance = await financeResponse.json();
    assert.deepEqual(finance.rows, [financeRow]);
    assert.deepEqual(finance.supplemental.financialPosition.rows, treasurySupplementRows.financial_position_v2);
    assert.deepEqual(finance.supplemental.capital.rows, treasurySupplementRows.capital_v2);
    assert.deepEqual(finance.supplemental.grants.rows, treasurySupplementRows.grants_v2);
    assert.deepEqual(finance.supplemental.repairsMaintenance.rows, treasurySupplementRows.repmaint_v2);
    assert.equal(finance.supplemental.uifw.rows[0].amount, 3000);
    assert.equal(auditResponse.status, 200);
    assert.equal((await auditResponse.json()).rows[0].opinion, "Unqualified");
    assert.equal(projectsResponse.status, 200);
    const projects = await projectsResponse.json();
    assert.equal(projects.year, 2024);
    assert.equal(projects.treasuryMunicipality.code, "LIM367");
    assert.equal(projects.rows.length, 1);
    assert.equal(projects.rows[0]["amount.sum"], 250000);
    assert.match(projects.source.note, /do not identify individual project names/);
    assert.match(projects.source.apiUrl, /capital_v2\/aggregate/);
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.equal(documents.officialMunicipalWebsite, "https://www.mogalakwena.gov.za/");
    assert.equal(documents.auditRecords[0].year, 2024);
    assert.equal(documents.auditRecords[0].opinion, "Unqualified");
    assert.equal(documents.auditRecords[0].reportUrl, "http://mfma.treasury.gov.za/reports/2024.pdf");
    assert.equal(publicationsResponse.status, 200);
    const publications = await publicationsResponse.json();
    assert.equal(publications.publications[0].title, "Example publication");
    assert.equal(publications.publications[0].summary, "Original publisher summary");
    assert.equal(climateFetchResponse.status, 200);
    const climate = await climateFetchResponse.json();
    assert.equal(climate.geography.name, "Mogalakwena");
    assert.equal(climate.geography.level, "ADM3");
    assert.equal(climate.monthly.length, 12);
    assert.equal(climate.annual.temperatureC, 23);
    assert.equal(climate.annual.precipitationMmPerDay, 4);
    assert.equal(climate.source.publisher, "NASA Langley Research Center · POWER");
    assert.match(climate.source.period, /January 2001/);
    assert.equal(economyResponse.status, 200);
    const economy = await economyResponse.json();
    assert.equal(economy.country, "South Africa");
    assert.equal(economy.geographyLevel, "National");
    assert.equal(economy.indicators.length, 5);
    assert.equal(economy.indicators.find((indicator) => indicator.key === "gdpCurrentUsd").values.at(-1).value, 427184325997.307);
    assert.equal(economy.indicators.find((indicator) => indicator.key === "servicesShare").values[0].value, 63.1);
    assert.match(economy.source.note, /not provincial or municipal/);
    assert.equal(integrationsResponse.status, 200);
    const { integrations } = await integrationsResponse.json();
    assert.equal(integrations.find((source) => source.id === "treasury").status, "connected");
    assert.equal(integrations.find((source) => source.id === "agsa").status, "connected-via-treasury");
    assert.equal(integrations.find((source) => source.id === "sacn").status, "connected");
    assert.equal(integrations.find((source) => source.id === "stats-sa").status, "loaded");
    assert.equal(integrations.find((source) => source.id === "stats-sa-qlfs").status, "loaded");
    assert.equal(integrations.find((source) => source.id === "nasa-power").status, "connected");
    assert.equal(integrations.find((source) => source.id === "world-bank-wdi").status, "connected");
  } finally {
    await new Promise((resolve, reject) =>
      providerServer.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("data availability and administrative routes fail closed without configuration", async () => {
  const serverWithoutStorage = await createAppServer({ dataStore: null, adminToken: null });
  await new Promise((resolve) => serverWithoutStorage.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${serverWithoutStorage.address().port}`;
  try {
    const availability = await fetch(`${url}/api/data/availability`);
    assert.equal(availability.status, 200);
    assert.deepEqual(await availability.json(), { storage: "not_configured", datasets: [] });

    const imports = await fetch(`${url}/api/admin/imports`);
    assert.equal(imports.status, 503);
    assert.equal((await imports.json()).code, "ADMIN_NOT_CONFIGURED");

    const trigger = await fetch(`${url}/api/admin/imports/treasury`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ municipalityCode: "LIM367", year: 2024 })
    });
    assert.equal(trigger.status, 503);
    assert.equal((await trigger.json()).code, "ADMIN_NOT_CONFIGURED");
  } finally {
    await new Promise((resolve, reject) =>
      serverWithoutStorage.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("administrative endpoints rate limit repeated attempts", async () => {
  const adminToken = "civicstats-test-admin-token-0123456789";
  const rateLimitServer = await createAppServer({ dataStore: null, adminToken });
  await new Promise((resolve) => rateLimitServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${rateLimitServer.address().port}`;
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(`${url}/api/admin/imports`);
      assert.equal(response.status, 401);
    }
    const limited = await fetch(`${url}/api/admin/imports`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "900");
    assert.equal((await limited.json()).code, "ADMIN_RATE_LIMITED");
  } finally {
    await new Promise((resolve, reject) =>
      rateLimitServer.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("Treasury imports are queued durably and worker results remain awaiting administrator review", async () => {
  const adminToken = "civicstats-test-admin-token-0123456789";
  const treasuryMunicipality = {
    "municipality.demarcation_code": "LIM367",
    "municipality.name": "Mogalakwena",
    "municipality.province_name": "Limpopo"
  };
  const treasuryRow = {
    "demarcation.code": "LIM367",
    "demarcation.label": "Mogalakwena",
    "financial_year_end.year": 2024,
    "item.code": "1600",
    "item.label": "Operational Revenue",
    "amount.sum": 123456
  };
  let persistedInput;
  let queuedPayload;
  let completedQueueImport;
  let approvalId;
  const queueId = "2e9e9abf-3954-4a44-910e-4559a4c380ee";
  const dataStore = {
    async enqueueImport(payload) {
      queuedPayload = payload;
      return { queue_id: queueId, status: "queued", attempt_count: 0, duplicate: false };
    },
    async claimQueuedImport(workerId) {
      assert.equal(workerId, "test-worker");
      return {
        queue_id: queueId,
        payload: queuedPayload,
        attempt_count: 1,
        max_attempts: 3
      };
    },
    async completeQueuedImport(importQueueId, workerId, importId) {
      completedQueueImport = { importQueueId, workerId, importId };
    },
    async failQueuedImport() {
      throw new Error("The test import should not fail.");
    },
    async persistImport(input) {
      persistedInput = input;
      return {
        import_id: 17,
        status: "awaiting_review",
        records_retrieved: input.records.length,
        records_accepted: input.records.length,
        records_rejected: 0,
        duplicate: false
      };
    },
    async listQueuedImports(limit) {
      assert.equal(limit, 5);
      return [{ queue_id: queueId, status: "succeeded" }];
    },
    async getQueuedImport(importQueueId) {
      assert.equal(importQueueId, queueId);
      return { queue_id: queueId, status: "succeeded" };
    },
    async logFailedImport() {},
    async listImports(limit) {
      assert.equal(limit, 5);
      return [{ import_id: 17, status: "awaiting_review" }];
    },
    async getImport(importId, options) {
      assert.equal(importId, 17);
      assert.deepEqual(options, { limit: 10, offset: 0 });
      return {
        import: { import_id: importId, status: "awaiting_review" },
        records: [{ raw_record_id: 1 }],
        recordCount: 1,
        qualityIssues: [],
        qualityIssueCount: 0
      };
    },
    async approveImport(importId) {
      approvalId = importId;
      return { import_id: importId, status: "approved" };
    },
    async rejectImport(importId, reason) {
      assert.equal(importId, 18);
      assert.equal(reason, "Source records did not pass review.");
      return { import_id: importId, status: "rejected", duplicate: false };
    }
  };
  const fakeFetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/members/municipality")) {
      return Response.json({ status: "ok", data: [treasuryMunicipality] });
    }
    if (url.pathname.endsWith("/aggregate")) {
      return Response.json({ status: "ok", total_cell_count: 1, cells: [treasuryRow] });
    }
    if (url.pathname.endsWith("/uifwexp/facts")) {
      return Response.json({
        status: "ok",
        total_fact_count: 1,
        data: [{
          "demarcation.code": "LIM367",
          "financial_year_end.year": 2024,
          "item.label": "Irregular expenditure",
          amount: 3000
        }]
      });
    }
    throw new Error(`Unexpected provider URL: ${url}`);
  };
  const importServer = await createAppServer({ fetchImpl: fakeFetch, dataStore, adminToken });
  await new Promise((resolve) => importServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${importServer.address().port}`;
  try {
    const unauthorized = await fetch(`${url}/api/admin/imports/treasury`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong-token" },
      body: JSON.stringify({ municipalityCode: "LIM367", year: 2024 })
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(persistedInput, undefined);

    const trigger = await fetch(`${url}/api/admin/imports/treasury`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ municipalityCode: "LIM367", year: 2024 })
    });
    assert.equal(trigger.status, 202);
    const queued = await trigger.json();
    assert.equal(queued.status, "queued");
    assert.equal(queued.queue_id, queueId);
    assert.deepEqual(queuedPayload, { municipalityCode: "LIM367", year: 2024 });

    const processor = await createTreasuryImportProcessor({ fetchImpl: fakeFetch, dataStore });
    assert.equal(await processQueuedImportOnce({
      dataStore,
      processImport: processor,
      workerId: "test-worker"
    }), true);
    assert.deepEqual(completedQueueImport, {
      importQueueId: queueId,
      workerId: "test-worker",
      importId: 17
    });
    assert.equal(persistedInput.datasetId, "national-treasury-municipal-finance");
    assert.equal(persistedInput.municipalityCode, "LIM367");
    assert.equal(persistedInput.sourceCode, "LIM367");
    assert.equal(persistedInput.reportingPeriod, "2024");
    assert.equal(persistedInput.unit, "ZAR");
    assert.equal(persistedInput.records.length, 6);
    assert.deepEqual(persistedInput.issues, []);
    assert.ok(persistedInput.records.every((record) => record.sourceUrl.startsWith("https://")));

    const imports = await fetch(`${url}/api/admin/imports?limit=5`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(imports.status, 200);
    assert.equal((await imports.json()).imports[0].import_id, 17);

    const queue = await fetch(`${url}/api/admin/import-queue?limit=5`, {
      headers: { authorization: ["Bearer", adminToken].join(" ") }
    });
    assert.equal(queue.status, 200);
    assert.equal((await queue.json()).jobs[0].queue_id, queueId);

    const queueStatus = await fetch(`${url}/api/admin/import-queue/${queueId}`, {
      headers: { authorization: ["Bearer", adminToken].join(" ") }
    });
    assert.equal(queueStatus.status, 200);
    assert.equal((await queueStatus.json()).job.status, "succeeded");

    const detail = await fetch(`${url}/api/admin/imports/17?limit=10&offset=0`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).recordCount, 1);

    const approval = await fetch(`${url}/api/admin/imports/17/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(approval.status, 200);
    assert.equal((await approval.json()).status, "approved");
    assert.equal(approvalId, 17);

    const rejection = await fetch(`${url}/api/admin/imports/18/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: "Source records did not pass review." })
    });
    assert.equal(rejection.status, 200);
    assert.equal((await rejection.json()).status, "rejected");
  } finally {
    await new Promise((resolve, reject) =>
      importServer.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("central Treasury API exposes only published records from the data store", async () => {
  const dataStore = {
    async getTreasuryRecords(municipalityCode, reportingPeriod) {
      assert.equal(municipalityCode, "LIM367");
      assert.equal(reportingPeriod, "2024");
      return {
        dataset: {
          validation_status: "verified",
          publication_status: "published",
          source_url: "https://municipaldata.treasury.gov.za/docs"
        },
        latestImport: { status: "approved" },
        records: [{
          record_id: 3,
          source_record: { category: "income_expenditure", "amount.sum": 123456 },
          source_url: "https://municipaldata.treasury.gov.za/api/cubes/incexp_v2"
        }]
      };
    }
  };
  const dataServer = await createAppServer({ dataStore, adminToken: null });
  await new Promise((resolve) => dataServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${dataServer.address().port}`;
  try {
    const response = await fetch(`${url}/api/data/municipalities/LIM367/treasury?year=2024`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.available, true);
    assert.equal(result.validationStatus, "verified");
    assert.equal(result.publicationStatus, "published");
    assert.equal(result.records[0].source_record["amount.sum"], 123456);
  } finally {
    await new Promise((resolve, reject) =>
      dataServer.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("background worker records failed attempts for durable retry", async () => {
  const queueId = "2e9e9abf-3954-4a44-910e-4559a4c380ee";
  let failure;
  const dataStore = {
    async claimQueuedImport(workerId) {
      assert.equal(workerId, "retry-worker");
      return {
        queue_id: queueId,
        payload: { municipalityCode: "LIM367", year: 2024 },
        attempt_count: 1,
        max_attempts: 3
      };
    },
    async failQueuedImport(importQueueId, workerId, message) {
      failure = { importQueueId, workerId, message };
      return {
        queue_id: importQueueId,
        status: "retrying",
        attempt_count: 1,
        max_attempts: 3
      };
    },
    async completeQueuedImport() {
      throw new Error("Failed jobs must not be completed.");
    }
  };
  assert.equal(await processQueuedImportOnce({
    dataStore,
    processImport: async () => { throw new Error("Treasury is temporarily unavailable."); },
    workerId: "retry-worker"
  }), true);
  assert.deepEqual(failure, {
    importQueueId: queueId,
    workerId: "retry-worker",
    message: "Treasury is temporarily unavailable."
  });
});

test("capital acquisition rejects invalid years and non-municipality references", async () => {
  const { municipalities } = await get("/api/municipalities").then((response) => response.json());
  const johannesburg = municipalities.find((item) => item.name === "City of Johannesburg");
  const invalidYear = await get(`/api/municipalities/${encodeURIComponent(johannesburg.id)}/projects?year=2018`);
  assert.equal(invalidYear.status, 400);
  assert.match((await invalidYear.json()).error, /2019 through the current year/);

  const provinces = await get("/api/geo/ADM1").then((response) => response.json());
  const provinceId = provinces.features[0].properties.shapeID;
  const wrongLevel = await get(`/api/municipalities/${encodeURIComponent(provinceId)}/projects?year=2024`);
  assert.equal(wrongLevel.status, 404);
  assert.match((await wrongLevel.json()).error, /Municipality not found/);
});

test("named project API returns bounded, sanitized source records and rejects unsupported years", async () => {
  const urls = [];
  const projectServer = await createAppServer({
    dataStore: null,
    adminToken: null,
    fetchImpl: async (input) => {
      const url = new URL(input);
      urls.push(url);
      assert.equal(url.origin, "https://municipalmoney.gov.za");
      return Response.json({
        count: 1,
        next: null,
        results: { projects: [{
          id: 123,
          project_description: "Water pipeline upgrade",
          project_number: "WTR-1",
          project_type: "Upgrading",
          function: "Water Management",
          ward_location: "Ward 4",
          financial_year: "2023/2024",
          geography: { contact: "private@example.test", address: "private address" },
          expenditure: [{ amount: "1200.50", financial_year: { budget_year: "2023/2024" }, budget_phase: { name: "Adjusted Budget" } }]
        }] }
      });
    }
  });
  await new Promise((resolve) => projectServer.listen(0, "127.0.0.1", resolve));
  const projectUrl = `http://127.0.0.1:${projectServer.address().port}`;
  try {
    const { municipalities } = await fetch(`${projectUrl}/api/municipalities`).then((response) => response.json());
    const johannesburg = municipalities.find((item) => item.name === "City of Johannesburg");
    const unsupported = await fetch(`${projectUrl}/api/municipalities/${encodeURIComponent(johannesburg.id)}/named-projects?year=2026/2027`);
    assert.equal(unsupported.status, 400);
    assert.equal(urls.length, 0);

    const response = await fetch(`${projectUrl}/api/municipalities/${encodeURIComponent(johannesburg.id)}/named-projects?year=2023/2024`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.projects.length, 1);
    assert.equal(result.projects[0].name, "Water pipeline upgrade");
    assert.deepEqual(result.projects[0].expenditure[0], {
      amount: 1200.5,
      financialYear: "2023/2024",
      budgetPhase: "Adjusted Budget"
    });
    assert.doesNotMatch(JSON.stringify(result), /private@example|private address/);
    assert.equal(urls[0].searchParams.get("municipality"), "City of Johannesburg");
    assert.equal(urls[0].searchParams.get("financial_year"), "2023/2024");
  } finally {
    await new Promise((resolve, reject) => projectServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("provincial unemployment API returns complete source-linked Stats SA QLFS periods", async () => {
  const response = await get("/api/labour/provinces");
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.totalProvinces, 9);
  assert.equal(result.periods.at(-1).code, "2026Q3");
  assert.equal(result.records.length, 27);
  assert.equal(result.source.publisher, "Statistics South Africa");
  assert.equal(result.source.title, "Quarterly Labour Force Survey, Quarter 3: 2026");
  assert.equal(result.source.releaseDate, "2026-11-10");
  assert.match(result.source.sourceUrl, /P02113rdQuarter2026\.pdf/);

  const latest = result.records.filter((record) => record.quarter === "2026Q3");
  assert.equal(latest.length, 9);
  assert.equal(latest.find((record) => record.province === "Eastern Cape").officialRate, 44.3);
  assert.equal(latest.find((record) => record.province === "Eastern Cape").lu3Rate, 51.8);
  assert.equal(latest.find((record) => record.province === "Western Cape").officialRate, 19.4);
  assert.ok(latest.every((record) =>
    Number.isFinite(record.officialRate) && Number.isFinite(record.lu3Rate)
  ));
});

test("provider failures are reported without substituting successful-looking data", async () => {
  const providerServer = await createAppServer({
    fetchImpl: async () => { throw new Error("provider offline"); }
  });
  await new Promise((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
  const providerUrl = `http://127.0.0.1:${providerServer.address().port}`;
  try {
    const municipalities = await fetch(`${providerUrl}/api/municipalities?q=Mogalakwena`).then((response) => response.json());
    const mogalakwena = municipalities.municipalities.find((item) => item.name === "Mogalakwena");
    const response = await fetch(`${providerUrl}/api/municipalities/${encodeURIComponent(mogalakwena.id)}/finance?year=2024`);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.code, "PROVIDER_UNAVAILABLE");
    assert.match(body.error, /provider offline/);
    assert.equal(body.rows, undefined);
    const economyResponse = await fetch(`${providerUrl}/api/economy/national`);
    assert.equal(economyResponse.status, 502);
    assert.equal((await economyResponse.json()).code, "PROVIDER_UNAVAILABLE");
  } finally {
    await new Promise((resolve, reject) =>
      providerServer.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("Live Server CORS is restricted to the configured local origin", async () => {
  const allowed = await get("/api/integrations", {
    method: "OPTIONS",
    headers: { origin: "http://127.0.0.1:5500" }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://127.0.0.1:5500");

  const denied = await get("/api/integrations", {
    method: "OPTIONS",
    headers: { origin: "https://example.com" }
  });
  assert.equal(denied.status, 204);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});
