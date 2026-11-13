const state = {
  view: "dashboard",
  tab: "overview",
  boundaryLevel: "ADM3",
  autoBoundaryDetail: true,
  autoBoundaryReady: false,
  autoBoundaryRequest: null,
  mapLayer: "population",
  overviewLevel: "national",
  mapDetailMode: false,
  mapHoverPreviews: true,
  mapDataTableOpen: false,
  mapRovingId: null,
  censusMapRecords: new Map(),
  censusMapAggregates: new Map(),
  censusMapYear: 2022,
  censusMapRequestId: 0,
  censusMapError: null,
  censusMapLoading: false,
  populationGrowthLayerAvailable: false,
  provincialEconomyData: null,
  economyMapYear: 2024,
  economyMapRequestId: 0,
  economyMapError: null,
  economyMapLoading: false,
  economyLoadPromise: null,
  economyLoadYear: null,
  nationalEconomyData: null,
  nationalEconomyError: null,
  nationalEconomyLoading: false,
  nationalCensusPopulation2022: null,
  nationalCensusPopulationLoading: false,
  nationalCensusPopulationError: null,
  nationalGdpHistory: null,
  nationalGdpHistoryLoading: false,
  nationalGdpHistoryError: null,
  labourData: null,
  labourLoadPromise: null,
  labourMapRecords: new Map(),
  labourQuarter: "2026Q3",
  labourMapError: null,
  labourMapLoading: false,
  climateMapRecords: new Map(),
  climateMapPromise: null,
  climateMapError: null,
  climateMapLoading: false,
  airQualityStations: [],
  airQualityLoading: false,
  airQualityError: null,
  airQualityPromise: null,
  airQualityCheckedAt: null,
  airQualityMetadata: null,
  airQualityLayer: null,
  labourProfileRequestId: 0,
  selected: null,
  municipalities: [],
  sources: [],
  integrations: [],
  integrationError: null,
  publications: [],
  publicationError: null,
  publicationsLoaded: false,
  financeYear: 2024,
  financeType: "AUDA",
  financeRequestId: 0,
  politicsRequestId: 0,
  politicsAuditYear: 2024,
  documentsProjectsPane: "documents",
  documentsProjectsRequestId: 0,
  projectsYear: 2024,
  projectsAmountType: "AUDA",
  economyRequestId: 0,
  climateRequestId: 0,
  censusYear: 2022,
  censusRequestId: 0,
  censusCache: new Map(),
  censusRequests: new Map(),
  staticDataPromise: null,
  overviewCensusRequestId: 0,
  profileSummaryRequestId: 0,
  comparisonRequestId: 0,
  comparisonErrors: new Map(),
  comparisonScales: null,
  comparisonScalesPromise: null,
  comparisonScalesError: false,
  comparisonReferenceId: null,
  collections: new Map(),
  geographies: [],
  comparisonMode: false,
  comparisonSelections: [],
  searchMatches: [],
  searchActiveIndex: -1,
  searchGeneration: 0,
  searchDebounceTimer: null,
  selectionLayer: null,
  nationalProvinceBordersLayer: null,
  nationalOutlineLayer: null,
  nationalOutlineCollection: null,
  hoveredMapGeographyId: null,
  nationalBounds: null,
  mapResizeObserver: null,
  map: null,
  boundaryLayer: null,
  toastTimer: null
};
let provinceCensus2022Promise = null;
let nationalCensus2022Promise = null;

const indicatorGuideEntries = [
  { name: "Population", category: "Demographics", definition: "The number of people counted for a municipality in the relevant Census. It is a count, not a current population estimate.", period: "Census 2011 and 2022", source: "Statistics South Africa · Census", caveat: "Census figures describe their census dates; they are not updated between censuses." },
  { name: "Basic services pilot score", category: "Municipal services", definition: "An equal-weighted arithmetic mean of three Census 2022 household shares: reporting a water-scheme source, a flush toilet, and electricity as the main lighting source. All three verified source values are required.", period: "Census 2022", source: "Statistics South Africa · municipal Census profile and electricity lighting fact sheet", caveat: "Equal weights are a transparent pilot choice. This describes 2022 household reports, not current service quality, continuity, council responsibility or overall municipal performance." },
  { name: "Households", category: "Demographics", definition: "The Census count of households in the municipality. Household totals are separate from the population count.", period: "Census 2011 and 2022", source: "Statistics South Africa · Census", caveat: "Do not compare a household count with a population count as if they were the same unit." },
  { name: "Average household size", category: "Demographics", definition: "The average number of people per household in the source period.", period: "Census 2022", source: "Statistics South Africa · Census", caveat: "An average can hide differences between households and neighbourhoods." },
  { name: "Sex ratio", category: "Demographics", definition: "The sex-ratio value reported in the source Census table for this area and year.", period: "Census 2011 and 2022 where supplied", source: "Statistics South Africa · Census", caveat: "This is a source-reported ratio; consult the original table for its exact denominator and method." },
  { name: "Population growth", category: "Demographics", definition: "The reported change in population between the 2011 and 2022 Census records.", period: "2011–2022", source: "Statistics South Africa · Census", caveat: "This is a historical, inter-censal measure, not a forecast or current annual growth rate." },
  { name: "Age and school attendance", category: "Demographics", definition: "Counts for source-defined age bands and people aged 5–24 recorded as attending school.", period: "Census 2022", source: "Statistics South Africa · Census", caveat: "Use the age range and Census year shown with each value." },
  { name: "Water scheme household share", category: "Household services", definition: "The share of households reporting the source’s water-scheme category, calculated from the reported household count and total households.", period: "Census 2011 and 2022", source: "Statistics South Africa · Census", caveat: "This household response does not measure current supply continuity, water quality or pressure." },
  { name: "Flush toilet household share", category: "Household services", definition: "The share of households in the source’s flush-toilet category, calculated from the reported count and total households.", period: "Census 2011 and 2022", source: "Statistics South Africa · Census", caveat: "It describes the reported household facility category, not whether a facility is working today." },
  { name: "Electricity for cooking", category: "Household services", definition: "The share of households reporting electricity as their main cooking energy source.", period: "Census 2011 and 2022 where available", source: "Statistics South Africa · Census", caveat: "Cooking energy is different from electricity access, connection status or reliable supply." },
  { name: "Electricity for lighting", category: "Household services", definition: "The share of households reporting electricity as their main source of energy for lighting.", period: "Stats SA municipal fact sheets · 2011 and 2022", source: "Statistics South Africa", caveat: "It is not a measure of grid connection, availability or load-shedding reliability." },
  { name: "Water interruptions", category: "Household services", definition: "Historical household-reported service interruption measures in the Stats SA service-delivery publication.", period: "2011 and 2022 source periods", source: "Statistics South Africa · service-delivery report", caveat: "These are historical survey measures, not live municipal outage monitoring." },
  { name: "Official unemployment rate", category: "Labour", definition: "Unemployed people as a share of the labour force under the official QLFS definition.", period: "Quarterly; the selected quarter is shown", source: "Statistics South Africa · Quarterly Labour Force Survey", caveat: "CivicStats has province-level estimates only. They must not be read as municipality rates." },
  { name: "Expanded unemployment (LU3)", category: "Labour", definition: "The share of the expanded labour force that is unemployed or belongs to the potential labour force under Stats SA’s LU3 definition.", period: "Quarterly; the selected quarter is shown", source: "Statistics South Africa · Quarterly Labour Force Survey", caveat: "This is a different measure from the official unemployment rate and is also province-level here." },
  { name: "GDP-R and industry activity", category: "Economy", definition: "Regional gross domestic product and gross value added by published industry. Current-price values are nominal; constant-price growth is adjusted for prices.", period: "Annual; year selector shows the period", source: "Statistics South Africa · GDP-R (P0441.2)", caveat: "The source is province-level. CivicStats does not infer municipal GDP or industry output." },
  { name: "Municipal finance line items", category: "Municipal finance", definition: "Municipality-reported revenue and expenditure categories from National Treasury’s municipal finance data.", period: "Financial year and record type are shown", source: "National Treasury · Municipal Money", caveat: "Budget, adjusted budget and audited actual are distinct record types. These are municipal accounts, not local GDP or household income." },
  { name: "Capital acquisition categories", category: "Municipal finance", definition: "Section 71 capital-asset spending grouped by accounting and functional categories.", period: "Financial year and record type are shown", source: "National Treasury · Municipal Money", caveat: "These rows are not a named-project list and do not identify each project’s schedule or contractor." },
  { name: "Audit opinion", category: "Governance", definition: "The audit outcome recorded for the municipality and financial year, with a report link when the source provides one.", period: "Financial year ending shown per record", source: "Auditor-General South Africa via National Treasury", caveat: "A missing record or report link is not evidence of a clean audit or that no audit occurred." },
  { name: "Council seats", category: "Governance", definition: "Party seat counts in the dated municipal council snapshot, with ward and proportional-representation seats kept separate.", period: "IEC 2021 election snapshot", source: "Electoral Commission of South Africa", caveat: "The 2021 snapshot is not a current 2026 council result." },
  { name: "Climate normals", category: "Climate", definition: "Long-run temperature and precipitation climatology for a representative point in the selected geography.", period: "The displayed climatology date range accompanies the result", source: "NASA POWER", caveat: "These are gridded climate normals, not a local weather forecast or a measurement at every point in the municipality." },
  { name: "Named infrastructure projects", category: "Projects", definition: "Project descriptions, source classifications and expenditure phases published in the Municipal Money project register.", period: "Selected financial years from 2017/2018 through 2023/2024", source: "National Treasury and OpenUp · Municipal Money", caveat: "The source reports completeness checks in progress. A project type such as “New” is not proof that work is complete." },
  { name: "National economic indicators", category: "Economy", definition: "South Africa-wide indicators such as GDP and sector value added shown for their latest available source years.", period: "Latest available year is shown per indicator", source: "World Bank · World Development Indicators", caveat: "These are national figures, not provincial or municipal estimates." },
  { name: "Calculated area", category: "Geography", definition: "Approximate area calculated from the displayed administrative boundary polygon.", period: "Boundary vintage 2020", source: "geoBoundaries · ADM3", caveat: "This is a geometric calculation, not an official land-survey area." }
];

const tabContent = {
  overview: {
    kicker: "OVERVIEW",
    title: "At a glance",
    intro: "Explore this geography alongside the latest source-linked population and provincial labour indicators.",
    fields: [
      ["Province", "province"],
      ["District", "district"],
      ["Boundary level", "level"],
      ["Municipal classification", "classification"],
      ["Official municipal code", "code"],
      ["Municipal seat", "seat"],
      ["Calculated area", "area"],
      ["Source vintage", "vintage"]
    ]
  },
  demographics: {
    kicker: "DEMOGRAPHICS",
    title: "Population & households",
    description: "Population, household, age and gender statistics for this geography.",
    source: "Statistics South Africa · Census"
  },
  politics: {
    kicker: "POLITICS & GOVERNANCE",
    title: "Representation & oversight",
    description: "Council composition, election results and dated governance information.",
    source: "IEC / official municipal publications"
  },
  finance: {
    kicker: "MUNICIPAL FINANCE",
    title: "Budget & financial performance",
    description: "Budgeted and audited revenue, expenditure, debt and audit outcomes.",
    source: "National Treasury · Municipal Finance"
  },
  climate: {
    kicker: "CLIMATE & ENVIRONMENT",
    title: "Climate indicators",
    description: "Historical rainfall, temperature and environmental observations.",
    source: "Verified public climate datasets"
  },
  services: {
    kicker: "SERVICE DELIVERY",
    title: "Infrastructure & access",
    description: "Census household indicators for water, sanitation, cooking energy and electricity as the main lighting source.",
    source: "Statistics South Africa · Census"
  },
  economy: {
    kicker: "REGIONAL ECONOMY",
    title: "Provincial economy & labour",
    description: "Stats SA GDP-R and QLFS are province-level measures. Municipal Treasury accounts are shown as financial flows, not local GDP or employment estimates.",
    source: "Statistics South Africa · GDP-R / QLFS / National Treasury"
  },
  documents: {
    kicker: "DOCUMENTS & PROJECTS",
    title: "Municipal documents & capital activity",
    description: "Municipal audit reports, official document portals and source-reported capital acquisition records.",
    source: "National Treasury · Municipal Money / official municipal sources"
  }
};

const viewCopy = {
  dashboard: ["National overview", "A geographic view of South Africa's municipalities"],
  national: ["National overview", "Explore all nine provinces and municipal boundaries"],
  workspace: ["Workspace", "Explore public geographies and source-linked indicators"],
  municipalities: ["Municipalities", "Browse all municipalities represented in the boundary dataset"],
  comparisons: ["Municipal comparisons", "Compare municipalities without ranking incompatible or missing data"],
  sources: ["Data sources", "Review provenance, licensing and current data coverage"],
  reports: ["Reports", "Public reports will appear here after verified documents are catalogued"],
  history: ["Historical data", "Historical comparisons require dated source datasets"],
  research: ["Research", "Research collections will appear when source material is catalogued"],
  imports: ["Data imports", "Treasury manual imports are available through the authenticated API; the data-management dashboard is not built"],
  profile: ["User profile", "No account data is collected by this prototype"],
  settings: ["Settings", "Workspace settings are not available in this read-only prototype"]
};

const mapElement = document.querySelector("#map");
const appRoot = new URL("../", document.currentScript.src);
const staticDeployment = location.hostname !== "localhost" &&
  location.hostname !== "127.0.0.1" &&
  location.port !== "5500" &&
  location.port !== "3000" &&
  !location.hostname.endsWith(".onrender.com");
const apiOrigin = location.port === "5500"
  ? `${location.protocol}//127.0.0.1:3000`
  : location.origin;
const profileName = document.querySelector("#profile-name");
const profileLocation = document.querySelector("#profile-location");
const detailBody = document.querySelector("#detail-body");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#global-search");
const searchResults = document.querySelector("#search-results");
const searchStatus = document.querySelector("#search-status");
const searchClear = document.querySelector("#clear-search");
const sectionTabs = document.querySelector("#section-tabs");
const workspaceGrid = document.querySelector("#workspace-grid");
const alternateView = document.querySelector("#alternate-view");
const comparisonWorkspace = document.querySelector("#comparison-workspace");

async function getJson(url) {
  if (staticDeployment) return getStaticApiResponse(url);
  try {
    const response = await fetch(new URL(url, apiOrigin), { headers: { accept: "application/json" } });
    if (!response.ok) {
      if (response.status === 404) return getStaticApiResponse(url);
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status}).`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError) return getStaticApiResponse(url);
    throw error;
  }
}

function parseBundledCsv(text, filename) {
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
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error(`Bundled dataset ${filename} has an unterminated quoted field.`);
  if (field !== "" || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (rows.length < 2) throw new Error(`Bundled dataset ${filename} has no data rows.`);
  const headers = rows[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error(`Bundled dataset ${filename} has invalid or duplicate columns.`);
  }
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`Bundled dataset ${filename} row ${rowIndex + 2} has an unexpected number of columns.`);
    }
    return Object.fromEntries(headers.map((header, column) => {
      const value = values[column].trim();
      const numeric = value === "" ? null : Number(value);
      return [header, value !== "" && Number.isFinite(numeric) ? numeric : value || null];
    }));
  });
}

function normalizeStaticName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/\b(local|district|metropolitan)?\s*municipality\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalProvinceName(value) {
  return normalizeStaticName(value) === "nothern cape" ? "Northern Cape" : value;
}

async function loadStaticData() {
  if (state.staticDataPromise) return state.staticDataPromise;
  state.staticDataPromise = (async () => {
    const [peopleText, ageText, housingText, electricityText, councillors, labour, gdp] = await Promise.all([
      getStaticText("assets/data/person-indicators-muni.csv"),
      getStaticText("assets/data/age-distribution-muni.csv"),
      getStaticText("assets/data/housing-info-muni.csv"),
      getStaticText("assets/data/electricity-lighting-muni.csv"),
      getStaticJson("assets/data/municipal-councillors-2021.json"),
      getStaticJson("assets/data/provincial-unemployment.json"),
      getStaticJson("assets/data/provincial-gdp-r.json")
    ]);
    const people = parseBundledCsv(peopleText, "person-indicators-muni.csv");
    const agesByCode = new Map(parseBundledCsv(ageText, "age-distribution-muni.csv")
      .map((record) => [record.muni_code, record]));
    const housingByCode = new Map(parseBundledCsv(housingText, "housing-info-muni.csv")
      .map((record) => [record.muni_code, record]));
    const censusByCode = new Map(people.map((record) => {
      const age = agesByCode.get(record.muni_code);
      const housing = housingByCode.get(record.muni_code);
      if (!age || !housing || age.name !== record.name || housing.name !== record.name) {
        throw new Error(`Bundled Census tables do not match for municipality ${record.muni_code}.`);
      }
      const metadata = new Set(["prov_code", "dc_code", "muni_code", "name"]);
      return [record.muni_code, {
        ...record,
        ...Object.fromEntries(Object.entries(age).filter(([key]) => !metadata.has(key))),
        ...Object.fromEntries(Object.entries(housing).filter(([key]) => !metadata.has(key)))
      }];
    }));
    const electricityByCode = new Map(parseBundledCsv(electricityText, "electricity-lighting-muni.csv")
      .map((record) => [record.muni_code, {
        name: record.name,
        share2011: record.electricity_lighting_share_2011,
        share2022: record.electricity_lighting_share_2022
      }]));
    if (censusByCode.size !== 213 || electricityByCode.size !== 213 ||
      councillors.totalMunicipalities !== 213) {
      throw new Error("Bundled Census, electricity or IEC data is incomplete; expected all 213 municipalities.");
    }
    return { censusByCode, electricityByCode, councillors, labour, gdp };
  })().catch((error) => {
    state.staticDataPromise = null;
    throw error;
  });
  return state.staticDataPromise;
}

function staticCensusRecord(municipality, data) {
  if (municipality.level !== "ADM3") return null;
  const specialCodes = new Map([
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
  const explicitCode = specialCodes.get(normalizeStaticName(municipality.name));
  if (explicitCode) return data.censusByCode.get(explicitCode) ?? null;
  const provinceCodes = new Map([
    ["eastern cape", "EC"], ["free state", "FS"], ["gauteng", "GP"],
    ["kwazulu-natal", "KZN"], ["limpopo", "LP"], ["mpumalanga", "MP"],
    ["north west", "NW"], ["northern cape", "NC"], ["nothern cape", "NC"],
    ["western cape", "WC"]
  ]);
  const provinceCode = provinceCodes.get(normalizeStaticName(municipality.province));
  return [...data.censusByCode.values()].find((record) =>
    record.prov_code === provinceCode &&
    normalizeStaticName(record.name) === normalizeStaticName(municipality.name)
  ) ?? null;
}

function staticCensusSource() {
  return {
    publisher: "Statistics South Africa",
    title: "Census 2022: Provinces at a Glance",
    publicationDate: "2023-10-10",
    reportingPeriods: [2011, 2022],
    url: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf",
    extractionUrl: "https://github.com/afrith/census-2022-muni-stats",
    extractionDescription: "Cleaned municipal tables extracted from the Stats SA publication; Stats SA is the original data source."
  };
}

function staticElectricitySource() {
  return {
    publisher: "Statistics South Africa",
    title: "Census 2022 Municipal fact sheet",
    reportNumber: "03-01-82",
    reportingPeriods: [2011, 2022],
    indicator: "Households reporting electricity as the main source of energy for lighting",
    unit: "% of households",
    url: "https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf",
    note: "This household indicator describes the reported main source of energy for lighting. It does not measure grid connection status, electricity availability or service reliability."
  };
}

async function getStaticApiResponse(path) {
  const url = new URL(path, location.href);
  const data = await loadStaticData();
  const censusMatch = url.pathname.match(/\/api\/municipalities\/([^/]+)\/census$/);
  if (censusMatch) {
    const municipality = state.municipalities.find((item) => item.id === decodeURIComponent(censusMatch[1]));
    if (!municipality) throw new Error("Municipality not found in bundled geography.");
    const record = staticCensusRecord(municipality, data);
    if (!record) return { municipality, census: null, availability: "The bundled Census dataset contains municipality-level records only." };
    const electricity = data.electricityByCode.get(record.muni_code);
    if (!electricity) throw new Error(`No electricity-lighting source record matches Census code ${record.muni_code}.`);
    return {
      municipality,
      census: {
        officialCode: record.muni_code,
        districtCode: record.dc_code,
        provinceCode: record.prov_code,
        indicators: record
      },
      source: staticCensusSource(),
      electricity: {
        indicators: {
          electricityLightingSharePercent2011: electricity.share2011,
          electricityLightingSharePercent2022: electricity.share2022
        },
        source: staticElectricitySource()
      },
      matchMethod: "Bundled Census code matched by municipality name and province."
    };
  }

  if (url.pathname.endsWith("/api/census/municipalities")) {
    const year = Number(url.searchParams.get("year") ?? "2022");
    if (![2011, 2022].includes(year)) throw new Error("Census reporting year must be 2011 or 2022.");
    const records = state.municipalities.flatMap((municipality) => {
      const census = staticCensusRecord(municipality, data);
      const electricity = census && data.electricityByCode.get(census.muni_code);
      const population = census?.[`total_pop_${year}`];
      const households = census?.[`households_${year}`];
      const waterSchemeHouseholds = census?.[`water_scheme_${year}`];
      const areaKm2 = census?.area_km2;
      if (![population, households, waterSchemeHouseholds, areaKm2].every(Number.isFinite) ||
        !electricity || areaKm2 <= 0) return [];
      return [{
        id: municipality.id,
        name: municipality.name,
        province: municipality.province,
        censusCode: census.muni_code,
        year,
        population,
        populationGrowthPercent: Number.isFinite(census.growth_rate_2011_to_2022)
          ? census.growth_rate_2011_to_2022
          : null,
        households,
        waterSchemeHouseholds,
        waterSchemeSharePercent: Number(((waterSchemeHouseholds / households) * 100).toFixed(2)),
        electricityLightingSharePercent: year === 2011 ? electricity.share2011 : electricity.share2022,
        sourceAreaKm2: areaKm2,
        populationDensityPerKm2: Number((population / areaKm2).toFixed(2))
      }];
    });
    return {
      year,
      total: records.length,
      source: "Statistics South Africa · Census 2022: Provinces at a Glance",
      sourceUrl: staticCensusSource().url,
      electricitySource: staticElectricitySource(),
      methodology: "Population density is calculated as source-reported total population divided by the bundled Census area. Water scheme share is calculated from source-reported household counts. This is a derived thematic view, not an official statistical classification.",
      records
    };
  }

  const politicsMatch = url.pathname.match(/\/api\/municipalities\/([^/]+)\/politics$/);
  if (politicsMatch) {
    const municipality = state.municipalities.find((item) => item.id === decodeURIComponent(politicsMatch[1]));
    const census = municipality && staticCensusRecord(municipality, data);
    const election = data.councillors.records.find((record) => record.municipalityCode === census?.muni_code);
    if (!municipality || !election) throw new Error("No matching bundled IEC 2021 councillor record was found.");
    return {
      municipality,
      election: {
        year: 2021,
        publishedDate: data.councillors.source.publishedDate,
        municipalityCode: election.municipalityCode,
        totalSeats: election.totalSeats,
        parties: election.parties,
        source: data.councillors.source
      },
      latestElection: {
        year: 2026,
        checkedDate: "2026-11-10",
        update: "The IEC has published 2026 election information; this bundled static version does not contain a verified 2026 municipal seat dataset. Consult the IEC for current results.",
        resultsUrl: "https://results.elections.org.za/home/Downloads/ME-Results",
        wardCouncillorsUrl: "https://www.elections.org.za/pw/StatsData/List-Of-Current-Ward-Councillors"
      }
    };
  }

  if (url.pathname.endsWith("/api/labour/provinces")) {
    return { ...data.labour, totalProvinces: new Set(data.labour.records.map((record) => record.province)).size };
  }

  if (url.pathname.endsWith("/api/economy/provinces")) {
    const year = Number(url.searchParams.get("year") ?? "2024");
    if (!data.gdp.years.includes(year)) throw new Error(`GDP-R reporting year ${year} is not available in the bundled dataset.`);
    const yearKey = String(year);
    return {
      year,
      availableYears: data.gdp.years,
      unit: data.gdp.source.unit,
      national: {
        gdpCurrentPricesRandMillions: data.gdp.national.gdpCurrentPricesRandMillions[yearKey],
        gdpConstant2015PricesRandMillions: data.gdp.national.gdpConstant2015PricesRandMillions[yearKey],
        realGdpGrowthPercent: data.gdp.national.realGdpGrowthPercent[yearKey]
      },
      source: data.gdp.source,
      records: data.gdp.provinces.map((record) => ({
        province: record.province,
        gdpCurrentPricesRandMillions: record.gdpCurrentPricesRandMillions[yearKey],
        gdpContributionPercent: record.gdpContributionPercent[yearKey],
        gdpConstant2015PricesRandMillions: record.gdpConstant2015PricesRandMillions[yearKey],
        realGdpGrowthPercent: record.realGdpGrowthPercent[yearKey],
        industries: Object.entries(record.industryGvaCurrentPricesRandMillions).map(([activity, values]) => ({
          activity,
          gvaCurrentPricesRandMillions: values[yearKey]
        }))
      }))
    };
  }

  if (url.pathname.endsWith("/api/integrations")) {
    const loadedSourceIds = new Set([
      "geoboundaries", "stats-sa", "stats-sa-electricity", "stats-sa-gdp-r",
      "stats-sa-qlfs", "iec-council-2021"
    ]);
    const checkedAt = new Date().toISOString();
    return {
      checkedAt,
      integrations: state.sources.map((source) => ({
        id: source.id,
        name: source.name,
        status: loadedSourceIds.has(source.id) ? "loaded" : "unavailable",
        checkedAt,
        detail: loadedSourceIds.has(source.id)
          ? "Bundled, source-attributed data is available in this static deployment."
          : "This provider requires the Node API, which GitHub Pages does not run. Its original source link remains available."
      }))
    };
  }

  throw new Error("This data view requires the hosted CivicStats API. GitHub Pages serves the bundled Census, IEC 2021, provincial GDP-R, unemployment, and boundary data only.");
}

async function getStaticJson(path) {
  const response = await fetch(new URL(path, appRoot), { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load bundled data (${response.status}).`);
  return response.json();
}

async function getStaticText(path) {
  const response = await fetch(new URL(path, appRoot), { headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(`Could not load bundled data (${response.status}).`);
  return response.text();
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [longitude, latitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const intersects = latitude > point[1] !== previousLatitude > point[1] &&
      point[0] < ((previousLongitude - longitude) * (point[1] - latitude)) /
        (previousLatitude - latitude) + longitude;
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
  return Math.abs((area * 6371.0088 ** 2) / 2);
}

function geometryAreaKm2(geometry) {
  const polygonArea = (rings) => Math.max(
    0,
    ringAreaKm2(rings[0]) - rings.slice(1).reduce((total, ring) => total + ringAreaKm2(ring), 0)
  );
  let area;
  if (geometry.type === "Polygon") {
    area = polygonArea(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    area = geometry.coordinates.reduce((total, polygon) => total + polygonArea(polygon), 0);
  } else {
    return null;
  }
  return Number.isFinite(area) && area > 0 ? Number(area.toFixed(1)) : null;
}

function findContainingFeature(feature, collection) {
  const point = representativePoint(feature);
  return collection?.features.find((candidate) =>
    point && pointInGeometry(point, candidate.geometry)
  ) ?? null;
}

function buildMunicipalityDirectory(municipalities, districts, provinces, censusData) {
  return municipalities.features.map((feature) => {
    const province = findContainingFeature(feature, provinces);
    const district = findContainingFeature(feature, districts);
    const name = feature.properties.shapeName;
    const districtName = district?.properties.shapeName ?? null;
    const municipality = {
      id: feature.properties.shapeID,
      name,
      level: feature.properties.shapeType,
      province: canonicalProvinceName(province?.properties.shapeName ?? null),
      provinceId: province?.properties.shapeID ?? null,
      district: districtName,
      districtId: district?.properties.shapeID ?? null,
      category: districtName === name
        ? "Category A · Metropolitan municipality"
        : "Category B · Local municipality",
      areaKm2: geometryAreaKm2(feature.geometry),
      areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon."
    };
    return {
      ...municipality,
      officialCode: staticCensusRecord(municipality, censusData)?.muni_code ?? null
    };
  });
}

function buildGeographyDirectory(collections, municipalities) {
  const municipalityById = new Map(municipalities.map((item) => [item.id, item]));
  const metropolitanNames = new Set(municipalities
    .filter((item) => item.category?.startsWith("Category A"))
    .map((item) => item.name));
  const geographies = [];
  for (const [level, collection] of collections) {
    for (const feature of collection.features) {
      const { shapeID: id, shapeName: rawName } = feature.properties;
      const name = level === "ADM1" ? canonicalProvinceName(rawName) : rawName;
      if (level === "ADM3") {
        const municipality = municipalityById.get(id);
        if (municipality) geographies.push(municipality);
        continue;
      }
      const province = level === "ADM1" ? feature : findContainingFeature(
        feature,
        collections.get("ADM1")
      );
      const isMetro = metropolitanNames.has(name);
      geographies.push({
        id,
        name,
        level,
        province: canonicalProvinceName(province?.properties.shapeName ?? null),
        provinceId: level === "ADM1" ? id : province?.properties.shapeID ?? null,
        district: level === "ADM2" ? name : null,
        districtId: level === "ADM2" ? id : null,
        officialCode: null,
        category: level === "ADM1"
          ? "Province"
          : isMetro
            ? "Category A · Metropolitan municipality"
            : "Category C · District municipality",
        areaKm2: geometryAreaKm2(feature.geometry),
        areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon."
      });
    }
  }
  return geographies;
}

async function loadStaticWorkspaceData() {
  const [sources, provinces, districts, collection, censusData] = await Promise.all([
    getStaticJson("assets/data-sources.json"),
    getStaticJson("assets/geojson/south-africa-adm1.geojson"),
    getStaticJson("assets/geojson/south-africa-adm2.geojson"),
    getStaticJson("assets/geojson/south-africa-adm3.geojson"),
    loadStaticData()
  ]);
  for (const [level, boundaries] of [["ADM1", provinces], ["ADM2", districts], ["ADM3", collection]]) {
    state.collections.set(level, boundaries);
  }
  const municipalityDirectory = buildMunicipalityDirectory(collection, districts, provinces, censusData);
  const collections = new Map([["ADM1", provinces], ["ADM2", districts], ["ADM3", collection]]);
  return {
    health: {
      boundaryLevels: {
        ADM1: provinces.features.length,
        ADM2: districts.features.length,
        ADM3: collection.features.length
      }
    },
    sources,
    municipalities: municipalityDirectory,
    geographies: buildGeographyDirectory(collections, municipalityDirectory),
    collection
  };
}

async function loadWorkspaceData() {
  if (appRoot.pathname.replace(/\/$/, "").endsWith("/frontend")) {
    return loadStaticWorkspaceData();
  }
  try {
    const [health, sourceResponse, municipalityResponse, geographyResponse, collection] = await Promise.all([
      getJson("/api/health"),
      getJson("/api/sources"),
      getJson("/api/municipalities"),
      getJson("/api/geographies"),
      getJson("/api/geo/ADM3")
    ]);
    return {
      health,
      sources: sourceResponse.sources,
      municipalities: municipalityResponse.municipalities,
      geographies: geographyResponse.geographies,
      collection
    };
  } catch (apiError) {
    try {
      return await loadStaticWorkspaceData();
    } catch (staticError) {
      throw new Error(`API unavailable (${apiError.message}); bundled geography unavailable (${staticError.message}).`);
    }
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function renderIndicatorGuide(query = "") {
  const list = document.querySelector("#indicator-guide-list");
  const count = document.querySelector("#indicator-guide-count");
  if (!list || !count) return;
  const term = query.trim().toLocaleLowerCase();
  const searchAliases = {
    "Population": "people residents population count size",
    "Households": "homes families housing households",
    "Average household size": "people per home household size",
    "Population growth": "population change increase decrease growth",
    "Official unemployment rate": "jobs work joblessness unemployment employment",
    "Expanded unemployment (LU3)": "jobs work joblessness unemployment lu3 discouraged job seekers",
    "Water scheme household share": "water taps piped water services access",
    "Flush toilet household share": "toilets sanitation services access",
    "Electricity for lighting": "electricity power lights lighting services access",
    "Municipal finance line items": "budget money spending income revenue expenditure municipal finances",
    "Audit opinion": "audit clean audit governance accountability",
    "Council seats": "election councillors parties council political seats",
    "Climate normals": "weather rain rainfall temperature climate"
  };
  const entries = indicatorGuideEntries.filter((entry) =>
    [...Object.values(entry), searchAliases[entry.name] ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(term))
  );
  count.textContent = `${entries.length} indicator${entries.length === 1 ? "" : "s"}${term ? " match your search" : " explained"}.`;
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "indicator-guide-empty";
    empty.textContent = "No indicators match that search. Try a source, topic or reporting period.";
    list.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "indicator-guide-entry";
    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = entry.name;
    const category = document.createElement("span");
    category.className = "indicator-guide-category";
    category.textContent = entry.category;
    header.append(title, category);
    const definition = document.createElement("p");
    definition.textContent = entry.definition;
    const metadata = document.createElement("dl");
    [["Period", entry.period], ["Source", entry.source], ["Read with care", entry.caveat]].forEach(([label, value]) => {
      const termNode = document.createElement("dt");
      termNode.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      metadata.append(termNode, description);
    });
    article.append(header, definition, metadata);
    list.append(article);
  });
}

function safeText(value) {
  return String(value ?? "—");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    showToast("There is no displayed data to download yet.");
    return;
  }
  const text = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function formatBoundaryLevel(level) {
  return ({ ADM1: "Province", ADM2: "District / metro", ADM3: "Municipality" })[level] ?? level;
}

function formatArea(areaKm2) {
  if (typeof areaKm2 !== "number" || !Number.isFinite(areaKm2)) return "—";
  return `${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1 }).format(areaKm2)} km²`;
}

function updateBreadcrumb() {
  const breadcrumb = document.querySelector("#breadcrumbs");
  const pieces = [{ name: "South Africa", id: null }];
  const selected = state.selected;
  const findGeography = (id, level, name) =>
    state.geographies.find((item) =>
      (id && item.id === id) || (item.level === level && item.name === name)
    );
  if (selected?.province && selected.province !== "South Africa") {
    const province = findGeography(selected.provinceId, "ADM1", selected.province);
    if (province && province.id !== selected.id) pieces.push(province);
  }
  if (selected?.district && selected.district !== selected.name) {
    const district = findGeography(selected.districtId, "ADM2", selected.district);
    if (district && district.id !== selected.id && district.id !== pieces.at(-1).id) pieces.push(district);
  }
  if (selected && pieces.at(-1).id !== selected.id) pieces.push(selected);
  const viewLabel = state.view === "sources"
    ? "Data sources"
    : state.view === "comparisons"
      ? "Comparisons"
      : state.view === "municipalities"
        ? "Municipalities"
        : state.view === "dashboard" && pieces.length === 1
          ? "National overview"
          : null;
  if (viewLabel) pieces.push({ name: viewLabel, id: null });
  breadcrumb.replaceChildren();
  pieces.forEach((piece, index) => {
    if (index) {
      const separator = document.createElement("span");
      separator.className = "crumb-separator";
      separator.textContent = "/";
      breadcrumb.append(separator);
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = `crumb-button${index === pieces.length - 1 ? " crumb-current" : ""}`;
    item.textContent = piece.name;
    if (piece.id) item.dataset.geographyId = piece.id;
    else if (index === 0) item.dataset.geographyRoot = "true";
    else item.disabled = true;
    breadcrumb.append(item);
  });
}

function updatePageHeading() {
  const [title, subtitle] = viewCopy[state.view] ?? viewCopy.dashboard;
  document.querySelector("#page-title").textContent = title;
  document.querySelector("#page-subtitle").textContent =
    state.view === "dashboard" && state.selected ? "Municipal boundary and source coverage" : subtitle;
  document.title = `CivicStats SA — ${title}`;
}

function updateNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.view === state.view ||
      (link.dataset.tab && state.view === "dashboard" && link.dataset.tab === state.tab);
    link.classList.toggle("active", Boolean(active));
  });
  document.querySelectorAll(".section-tab").forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.tab === state.tab)
  );
}

function setView(view) {
  state.view = viewCopy[view] ? view : "dashboard";
  const comparisonMode = state.view === "comparisons";
  const workspace = ["dashboard", "national", "workspace", "comparisons"].includes(state.view);
  setMobileProfileOpen(false);
  if (comparisonMode) {
    document.querySelector("#center-column").append(comparisonWorkspace);
  } else if (comparisonWorkspace.parentElement !== document.querySelector("#center-column")) {
    document.querySelector("#center-column").append(comparisonWorkspace);
  }
  workspaceGrid.hidden = !workspace;
  workspaceGrid.classList.toggle("comparison-active", comparisonMode);
  workspaceGrid.classList.toggle("section-detail-active", workspace && !comparisonMode && state.tab !== "overview");
  workspaceGrid.classList.toggle("map-compact", comparisonMode || (workspace && state.tab !== "overview"));
  document.querySelector("#map-compact-toggle").hidden = !(workspace && (comparisonMode || state.tab !== "overview"));
  sectionTabs.hidden = !workspace || comparisonMode;
  alternateView.hidden = workspace;
  comparisonWorkspace.hidden = !comparisonMode;
  updatePageHeading();
  updateBreadcrumb();
  updateNavigation();
  refreshSelectionLayer();
  if (comparisonMode || !workspace) renderAlternateView();
}

async function copyShareableViewLink() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (state.view !== "dashboard") url.searchParams.set("view", state.view);
  if (state.view === "comparisons") {
    const ids = (state.comparisonSelections ?? []).filter(Boolean).slice(0, 3);
    if (ids.length >= 2) {
      url.searchParams.set("compare", ids.join(","));
      if (ids.includes(state.comparisonReferenceId)) url.searchParams.set("reference", state.comparisonReferenceId);
    }
  } else if (state.selected?.id) {
    url.searchParams.set("geography", state.selected.id);
    if (tabContent[state.tab]) url.searchParams.set("tab", state.tab);
  }
  url.searchParams.set("layer", state.mapLayer);
  url.searchParams.set("boundaryLevel", state.boundaryLevel);
  url.searchParams.set("autoDetail", state.autoBoundaryDetail ? "1" : "0");
  url.searchParams.set("censusYear", String(state.censusMapYear));
  url.searchParams.set("gdpYear", String(state.economyMapYear));
  url.searchParams.set("quarter", state.labourQuarter);
  try {
    await navigator.clipboard.writeText(url.href);
    showToast("Link copied. It opens this area, map layer and reporting period.");
  } catch {
    const input = document.createElement("textarea");
    input.value = url.href;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    showToast(copied ? "Link copied. It opens this area, map layer and reporting period." : `Copy this link: ${url.href}`);
  }
}

function setTab(tab) {
  if (!tabContent[tab]) return;
  state.tab = tab;
  state.view = "dashboard";
  workspaceGrid.hidden = false;
  workspaceGrid.classList.remove("comparison-active");
  workspaceGrid.classList.toggle("section-detail-active", tab !== "overview");
  workspaceGrid.classList.toggle("map-compact", tab !== "overview");
  document.querySelector("#map-compact-toggle").hidden = tab === "overview";
  sectionTabs.hidden = false;
  alternateView.hidden = true;
  comparisonWorkspace.hidden = true;
  renderDetail();
  updatePageHeading();
  updateBreadcrumb();
  updateNavigation();
  refreshSelectionLayer();
}

function renderNationalOverviewDetail() {
  const metrics = document.createElement("div");
  metrics.className = "census-metric-grid national-overview-grid";
  const censusRecords = [...state.censusMapRecords.values()];
  const censusLoaded = state.municipalities.length > 0 &&
    censusRecords.length === state.municipalities.length;
  const totalHouseholds = censusLoaded
    ? censusRecords.reduce((sum, record) => sum + record.households, 0)
    : null;
  const totalWaterSchemeHouseholds = censusLoaded
    ? censusRecords.reduce((sum, record) => sum + record.waterSchemeHouseholds, 0)
    : null;
  const totalElectricityLightingHouseholds = censusLoaded
    ? censusRecords.reduce((sum, record) =>
      sum + record.electricityLightingSharePercent * record.households / 100, 0)
    : null;
  const numberOfHouseholds = Number.isFinite(totalHouseholds) && totalHouseholds > 0 ? totalHouseholds : null;
  const censusUnavailable = state.censusMapError ? "Unavailable" : "Loading…";
  const householdCount = numberOfHouseholds == null
    ? censusUnavailable
    : formatCensusNumber(numberOfHouseholds);
  const waterShare = numberOfHouseholds == null || !Number.isFinite(totalWaterSchemeHouseholds)
    ? censusUnavailable
    : `${formatCensusNumber(totalWaterSchemeHouseholds / numberOfHouseholds * 100, 1)}%`;
  const electricityShare = numberOfHouseholds == null || !Number.isFinite(totalElectricityLightingHouseholds)
    ? censusUnavailable
    : `${formatCensusNumber(totalElectricityLightingHouseholds / numberOfHouseholds * 100, 1)}%`;
  const period = state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label;
  const labourCoverage = state.labourData
    ? `${state.labourMapRecords.size} / ${state.labourData.totalProvinces} provinces`
    : state.labourMapError ? "Unavailable" : "Loading…";

  appendCensusMetric(metrics, "Households", householdCount,
    censusLoaded ? `Stats SA Census ${state.censusMapYear} · ${censusRecords.length} municipalities` : `Stats SA Census ${state.censusMapYear} · ${state.censusMapLoading ? "loading" : "source data unavailable"}`);
  appendCensusMetric(metrics, "Households reporting a water-scheme source", waterShare,
    `Stats SA Census ${state.censusMapYear} · household-weighted national share`);
  appendCensusMetric(metrics, "Households reporting electricity as main lighting", electricityShare,
    `Stats SA Census ${state.censusMapYear} · household-weighted national share`);
  appendCensusMetric(metrics, "QLFS provincial coverage", labourCoverage,
    period ? `Stats SA · ${period} · provincial estimates, not a national rate` : "Stats SA Quarterly Labour Force Survey");
  detailBody.append(metrics);
}

function renderDetail() {
  const content = tabContent[state.tab];
  document.querySelector("#detail-kicker").textContent = content.kicker;
  document.querySelector("#detail-title").textContent = content.title;
  detailBody.replaceChildren();

  if (state.tab === "finance") {
    renderFinanceDetail();
    return;
  }

  if (state.tab === "politics") {
    renderPoliticsDetail();
    return;
  }

  if (state.tab === "economy") {
    renderEconomyDetail();
    return;
  }

  if (state.tab === "demographics" || state.tab === "services") {
    renderCensusProfile(state.tab);
    return;
  }

  if (state.tab === "climate") {
    renderClimateDetail();
    return;
  }

  if (state.tab === "documents") {
    renderDocumentsProjects();
    return;
  }

  if (state.tab === "overview") {
    const intro = document.createElement("p");
    intro.className = "detail-intro";
    intro.textContent = state.selected
      ? content.intro
      : "South Africa-wide household indicators and verified coverage. GDP and population are shown in the national snapshot above.";
    detailBody.append(intro);

    if (!state.selected) {
      renderNationalOverviewDetail();
      return;
    }

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    const values = {
      province: state.selected?.province,
      district: state.selected?.district,
      level: state.selected ? formatBoundaryLevel(state.selected.level) : null,
      classification: state.selected?.category ?? "Data unavailable",
      code: state.selected?.officialCode ??
        state.censusMapRecords.get(state.selected?.id)?.censusCode ?? "Data unavailable",
      seat: "Data unavailable",
      area: state.selected?.areaKm2 == null ? null : formatArea(state.selected.areaKm2),
      vintage: state.selected ? "2020 · geoBoundaries" : null
    };
    content.fields.forEach(([label, key]) => {
      const item = document.createElement("div");
      item.className = "detail-item";
      const caption = document.createElement("span");
      caption.textContent = label;
      const value = document.createElement("strong");
      value.textContent = safeText(values[key]);
      item.append(caption, value);
      grid.append(item);
    });
    detailBody.append(grid);
    if (state.selected) renderOverviewCensus(state.selected);
    return;
  }

  const empty = document.createElement("div");
  empty.className = "empty-data";
  const title = document.createElement("strong");
  title.textContent = "No verified indicator dataset available";
  const description = document.createElement("p");
  description.textContent = state.selected
    ? `${content.description} No figures are shown because no source dataset has been imported for this geography.`
    : `${content.description} Select a municipality to see its source-data availability.`;
  const source = document.createElement("code");
  source.textContent = `EXPECTED SOURCE · ${content.source}`;
  empty.append(title, description, source);
  detailBody.append(empty);

}

function formatCensusNumber(value, maximumFractionDigits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits }).format(value);
}

function metricGuideEntry(label, note = "") {
  const text = `${label} ${note}`.toLocaleLowerCase();
  const guideName = text.includes("basic services pilot") || text.includes("civicscore")
    ? "Basic services pilot score"
    : text.includes("expanded unemployment") || text.includes("lu3")
    ? "Expanded unemployment (LU3)"
    : text.includes("unemployment")
      ? "Official unemployment rate"
      : text.includes("population change") || text.includes("growth rate")
        ? "Population growth"
        : text.includes("electricity") && text.includes("cook")
          ? "Electricity for cooking"
          : text.includes("electricity") && (text.includes("light") || text.includes("lighting"))
            ? "Electricity for lighting"
            : text.includes("water scheme")
              ? "Water scheme household share"
              : text.includes("flush toilet")
                ? "Flush toilet household share"
                : text.includes("sex ratio")
                  ? "Sex ratio"
                  : text.includes("household size")
                    ? "Average household size"
                    : text.includes("school") || text.includes("age")
                      ? "Age and school attendance"
                      : text.includes("household")
                        ? "Households"
                        : text.includes("male population") || text.includes("female population") || text.includes("population")
                          ? "Population"
                          : text.includes("temperature") || text.includes("precipitation") || text.includes("climate")
                            ? "Climate normals"
                            : text.includes("audit")
                              ? "Audit opinion"
                              : text.includes("seat") || text.includes("parties represented")
                                ? "Council seats"
                                : text.includes("capital acquisition")
                                  ? "Capital acquisition categories"
                                  : text.includes("revenue") || text.includes("expenditure") || text.includes("surplus") || text.includes("financial") || text.includes("treasury")
                                    ? "Municipal finance line items"
                                    : text.includes("gdp") || text.includes("industry")
                                      ? text.includes("latest available") ? "National economic indicators" : "GDP-R and industry activity"
                                      : null;
  return indicatorGuideEntries.find((entry) => entry.name === guideName) ?? null;
}

function addMetricExplanation(parent, label, note = "") {
  const entry = metricGuideEntry(label, note);
  if (!entry) return;
  const details = document.createElement("details");
  details.className = "metric-explainer";
  const summary = document.createElement("summary");
  summary.textContent = "What this means";
  const definition = document.createElement("p");
  definition.textContent = entry.definition;
  const caveat = document.createElement("p");
  caveat.className = "metric-explainer-caveat";
  caveat.textContent = `Keep in mind: ${entry.caveat}`;
  const provenance = document.createElement("small");
  provenance.textContent = `Source: ${entry.source} · Period: ${entry.period}`;
  details.append(summary, definition, caveat, provenance);
  parent.append(details);
}

function appendCensusMetric(parent, label, value, note = "") {
  const metric = document.createElement("article");
  metric.className = "census-metric";
  const title = document.createElement("span");
  title.textContent = label;
  const amount = document.createElement("strong");
  amount.textContent = value;
  metric.append(title, amount);
  if (note) {
    const caption = document.createElement("small");
    caption.textContent = note;
    metric.append(caption);
  }
  addMetricExplanation(metric, label, note);
  parent.append(metric);
}

function appendCensusBar(parent, label, value, maximum, note = "") {
  const row = document.createElement("div");
  row.className = "census-bar-row";
  const heading = document.createElement("div");
  heading.className = "census-bar-heading";
  const name = document.createElement("span");
  name.textContent = label;
  const amount = document.createElement("strong");
  amount.textContent = `${formatCensusNumber(value)}${note}`;
  heading.append(name, amount);
  const track = document.createElement("div");
  track.className = "census-bar-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  const percentage = maximum > 0 && typeof value === "number"
    ? Math.max(0, Math.min(100, (value / maximum) * 100))
    : 0;
  fill.style.width = `${percentage}%`;
  track.append(fill);
  row.append(heading, track);
  parent.append(row);
  addChartCsvDownload(parent);
}

function addChartCsvDownload(chart) {
  if (chart.dataset.exportReady === "true") return;
  chart.dataset.exportReady = "true";
  const button = document.createElement("button");
  button.className = "action-button chart-download-button";
  button.type = "button";
  button.textContent = "Download chart data CSV";
  button.addEventListener("click", () => {
    const title = chart.closest(".census-section")?.querySelector("h3")?.textContent ?? "indicator-chart";
    const slug = title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rows = [["Indicator", "Value", "Reporting period or note"]];
    chart.querySelectorAll(".census-bar-row").forEach((row) => {
      const name = row.querySelector(".census-bar-heading span")?.textContent?.trim() ?? "";
      const amount = row.querySelector(".census-bar-heading strong")?.textContent?.trim() ?? "";
      if (name) rows.push([name, amount, title]);
    });
    downloadCsv(`civicstats-${slug || "chart"}.csv`, rows);
  });
  chart.prepend(button);
}

function appendCensusSection(parent, titleText, description) {
  const section = document.createElement("section");
  section.className = "census-section";
  const heading = document.createElement("h3");
  heading.textContent = titleText;
  section.append(heading);
  if (description) {
    const note = document.createElement("p");
    note.className = "census-section-note";
    note.textContent = description;
    section.append(note);
  }
  parent.append(section);
  return section;
}

function censusServiceRows(indicators, year) {
  const dimensions = [
    ["Dwelling type", [
      ["Formal dwelling", "formal_dwelling"],
      ["Traditional dwelling", "traditional_dwelling"],
      ["Informal dwelling", "informal_dwelling"],
      ["Other dwelling", "other_dwelling"]
    ]],
    ["Water source", [
      ["Water scheme", "water_scheme"],
      ["Other water source", "other_water"]
    ]],
    ["Toilet type", [
      ["Flush toilet", "flush_toilet"],
      ["Other toilet", "other_toilet"],
      ["No toilet", "no_toilet"]
    ]],
    ["Cooking energy", [
      ["Electricity used for cooking", "electricity_cooking"],
      ["Gas used for cooking", "gas_cooking"],
      ["Other cooking energy", "other_cooking"]
    ]]
  ];
  return dimensions.map(([category, entries]) => ({
    category,
    entries: entries.map(([label, prefix]) => ({
      label,
      key: `${prefix}_${year}`,
      value: indicators[`${prefix}_${year}`]
    }))
  }));
}

function exportCensusProfile(census, kind, year) {
  const indicators = census.census.indicators;
  const rows = [["indicator", "year", "value", "unit", "source"]];
  const addRow = (label, key, rowYear, unit) => {
    const value = indicators[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      rows.push([label, rowYear, value, unit, "Statistics South Africa · Census 2022: Provinces at a Glance"]);
    }
  };
  if (kind === "demographics") {
    [
      ["Total population", `total_pop_${year}`, "people"],
      ["Male population", `male_pop_${year}`, "people"],
      ["Female population", `female_pop_${year}`, "people"],
      ["School attendance ages 5–24", `school_attendance_ages_5_to_24_${year}`, "people"],
      ["Sex ratio (source)", `sex_ratio_${year}`, "source-reported ratio"],
      ["Households", `households_${year}`, "households"],
      ["Average household size", `avg_household_size_${year}`, "people per household"],
      ...[
        ["Age 0–4", "age_0_to_4"],
        ["Age 5–14", "age_5_to_14"],
        ["Age 15–34", "age_15_to_34"],
        ["Age 35–59", "age_35_to_59"],
        ["Age 60+", "age_60_plus"]
      ].map(([label, key]) => [label, `${key}_${year}`, "people"])
    ].forEach(([label, key, unit]) => addRow(label, key, year, unit));
    addRow("Reported population growth rate", "growth_rate_2011_to_2022", "2011–2022", "% as published");
  } else {
    censusServiceRows(indicators, year).forEach(({ entries }) =>
      entries.forEach(({ label, key }) => addRow(label, key, year, "households"))
    );
    addRow("Households (percentage denominator)", `households_${year}`, year, "households");
    const electricity = census.electricity?.indicators;
    [2011, 2022].forEach((reportYear) => {
      const value = electricity?.[`electricityLightingSharePercent${reportYear}`];
      if (typeof value === "number" && Number.isFinite(value)) {
        rows.push([
          "Households reporting electricity as the main source of energy for lighting",
          reportYear,
          value,
          "% of households",
          census.electricity.source.title
        ]);
      }
    });
  }
  downloadCsv(
    `civicstats-${census.municipality.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${kind}-${year}.csv`,
    rows
  );
}

function renderCensusData(census, kind) {
  const indicators = census.census.indicators;
  const year = state.censusYear;
  const selectedValue = (key) => indicators[`${key}_${year}`];
  const periodControl = document.createElement("div");
  periodControl.className = "finance-controls census-controls";
  const yearLabel = document.createElement("label");
  yearLabel.textContent = "CENSUS REPORTING YEAR";
  const yearSelect = document.createElement("select");
  yearSelect.setAttribute("aria-label", "Census reporting year");
  [2022, 2011].forEach((optionYear) => {
    const option = document.createElement("option");
    option.value = String(optionYear);
    option.textContent = String(optionYear);
    option.selected = optionYear === year;
    yearSelect.append(option);
  });
  yearSelect.addEventListener("change", () => {
    state.censusYear = Number.parseInt(yearSelect.value, 10);
    renderCensusData(census, kind);
  });
  yearLabel.append(yearSelect);
  periodControl.append(yearLabel);
  detailBody.replaceChildren(periodControl);

  const metadata = document.createElement("p");
  metadata.className = "finance-source-note census-source-note";
  metadata.textContent = `${census.municipality.name} · Census ${year} · Statistics South Africa publication released 10 October 2023. Population and household counts are source-reported; household shares shown below are calculated from the source counts.`;
  detailBody.append(metadata);

  if (kind === "demographics") {
    const metrics = document.createElement("div");
    metrics.className = "census-metric-grid";
    appendCensusMetric(metrics, `Population · ${year}`, formatCensusNumber(selectedValue("total_pop")));
    appendCensusMetric(metrics, `Households · ${year}`, formatCensusNumber(selectedValue("households")));
    appendCensusMetric(metrics, "Reported growth rate", `${formatCensusNumber(indicators.growth_rate_2011_to_2022, 1)}%`, "2011–2022");
    appendCensusMetric(metrics, `Average household size · ${year}`, formatCensusNumber(selectedValue("avg_household_size"), 1), "people per household");
    detailBody.append(metrics);

    const populationSection = appendCensusSection(detailBody, "Population change", "Census-reported total population · people · 2011 and 2022.");
    const populationChart = document.createElement("div");
    populationChart.className = "census-chart";
    const populationMaximum = Math.max(indicators.total_pop_2011 ?? 0, indicators.total_pop_2022 ?? 0);
    appendCensusBar(populationChart, "2011", indicators.total_pop_2011, populationMaximum);
    appendCensusBar(populationChart, "2022", indicators.total_pop_2022, populationMaximum);
    populationSection.append(populationChart);

    const distributionSection = appendCensusSection(detailBody, `Age distribution · ${year}`, "People by broad age band; bar lengths are relative to the largest age band in this municipality and year.");
    const ageChart = document.createElement("div");
    ageChart.className = "census-chart";
    const ageRows = [
      ["0–4", selectedValue("age_0_to_4")],
      ["5–14", selectedValue("age_5_to_14")],
      ["15–34", selectedValue("age_15_to_34")],
      ["35–59", selectedValue("age_35_to_59")],
      ["60+", selectedValue("age_60_plus")]
    ];
    const ageMaximum = Math.max(...ageRows.map(([, value]) => value ?? 0));
    ageRows.forEach(([label, value]) => appendCensusBar(ageChart, label, value, ageMaximum));
    distributionSection.append(ageChart);

    const populationSection2 = appendCensusSection(detailBody, `Population detail · ${year}`, "Source-reported counts and ratios.");
    const details = document.createElement("div");
    details.className = "census-metric-grid";
    appendCensusMetric(details, "Male population", formatCensusNumber(selectedValue("male_pop")), "people");
    appendCensusMetric(details, "Female population", formatCensusNumber(selectedValue("female_pop")), "people");
    appendCensusMetric(details, "School attendance · ages 5–24", formatCensusNumber(selectedValue("school_attendance_ages_5_to_24")), "people");
    appendCensusMetric(details, "Sex ratio (source)", formatCensusNumber(selectedValue("sex_ratio"), 1));
    populationSection2.append(details);
  } else {
    const householdCount = selectedValue("households");
    const metrics = document.createElement("div");
    metrics.className = "census-metric-grid";
    appendCensusMetric(metrics, `Households · ${year}`, formatCensusNumber(householdCount));
    appendCensusMetric(metrics, `Average household size · ${year}`, formatCensusNumber(selectedValue("avg_household_size"), 1), "people per household");
    detailBody.append(metrics);

    const services = censusServiceRows(indicators, year);
    services.forEach(({ category, entries }) => {
      const section = appendCensusSection(detailBody, `${category} · ${year}`, "Household counts and calculated share of all households in the selected Census year.");
      const chart = document.createElement("div");
      chart.className = "census-chart";
      entries.forEach(({ label, value }) => {
        const percentage = householdCount > 0 && typeof value === "number"
          ? `${formatCensusNumber((value / householdCount) * 100, 1)}% of households`
          : "";
        appendCensusBar(chart, label, value, householdCount ?? 0, percentage ? ` · ${percentage}` : "");
      });
      section.append(chart);
    });

    const electricitySource = census.electricity?.source;
    const electricityIndicators = census.electricity?.indicators;
    if (electricitySource && electricityIndicators) {
      const section = appendCensusSection(
        detailBody,
        "Electricity for household lighting · Census 2011 and 2022",
        electricitySource.note
      );
      const electricityMetrics = document.createElement("div");
      electricityMetrics.className = "census-metric-grid";
      appendCensusMetric(
        electricityMetrics,
        "Households reporting electricity for main lighting · 2011",
        `${formatCensusNumber(electricityIndicators.electricityLightingSharePercent2011, 1)}%`,
        "% of households"
      );
      appendCensusMetric(
        electricityMetrics,
        "Households reporting electricity for main lighting · 2022",
        `${formatCensusNumber(electricityIndicators.electricityLightingSharePercent2022, 1)}%`,
        "% of households"
      );
      section.append(electricityMetrics);
      addSourceLink(section, electricitySource.url, "Open original Stats SA municipal fact sheet ↗");
    }

    const note = document.createElement("p");
    note.className = "census-section-note census-cooking-note";
    note.textContent = "Cooking-energy and lighting-source indicators have different definitions. The lighting share does not measure grid connection status, electricity availability or service reliability.";
    detailBody.append(note);
  }

  const source = document.createElement("div");
  source.className = "census-provenance";
  const sourceText = document.createElement("p");
  sourceText.textContent = `${census.source.publisher} · ${census.source.title} · reporting periods ${census.source.reportingPeriods.join(" and ")}. The municipal table is a cleaned extraction; Stats SA is credited as the original data source.`;
  source.append(sourceText);
  addSourceLink(source, census.source.url, "Open original Stats SA publication ↗");
  addSourceLink(source, census.source.extractionUrl, "Open cleaned dataset and extraction notes ↗");
  if (kind === "services" && census.electricity?.source) {
    const electricitySource = census.electricity.source;
    const electricitySourceText = document.createElement("p");
    electricitySourceText.textContent = `${electricitySource.publisher} · ${electricitySource.title} · reporting periods ${electricitySource.reportingPeriods.join(" and ")}. Indicator: ${electricitySource.indicator} (${electricitySource.unit}).`;
    source.append(electricitySourceText);
    addSourceLink(source, electricitySource.url, "Open original Stats SA municipal fact sheet ↗");
  }
  if (kind === "services") {
    const serviceSource = state.sources.find((item) => item.id === "stats-sa-service-delivery");
    if (serviceSource) {
      const serviceNote = document.createElement("p");
      serviceNote.textContent = "For published municipal water-interruption measures (households reporting an interruption in the prior 12 months) and comparable 2011/2022 basic-service access indicators, see Stats SA Report 03-01-83. The report values are not live outage monitoring.";
      source.append(serviceNote);
      addSourceLink(source, serviceSource.dataUrl, "Open Stats SA municipal service-delivery report ↗");
    }
  }
  const terms = document.createElement("p");
  terms.className = "census-terms";
  terms.textContent = "Stats SA terms require attribution and prohibit selling the original or reprocessed data without prior permission.";
  source.append(terms);
  const exportButton = document.createElement("button");
  exportButton.className = "action-button finance-export";
  exportButton.type = "button";
  exportButton.textContent = "Download these Census figures";
  exportButton.addEventListener("click", () => exportCensusProfile(census, kind, year));
  source.append(exportButton);
  detailBody.append(source);
}

function renderCensusProfile(kind) {
  const selected = state.selected;
  const requestId = ++state.censusRequestId;
  if (!selected) {
    addDetailMessage(detailBody, "Select a municipality", "Census 2022 population and household data are available for the 213 municipalities in the boundary dataset.");
    return;
  }
  if (selected.level !== "ADM3") {
    addDetailMessage(detailBody, "Municipality-level Census data", "Select an ADM3 municipality to view its Census 2011 and 2022 indicators.");
    return;
  }

  addDetailMessage(detailBody, "Loading Census data", `Loading the source-linked population and household tables for ${selected.name}…`, "finance-loading");
  void getMunicipalityCensus(selected.id).then((result) => {
    if (requestId !== state.censusRequestId || state.tab !== kind || state.selected?.id !== selected.id) return;
    if (result.census) {
      renderCensusData(result, kind);
    } else {
      detailBody.replaceChildren();
      addDetailMessage(detailBody, "Census record unavailable", result.availability);
    }
  }).catch((error) => {
    if (requestId !== state.censusRequestId || state.tab !== kind || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren();
    addDetailError(detailBody, "Census dataset unavailable", `${error.message} Check your connection and try the request again.`);
  });
}

function getMunicipalityCensus(municipalityId) {
  const cached = state.censusCache.get(municipalityId);
  if (cached) return Promise.resolve(cached);
  const pending = state.censusRequests.get(municipalityId);
  if (pending) return pending;
  const request = getJson(`/api/municipalities/${encodeURIComponent(municipalityId)}/census`)
    .then((result) => {
      if (result.census) state.censusCache.set(municipalityId, result);
      return result;
    })
    .finally(() => state.censusRequests.delete(municipalityId));
  state.censusRequests.set(municipalityId, request);
  return request;
}

function hasVerifiedCensusSource(result) {
  return result?.source?.publisher === "Statistics South Africa" &&
    typeof result.source.url === "string" &&
    result.source.url.startsWith("https://");
}

async function getProvinceCensusPopulation(province) {
  if (!provinceCensus2022Promise) {
    provinceCensus2022Promise = getStaticJson("assets/data/census-provinces-2022.json").then((dataset) => {
      const expected = [
        "Western Cape", "Eastern Cape", "Northern Cape", "Free State", "KwaZulu-Natal",
        "North West", "Gauteng", "Mpumalanga", "Limpopo"
      ];
      const records = Array.isArray(dataset.records) ? dataset.records : [];
      const names = new Set(records.map((record) => record.province));
      const total = records.reduce((sum, record) => sum + record.population, 0);
      if (dataset.source?.publisher !== "Statistics South Africa" ||
        dataset.source?.reportNumber !== "P0301.4" || dataset.source?.year !== 2022 ||
        !dataset.source.url?.startsWith("https://") || records.length !== expected.length ||
        names.size !== expected.length || expected.some((name) => !names.has(name)) ||
        records.some((record) => !Number.isSafeInteger(record.population) || record.population <= 0) ||
        total !== dataset.nationalTotal) {
        throw new Error("Stats SA provincial Census 2022 data is incomplete or invalid.");
      }
      return dataset;
    }).catch((error) => {
      provinceCensus2022Promise = null;
      throw error;
    });
  }
  const dataset = await provinceCensus2022Promise;
  const record = dataset.records.find((item) => item.province === province);
  if (!record) throw new Error(`No Census 2022 population record is available for ${province}.`);
  return { population: record.population, source: dataset.source };
}

function getNationalCensusPopulation2022() {
  if (!nationalCensus2022Promise) {
    nationalCensus2022Promise = getProvinceCensusPopulation("Gauteng")
      .then(async () => {
        const dataset = await provinceCensus2022Promise;
        return { population: dataset.nationalTotal, source: dataset.source };
      })
      .catch((error) => {
        nationalCensus2022Promise = null;
        throw error;
      });
  }
  return nationalCensus2022Promise;
}

function renderOverviewCensus(selected) {
  const requestId = ++state.overviewCensusRequestId;
  const section = appendCensusSection(
    detailBody,
    "Verified indicators · Census 2022",
    "Official Stats SA municipal population and household counts. Provincial unemployment is shown separately in the profile."
  );
  addDetailMessage(section, "Loading Census data", `Loading the source-linked profile for ${selected.name}…`, "finance-loading");
  if (selected.level === "ADM1") {
    void getProvinceCensusPopulation(selected.name).then((result) => {
      if (requestId !== state.overviewCensusRequestId ||
        state.tab !== "overview" || state.selected?.id !== selected.id) return;
      section.replaceChildren();
      const metrics = document.createElement("div");
      metrics.className = "census-metric-grid";
      appendCensusMetric(metrics, "Population · Census 2022", formatCensusNumber(result.population), "people · official provincial total");
      section.append(metrics);
      const source = document.createElement("p");
      source.className = "finance-source-note";
      source.textContent = `${result.source.publisher} · ${result.source.title} · ${result.source.table}.`;
      section.append(source);
      addSourceLink(section, result.source.url, "Open original Stats SA publication ↗");
    }).catch((error) => {
      if (requestId !== state.overviewCensusRequestId ||
        state.tab !== "overview" || state.selected?.id !== selected.id) return;
      section.replaceChildren();
      addDetailError(section, "Provincial Census data unavailable", `${error.message} Check your connection and try the request again.`, () => renderDetail());
    });
    return;
  }
  if (selected.level !== "ADM3") {
    section.replaceChildren();
    addDetailMessage(section, "Municipality-level Census data", "Select a municipality to view its Census population and household figures.");
    return;
  }
  void getMunicipalityCensus(selected.id).then((result) => {
    if (requestId !== state.overviewCensusRequestId ||
      state.tab !== "overview" || state.selected?.id !== selected.id) return;
    section.replaceChildren();
    if (!result.census || !hasVerifiedCensusSource(result)) {
      addDetailMessage(section, "Census profile unavailable", result.availability || "The source returned no Census record.");
      return;
    }
    const indicators = result.census.indicators;
    const metrics = document.createElement("div");
    metrics.className = "census-metric-grid";
    appendCensusMetric(metrics, "Population · 2022", formatCensusNumber(indicators.total_pop_2022), "people · Stats SA Census");
    appendCensusMetric(metrics, "Households · 2022", formatCensusNumber(indicators.households_2022), "households · Stats SA Census");
    appendCensusMetric(metrics, "Population change · 2011–2022", `${formatCensusNumber(indicators.growth_rate_2011_to_2022, 1)}%`, "reported Census growth rate");
    const pilot = result.basicServicesPilot;
    if (pilot && Number.isFinite(pilot.score) && Array.isArray(pilot.components) && pilot.components.length === 3) {
      appendCensusMetric(metrics, "Basic services pilot score · 2022", `${formatCensusNumber(pilot.score, 1)} / 100`, "equal-weighted · 3 household shares");
    }
    section.append(metrics);
    if (pilot) {
      const method = document.createElement("p");
      method.className = "source-check-note";
      method.textContent = `${pilot.method} ${pilot.limitation}`;
      section.append(method);
      pilot.components.forEach((component) => {
        const line = document.createElement("p");
        line.className = "finance-source-note";
        line.textContent = `${component.label}: ${formatCensusNumber(component.value, 2)} ${component.unit} · ${component.source}.`;
        section.append(line);
      });
    }
    if (result.source?.url) {
      const source = document.createElement("p");
      source.className = "finance-source-note";
      source.textContent = `${result.source.publisher} · ${result.source.title} · reporting periods ${result.source.reportingPeriods.join(" and ")}.`;
      section.append(source);
      addSourceLink(section, result.source.url, "Open original Stats SA publication ↗");
    }
    const button = document.createElement("button");
    button.className = "text-button";
    button.type = "button";
    button.textContent = "OPEN FULL DEMOGRAPHICS";
    button.addEventListener("click", () => setTab("demographics"));
    section.append(button);
  }).catch((error) => {
    if (requestId !== state.overviewCensusRequestId ||
      state.tab !== "overview" || state.selected?.id !== selected.id) return;
    section.replaceChildren();
    addDetailError(section, "Census data unavailable", `${error.message} Check your connection and try the request again.`, () => renderDetail());
  });
}

function renderClimateDetail() {
  const selected = state.selected;
  const requestId = ++state.climateRequestId;
  if (!selected) {
    addDetailMessage(detailBody, "Select a geography", "NASA POWER climate normals are available on demand for province, district and municipality boundaries.");
    return;
  }

  addDetailMessage(detailBody, "Loading climate normals", `Requesting NASA POWER climatology for ${selected.name}…`, "finance-loading");
  void getJson(`/api/geographies/${selected.level}/${encodeURIComponent(selected.id)}/climate`).then((result) => {
    if (requestId !== state.climateRequestId || state.tab !== "climate" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren();

    const note = document.createElement("p");
    note.className = "finance-source-note";
    note.textContent = `${result.geography.name} · ${result.source.period}. Climate values are sampled at a representative point within the boundary; they are not municipality-wide averages or station observations.`;
    detailBody.append(note);

    const metrics = document.createElement("div");
    metrics.className = "census-metric-grid";
    appendCensusMetric(metrics, "Annual mean temperature", `${formatCensusNumber(result.annual.temperatureC, 1)} °C`);
    appendCensusMetric(metrics, "Mean daily precipitation", `${formatCensusNumber(result.annual.precipitationMmPerDay, 2)} mm/day`);
    detailBody.append(metrics);

    const temperatureSection = appendCensusSection(
      detailBody,
      "Monthly mean temperature · °C",
      "NASA POWER 25-year meteorological climatology at the representative boundary point."
    );
    const temperatureChart = document.createElement("div");
    temperatureChart.className = "census-chart";
    const maximumTemperature = Math.max(...result.monthly.map((month) => month.temperatureC));
    result.monthly.forEach((month) =>
      appendCensusBar(temperatureChart, month.month, month.temperatureC, maximumTemperature, " °C")
    );
    temperatureSection.append(temperatureChart);

    const precipitationSection = appendCensusSection(
      detailBody,
      "Monthly mean daily precipitation · mm/day",
      "Values are daily climatological averages within each month, not monthly rainfall totals."
    );
    const precipitationChart = document.createElement("div");
    precipitationChart.className = "census-chart";
    const maximumPrecipitation = Math.max(...result.monthly.map((month) => month.precipitationMmPerDay));
    result.monthly.forEach((month) =>
      appendCensusBar(precipitationChart, month.month, month.precipitationMmPerDay, maximumPrecipitation, " mm/day")
    );
    precipitationSection.append(precipitationChart);

    const provenance = document.createElement("p");
    provenance.className = "finance-source-note";
    provenance.textContent = `Source: ${result.source.publisher} · ${result.source.source} · representative point ${result.coordinates.latitude}, ${result.coordinates.longitude} · fetched ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
    detailBody.append(provenance);
    addSourceLink(detailBody, result.source.url, "Open NASA POWER data portal ↗");

    const exportButton = document.createElement("button");
    exportButton.className = "action-button finance-export";
    exportButton.type = "button";
    exportButton.textContent = "Download climate normals";
    exportButton.addEventListener("click", () => {
      const rows = [
        ["geography", result.geography.name],
        ["boundary_level", result.geography.level],
        ["reporting_period", result.source.period],
        ["latitude", result.coordinates.latitude],
        ["longitude", result.coordinates.longitude],
        ["annual_mean_temperature_C", result.annual.temperatureC],
        ["annual_mean_daily_precipitation_mm_per_day", result.annual.precipitationMmPerDay],
        [],
        ["month", "mean_temperature_C", "mean_daily_precipitation_mm_per_day"],
        ...result.monthly.map((month) => [month.month, month.temperatureC, month.precipitationMmPerDay]),
        ["source", result.source.url]
      ];
      downloadCsv(
        `civicstats-${result.geography.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-climate.csv`,
        rows
      );
    });
    detailBody.append(exportButton);
  }).catch((error) => {
    if (requestId !== state.climateRequestId || state.tab !== "climate" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren();
    addDetailError(detailBody, "Climate data unavailable", `${error.message} No substitute values were used. Check your connection and try again.`);
    addSourceLink(detailBody, "https://power.larc.nasa.gov/", "Open NASA POWER data portal ↗");
  });
}

function addDetailMessage(parent, titleText, descriptionText, className = "empty-data") {
  const box = document.createElement("div");
  box.className = className;
  const title = document.createElement("strong");
  title.textContent = titleText;
  const description = document.createElement("p");
  description.textContent = descriptionText;
  box.append(title, description);
  parent.append(box);
}

function addRetryButton(parent, retry, label = "Try again") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button retry-button";
  button.textContent = label;
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Retrying…";
    retry();
  });
  parent.append(button);
}

function addDetailError(parent, titleText, descriptionText, retry = () => renderDetail()) {
  addDetailMessage(parent, titleText, descriptionText);
  addRetryButton(parent.lastElementChild, retry);
}

function addSourceLink(parent, href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  parent.append(link);
}

function renderFinanceDetail() {
  const requestId = ++state.financeRequestId;
  const selected = state.selected;
  const year = state.financeYear;
  const controls = document.createElement("div");
  controls.className = "finance-controls";

  const yearLabel = document.createElement("label");
  yearLabel.textContent = "REPORTING YEAR";
  const yearSelect = document.createElement("select");
  yearSelect.setAttribute("aria-label", "Finance reporting year");
  for (let optionYear = new Date().getUTCFullYear(); optionYear >= 2019; optionYear -= 1) {
    const option = document.createElement("option");
    option.value = String(optionYear);
    option.textContent = String(optionYear);
    option.selected = optionYear === year;
    yearSelect.append(option);
  }
  yearSelect.addEventListener("change", () => {
    state.financeYear = Number.parseInt(yearSelect.value, 10);
    state.financeType = "all";
    renderDetail();
  });
  yearLabel.append(yearSelect);

  const typeLabel = document.createElement("label");
  typeLabel.textContent = "SOURCE RECORD TYPE";
  const typeSelect = document.createElement("select");
  typeSelect.setAttribute("aria-label", "Finance amount type");
  typeSelect.disabled = true;
  typeLabel.append(typeSelect);
  controls.append(yearLabel, typeLabel);
  detailBody.append(controls);

  if (!selected) {
    addDetailMessage(detailBody, "Select a municipality", "Treasury finance facts are available for individual municipalities.");
    return;
  }
  if (selected.level !== "ADM3") {
    addDetailMessage(detailBody, "Municipality required", "Select an ADM3 municipality to request its annual Treasury facts.");
    return;
  }

  addDetailMessage(detailBody, "Connecting to National Treasury", `Loading the ${year} annual finance facts and audit opinion for ${selected.name}…`, "finance-loading");
  const financeUrl = `/api/municipalities/${encodeURIComponent(selected.id)}/finance?year=${year}`;
  const auditUrl = `/api/municipalities/${encodeURIComponent(selected.id)}/audit?year=${year}`;
  void Promise.allSettled([getJson(financeUrl), getJson(auditUrl)]).then(([financeResult, auditResult]) => {
    if (requestId !== state.financeRequestId || state.tab !== "finance" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren(controls);

    if (financeResult.status === "rejected") {
      addDetailError(
        detailBody,
        "Treasury finance data unavailable",
        `No finance values were substituted. ${financeResult.reason.message} Try again when the source is available.`
      );
    } else {
      renderFinanceRecords(detailBody, financeResult.value, typeSelect);
    }

    if (auditResult.status === "rejected") {
      addDetailError(detailBody, "Audit opinion unavailable", auditResult.reason.message);
    } else {
      renderAuditOpinion(detailBody, auditResult.value);
    }
  });
}

function renderFinanceRecords(parent, result, typeSelect) {
  const title = document.createElement("h3");
  title.className = "finance-section-title";
  title.textContent = "Annual finance facts";
  parent.append(title);

  const metadata = document.createElement("p");
  metadata.className = "finance-source-note";
  metadata.textContent = result.treasuryMunicipality
    ? `${result.treasuryMunicipality.name} · reporting year ${result.year} · amounts are in South African rand (ZAR). Function means service area; line item means the specific accounting entry; type is Treasury’s reporting category. Different types are kept separate.`
    : `No exact Treasury municipality and province match was found for ${result.municipality.name}; absence is not reported as zero.`;
  parent.append(metadata);

  if (!result.treasuryMunicipality) {
    addSourceLink(parent, "https://municipaldata.treasury.gov.za/", "Open National Treasury Municipal Money ↗");
    return;
  }

  const records = Array.isArray(result.rows) ? result.rows : [];
  const amountTypes = [...new Map(records.map((row) => {
    const code = String(row["amount_type.code"] ?? "unknown");
    return [code, { code, label: String(row["amount_type.label"] ?? code) }];
  })).values()];
  typeSelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All record types";
  typeSelect.append(allOption);
  amountTypes.forEach((amountType) => {
    const option = document.createElement("option");
    option.value = amountType.code;
    option.textContent = `${amountType.label} (${amountType.code})`;
    typeSelect.append(option);
  });
  typeSelect.disabled = amountTypes.length === 0;
  typeSelect.value = amountTypes.some((item) => item.code === state.financeType)
    ? state.financeType
    : amountTypes.some((item) => item.code === "AUDA")
      ? "AUDA"
      : amountTypes.some((item) => item.code === "ADJB")
        ? "ADJB"
        : "all";
  state.financeType = typeSelect.value;

  const recordsContainer = document.createElement("div");
  recordsContainer.className = "finance-records";
  const supplementalContainer = document.createElement("div");
  supplementalContainer.className = "finance-supplemental";
  parent.append(recordsContainer, supplementalContainer);
  const renderRows = () => {
    const filtered = state.financeType === "all"
      ? records
      : records.filter((row) => row["amount_type.code"] === state.financeType);
    recordsContainer.replaceChildren();

    renderFinanceSummary(recordsContainer, filtered, state.financeType);
    const summary = document.createElement("p");
    summary.className = "finance-source-note";
    summary.textContent = `${filtered.length.toLocaleString("en-ZA")} displayed record${filtered.length === 1 ? "" : "s"} · ${Number(result.totalRecords).toLocaleString("en-ZA")} total source records. Amounts are integer South African rand (ZAR).`;
    recordsContainer.append(summary);

    if (!filtered.length) {
      addDetailMessage(recordsContainer, "No finance records returned", `National Treasury returned no ${state.financeYear} records for this selection. This is not a zero balance.`);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "finance-table-wrap";
    const table = document.createElement("table");
    table.className = "data-table finance-table";
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    ["Function", "Line item", "Type", "Amount"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      header.append(th);
    });
    thead.append(header);
    const tbody = document.createElement("tbody");
    filtered.slice(0, 40).forEach((row) => {
      const tr = document.createElement("tr");
      const amount = row["amount.sum"];
      [
        row["function.label"] ?? row["function.code"] ?? "—",
        row["item.label"] ?? row["item.code"] ?? "—",
        row["amount_type.label"] ?? row["amount_type.code"] ?? "Not labelled by source",
        typeof amount === "number" && Number.isFinite(amount)
          ? new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2 }).format(amount)
          : "—"
      ].forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (index === 2) td.title = `Treasury type code: ${row["amount_type.code"] ?? "not supplied"}`;
        if (index === 3) td.className = "mono";
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    recordsContainer.append(wrap);

    if (filtered.length > 40) {
      const capped = document.createElement("p");
      capped.className = "finance-source-note";
      capped.textContent = `Showing the first 40 of ${filtered.length.toLocaleString("en-ZA")} records. Download the full filtered result for all rows.`;
      recordsContainer.append(capped);
    }

    const exportButton = document.createElement("button");
    exportButton.className = "action-button finance-export";
    exportButton.type = "button";
    exportButton.textContent = "Download current results";
    exportButton.addEventListener("click", () => {
      const rows = [[
        "municipality", "province", "reporting_year", "function_code", "function",
        "line_item_code", "line_item", "amount_type_code", "amount_type", "source_amount_ZAR"
      ]];
      filtered.forEach((row) => rows.push([
        result.municipality.name, result.municipality.province, result.year,
        row["function.code"], row["function.label"], row["item.code"], row["item.label"],
        row["amount_type.code"], row["amount_type.label"], row["amount.sum"]
      ]));
      rows.push(["source", result.sourceUrl]);
      downloadCsv(`civicstats-${result.municipality.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-finance-${result.year}.csv`, rows);
    });
    recordsContainer.append(exportButton);
    renderFinanceSupplemental(supplementalContainer, result);
  };

  typeSelect.addEventListener("change", () => {
    state.financeType = typeSelect.value;
    renderRows();
  });
  renderRows();
  const sourceLine = document.createElement("p");
  sourceLine.className = "finance-source-note";
  sourceLine.textContent = `Source: ${result.source} · fetched ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
  parent.append(sourceLine);
  addSourceLink(parent, result.sourceUrl, "Open source records ↗");
}

function renderFinanceSupplemental(parent, result) {
  parent.replaceChildren();
  const definitions = [
    ["financialPosition", "Financial position · assets and liabilities", "item.label"],
    ["capital", "Capital acquisition · expenditure", "item.label"],
    ["grants", "Government grants", "grant.label"],
    ["repairsMaintenance", "Repairs and maintenance", "item.label"],
    ["uifw", "Unauthorised, irregular, fruitless and wasteful expenditure", "item.label"]
  ];

  definitions.forEach(([key, title, labelKey]) => {
    const dataset = result.supplemental?.[key];
    if (!dataset) return;
    const section = document.createElement("details");
    section.className = "finance-supplement";
    if (key === "financialPosition" || key === "capital") section.open = true;
    const heading = document.createElement("summary");
    heading.textContent = title;
    section.append(heading);

    if (dataset.error) {
      addDetailError(section, "Supplemental Treasury data unavailable", `${dataset.error} The income and expenditure records above remain available independently. Try again to reload this section.`);
      parent.append(section);
      return;
    }

    const rawRows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const selectedRows = key === "uifw" || state.financeType === "all"
      ? rawRows
      : rawRows.filter((row) => row["amount_type.code"] === state.financeType);
    const numericRows = selectedRows.filter((row) => {
      const amount = row["amount.sum"] ?? row.amount;
      return typeof amount === "number" && Number.isFinite(amount);
    });
    const summaryNote = document.createElement("p");
    summaryNote.className = "finance-source-note";
    summaryNote.textContent = `${numericRows.length.toLocaleString("en-ZA")} numeric source records${key === "uifw" ? ` · reporting year ${result.year}` : ` · amount type ${state.financeType === "all" ? "all types" : state.financeType}`}. Blank source amounts are not treated as zero.`;
    section.append(summaryNote);

    if (dataset.totalRecords > 0 && !numericRows.length) {
      addDetailMessage(section, "No numeric values reported", "The source returned no numeric amounts for this reporting year and record type. This is not a zero balance.");
    } else if (!numericRows.length) {
      addDetailMessage(section, "No records returned", "National Treasury returned no records for this dataset and year. This is not a zero balance.");
    } else {
      const wrap = document.createElement("div");
      wrap.className = "finance-table-wrap";
      const table = document.createElement("table");
      table.className = "data-table finance-table";
      const thead = document.createElement("thead");
      const header = document.createElement("tr");
      ["Source line", "Record type", "Amount (ZAR)"].forEach((label) => {
        const cell = document.createElement("th");
        cell.textContent = label;
        header.append(cell);
      });
      thead.append(header);
      const tbody = document.createElement("tbody");
      numericRows.slice(0, 30).forEach((row) => {
        const type = row["amount_type.label"] ?? row["amount_type.code"] ?? "Reported amount";
        const line = key === "capital"
          ? [row["function.label"], row[labelKey], row["capital_type.label"]].filter(Boolean).join(" · ")
          : row[labelKey] ?? row["item.code"] ?? row["grant.code"] ?? "Source line not named";
        const amount = row["amount.sum"] ?? row.amount;
        const tr = document.createElement("tr");
        [line, type, formatRand(amount)].forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          if (index === 2) cell.className = "mono";
          tr.append(cell);
        });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      wrap.append(table);
      section.append(wrap);
      if (numericRows.length > 30) {
        const capped = document.createElement("p");
        capped.className = "finance-source-note";
        capped.textContent = `Showing 30 of ${numericRows.length.toLocaleString("en-ZA")} source rows.`;
        section.append(capped);
      }
    }
    if (dataset.sourceUrl) addSourceLink(section, dataset.sourceUrl, "Open this Treasury dataset ↗");
    parent.append(section);
  });
}

function formatRand(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not reported";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(value);
}

function sumFinanceItem(records, itemCode) {
  const matching = records.filter((row) =>
    String(row["item.code"]) === itemCode &&
    typeof row["amount.sum"] === "number" &&
    Number.isFinite(row["amount.sum"])
  );
  if (!matching.length) return null;
  return matching.reduce((total, row) => total + row["amount.sum"], 0);
}

function financeAmountTypeLabel(records, code) {
  return records.find((row) => row["amount_type.code"] === code)?.["amount_type.label"] ?? code;
}

function renderFinanceSummary(parent, records, selectedType) {
  const definitions = [
    ["2900", "Total revenue", "Excluding capital transfers and contributions"],
    ["4400", "Total expenditure", "Treasury-reported total expenditure"],
    ["4500", "Surplus / (deficit)", "Source-reported result"]
  ];
  const types = selectedType === "all"
    ? [...new Set(records.map((row) => row["amount_type.code"]).filter(Boolean))]
    : [selectedType];
  if (!types.length) return;

  const heading = document.createElement("h3");
  heading.className = "finance-section-title";
  heading.textContent = "Financial headline totals";
  parent.append(heading);
  const note = document.createElement("p");
  note.className = "finance-source-note";
  note.textContent = selectedType === "all"
    ? "Each reporting type is shown separately. Totals aggregate matching Treasury line items across functions; budget and audited values are not combined."
    : `${financeAmountTypeLabel(records, selectedType)} (${selectedType}) · line items aggregated across functions.`;
  parent.append(note);

  types.forEach((type) => {
    const typeRecords = records.filter((row) => row["amount_type.code"] === type);
    const grid = document.createElement("div");
    grid.className = "finance-summary-grid";
    definitions.forEach(([code, label, description]) => {
      const metric = document.createElement("article");
      metric.className = "census-metric finance-summary-metric";
      const title = document.createElement("span");
      title.textContent = label;
      const amount = document.createElement("strong");
      amount.textContent = formatRand(sumFinanceItem(typeRecords, code));
      const caption = document.createElement("small");
      caption.textContent = `${description} · ${type}`;
      metric.append(title, amount, caption);
      addMetricExplanation(metric, label, `${description} · ${type}`);
      grid.append(metric);
    });
    parent.append(grid);
  });
}

function renderEconomyDetail() {
  const requestId = ++state.economyRequestId;
  if (state.selected?.level === "ADM1") {
    renderProvincialUnemploymentDetail(requestId);
    return;
  }
  const selected = state.selected;
  const year = state.financeYear;
  const controls = document.createElement("div");
  controls.className = "finance-controls census-controls";
  const yearLabel = document.createElement("label");
  yearLabel.textContent = "REPORTING YEAR";
  const yearSelect = document.createElement("select");
  yearSelect.setAttribute("aria-label", "Economic activity reporting year");
  for (let optionYear = new Date().getUTCFullYear(); optionYear >= 2019; optionYear -= 1) {
    const option = document.createElement("option");
    option.value = String(optionYear);
    option.textContent = String(optionYear);
    option.selected = optionYear === year;
    yearSelect.append(option);
  }
  yearSelect.addEventListener("change", () => {
    state.financeYear = Number.parseInt(yearSelect.value, 10);
    renderDetail();
  });
  yearLabel.append(yearSelect);
  controls.append(yearLabel);
  detailBody.append(controls);

  const scopeNote = document.createElement("p");
  scopeNote.className = "finance-source-note";
  scopeNote.textContent = "Available here: municipal revenue by Treasury line item. These financial flows describe the municipality's own reported accounts; they are not local GDP, business turnover, industry output or an unemployment rate.";
  detailBody.append(scopeNote);

  if (!selected) {
    addDetailMessage(detailBody, "Select a municipality", "Treasury revenue activity is available for individual municipalities.");
    renderNationalEconomyContext(detailBody, requestId, null);
    return;
  }
  if (selected.level !== "ADM3") {
    addDetailMessage(detailBody, "Municipality required", "Select an ADM3 municipality to request its annual Treasury revenue facts.");
    renderNationalEconomyContext(detailBody, requestId, selected.id);
    return;
  }

  addDetailMessage(detailBody, "Connecting to National Treasury", `Loading ${year} municipal revenue records for ${selected.name}…`, "finance-loading");
  const financeUrl = `/api/municipalities/${encodeURIComponent(selected.id)}/finance?year=${year}`;
  void getJson(financeUrl).then((result) => {
    if (requestId !== state.economyRequestId || state.tab !== "economy" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren(controls, scopeNote);
    renderEconomyRevenue(detailBody, result);
    renderNationalEconomyContext(detailBody, requestId, selected.id);
  }).catch((error) => {
    if (requestId !== state.economyRequestId || state.tab !== "economy" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren(controls, scopeNote);
    addDetailError(detailBody, "Treasury revenue data unavailable", `${error.message} No figures were substituted. Try again when the source is available.`);
    addSourceLink(detailBody, "https://municipaldata.treasury.gov.za/", "Open National Treasury Municipal Money ↗");
    renderNationalEconomyContext(detailBody, requestId, selected.id);
  });
}

function renderProvincialUnemploymentDetail(economyRequestId) {
  const selected = state.selected;
  const requestId = ++state.labourProfileRequestId;
  if (!selected) {
    addDetailMessage(detailBody, "Select a province", "Quarterly unemployment estimates are available for all nine provinces.");
    renderNationalEconomyContext(detailBody, economyRequestId, null);
    return;
  }
  if (selected.level !== "ADM1") {
    addDetailMessage(detailBody, "Province-level unemployment data", "These Stats SA survey estimates describe provinces, not individual municipalities. Change the map boundary level to Provinces and select one to explore its unemployment rate.");
    addSourceLink(detailBody, "https://www.statssa.gov.za/publications/P0211/P02113rdQuarter2026.pdf", "Open the QLFS Q3 2026 release ↗");
    renderNationalEconomyContext(detailBody, economyRequestId, selected.id);
    return;
  }

  addDetailMessage(detailBody, "Loading provincial labour data", `Loading the Stats SA QLFS series for ${selected.name}…`, "finance-loading");
  void loadProvincialLabourData().then((dataset) => {
    if (requestId !== state.labourProfileRequestId || state.tab !== "economy" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren();
    if (!dataset) {
      addDetailError(detailBody, "Provincial unemployment data unavailable", `${state.labourMapError ?? "The data endpoint did not return the Stats SA dataset."} Try again to request the source data.`);
      addSourceLink(detailBody, "https://www.statssa.gov.za/publications/P0211/P02113rdQuarter2026.pdf", "Open the official Stats SA release ↗");
      renderNationalEconomyContext(detailBody, economyRequestId, selected.id);
      return;
    }

    const province = dataset.records.find((record) => record.province === selected.name);
    if (!province) {
      addDetailMessage(detailBody, "No province match", `The selected boundary “${selected.name}” does not match a province in the Stats SA release. No rate was inferred.`);
      renderNationalEconomyContext(detailBody, economyRequestId, selected.id);
      return;
    }
    renderProvincialLabourData(detailBody, province, dataset);
    renderNationalEconomyContext(detailBody, economyRequestId, selected.id);
  });
}

function renderProvincialLabourData(parent, selectedProvince, dataset) {
  const periodControl = document.createElement("label");
  periodControl.className = "finance-type-control";
  periodControl.textContent = "REPORTING QUARTER";
  const periodSelect = document.createElement("select");
  periodSelect.setAttribute("aria-label", "Provincial unemployment reporting quarter");
  dataset.periods.forEach((period) => {
    const option = document.createElement("option");
    option.value = period.code;
    option.textContent = period.label;
    periodSelect.append(option);
  });
  periodSelect.value = state.labourQuarter;
  periodControl.append(periodSelect);
  parent.append(periodControl);

  const headline = document.createElement("p");
  headline.className = "finance-source-note";
  headline.textContent = `${selectedProvince.province} · Stats SA quarterly survey estimates. These rates are provincial estimates and must not be interpreted as municipality-level values.`;
  parent.append(headline);

  const metrics = document.createElement("div");
  metrics.className = "finance-summary-grid labour-summary-grid";
  const definitions = [
    ["officialRate", "Official unemployment rate", "Share of the labour force unemployed"],
    ["lu3Rate", "Expanded unemployment (LU3)", "Unemployment plus potential labour force"]
  ];
  const metricElements = new Map();
  definitions.forEach(([key, title, caption]) => {
    const metric = document.createElement("article");
    metric.className = "census-metric finance-summary-metric";
    const label = document.createElement("span");
    label.textContent = title;
    const value = document.createElement("strong");
    const note = document.createElement("small");
    note.textContent = caption;
    metric.append(label, value, note);
    addMetricExplanation(metric, title, caption);
    metrics.append(metric);
    metricElements.set(key, value);
  });
  parent.append(metrics);

  const seriesHeading = document.createElement("h3");
  seriesHeading.className = "finance-section-title";
  seriesHeading.textContent = "Quarterly trend · percent";
  parent.append(seriesHeading);
  const series = document.createElement("div");
  series.className = "labour-series-list";
  const provinceSeries = dataset.periods.map((period) => ({
    period,
    record: dataset.records.find((record) =>
      record.province === selectedProvince.province && record.quarter === period.code
    )
  })).filter((item) => item.record);
  provinceSeries.forEach(({ period, record }) => {
    const row = document.createElement("div");
    row.className = "labour-series-row";
    row.classList.toggle("current", period.code === state.labourQuarter);
    row.setAttribute("aria-label", `${period.label}: official unemployment ${record.officialRate} percent; LU3 ${record.lu3Rate} percent`);
    const label = document.createElement("span");
    label.className = "labour-series-period";
    label.textContent = period.label;
    const values = document.createElement("div");
    values.className = "labour-series-values";
    [
      ["Official", record.officialRate, "official"],
      ["LU3", record.lu3Rate, "lu3"]
    ].forEach(([name, value, className]) => {
      const line = document.createElement("div");
      line.className = "labour-series-line";
      const caption = document.createElement("span");
      caption.textContent = name;
      const track = document.createElement("div");
      track.className = "census-bar-track";
      const fill = document.createElement("span");
      fill.className = className;
      fill.style.width = `${Math.max(0, Math.min(100, (value / 60) * 100))}%`;
      track.append(fill);
      const amount = document.createElement("strong");
      amount.textContent = `${value.toFixed(1)}%`;
      line.append(caption, track, amount);
      values.append(line);
    });
    row.append(label, values);
    series.append(row);
  });
  parent.append(series);

  const metadata = document.createElement("p");
  metadata.className = "finance-source-note";
  metadata.textContent = `${dataset.source.title} · ${dataset.source.table} · released ${dataset.source.releaseDate} · page ${dataset.source.page}. Survey estimates are subject to sampling error.`;
  parent.append(metadata);
  addSourceLink(parent, dataset.source.sourceUrl, "Open original Stats SA QLFS release ↗");
  const exportButton = document.createElement("button");
  exportButton.className = "action-button finance-export";
  exportButton.type = "button";
  exportButton.textContent = "Download provincial unemployment data";
  exportButton.addEventListener("click", () => {
    const rows = [
      ["province", "quarter", "official_unemployment_rate_percent", "expanded_unemployment_LU3_percent", "source", "source_table"],
      ...provinceSeries.map(({ period, record }) => [
        record.province,
        period.label,
        record.officialRate,
        record.lu3Rate,
        dataset.source.sourceUrl,
        dataset.source.table
      ])
    ];
    downloadCsv(`civicstats-${selectedProvince.province.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-unemployment.csv`, rows);
  });
  parent.append(exportButton);

  const updateMetrics = () => {
    const record = dataset.records.find((item) =>
      item.province === selectedProvince.province && item.quarter === periodSelect.value
    );
    if (!record) return;
    state.labourQuarter = periodSelect.value;
    metricElements.get("officialRate").textContent = `${record.officialRate.toFixed(1)}%`;
    metricElements.get("lu3Rate").textContent = `${record.lu3Rate.toFixed(1)}%`;
    setLabourQuarter(periodSelect.value);
    series.querySelectorAll(".labour-series-row").forEach((row) =>
      row.classList.toggle("current", row.getAttribute("aria-label").startsWith(
        dataset.periods.find((period) => period.code === periodSelect.value)?.label ?? ""
      ))
    );
  };
  periodSelect.addEventListener("change", updateMetrics);
  updateMetrics();
}

function renderEconomyRevenue(parent, result) {
  if (!result.treasuryMunicipality) {
    addDetailMessage(parent, "No exact Treasury match", `No exact municipality and province match was found for ${result.municipality.name}; no economic figures are inferred.`);
    addSourceLink(parent, "https://municipaldata.treasury.gov.za/", "Open National Treasury Municipal Money ↗");
    return;
  }

  const typeLabel = document.createElement("label");
  typeLabel.className = "finance-type-control";
  typeLabel.textContent = "SOURCE RECORD TYPE";
  const typeSelect = document.createElement("select");
  typeSelect.setAttribute("aria-label", "Economic activity amount type");
  const amountTypes = [...new Map(result.rows.map((row) => {
    const code = String(row["amount_type.code"] ?? "unknown");
    return [code, { code, label: String(row["amount_type.label"] ?? code) }];
  })).values()];
  amountTypes.forEach(({ code, label }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${label} (${code})`;
    typeSelect.append(option);
  });
  typeSelect.value = amountTypes.some(({ code }) => code === state.financeType)
    ? state.financeType
    : amountTypes.some(({ code }) => code === "AUDA")
      ? "AUDA"
      : amountTypes.some(({ code }) => code === "ADJB")
        ? "ADJB"
        : amountTypes[0]?.code ?? "";
  state.financeType = typeSelect.value;
  typeLabel.append(typeSelect);
  parent.append(typeLabel);

  const activityDefinitions = [
    ["0300", "Electricity service charges"],
    ["0400", "Water service charges"],
    ["0500", "Wastewater service charges"],
    ["0600", "Waste management service charges"],
    ["1800", "Property rates"],
    ["2200", "Operational transfers and subsidies"],
    ["2400", "Fuel levy"]
  ];
  const note = document.createElement("p");
  note.className = "finance-source-note";
  note.textContent = `${result.treasuryMunicipality.name} · ${result.year} · source: National Treasury. Category totals are summed from matching line items across functions and kept separate by record type.`;
  parent.append(note);

  const chart = document.createElement("div");
  chart.className = "finance-activity-list";
  parent.append(chart);
  const render = () => {
    chart.replaceChildren();
    const records = result.rows.filter((row) => row["amount_type.code"] === typeSelect.value);
    const entries = activityDefinitions.map(([code, label]) => ({
      code,
      label,
      value: sumFinanceItem(records, code)
    })).filter((entry) => entry.value !== null);
    if (!entries.length) {
      addDetailMessage(chart, "No revenue line items returned", `National Treasury did not return these revenue categories for ${result.year} and ${typeSelect.value}. This is not a zero balance.`);
      return;
    }
    const maximum = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1);
    entries.forEach(({ code, label, value }) => {
      const row = document.createElement("div");
      row.className = "finance-activity-row";
      const heading = document.createElement("div");
      heading.className = "finance-activity-heading";
      const name = document.createElement("span");
      name.textContent = label;
      const amount = document.createElement("strong");
      amount.textContent = formatRand(value);
      heading.append(name, amount);
      const track = document.createElement("div");
      track.className = "census-bar-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.style.width = `${Math.max(0, Math.min(100, (Math.abs(value) / maximum) * 100))}%`;
      track.append(fill);
      const sourceCode = document.createElement("small");
      sourceCode.textContent = `Treasury item ${code}`;
      row.append(heading, track, sourceCode);
      chart.append(row);
    });
  };
  typeSelect.addEventListener("change", () => {
    state.financeType = typeSelect.value;
    render();
  });
  render();
  const provenance = document.createElement("p");
  provenance.className = "finance-source-note";
  provenance.textContent = `Amounts are integer South African rand; selected record type: ${typeSelect.selectedOptions[0]?.textContent ?? "not specified"}. Labour-market and industry indicators are not included in this financial dataset.`;
  parent.append(provenance);
  addSourceLink(parent, "https://municipaldata.treasury.gov.za/docs", "Treasury API methodology ↗");
  addSourceLink(parent, "https://census.statssa.gov.za/", "Stats SA Census data portal ↗");
}

function renderNationalEconomyContext(parent, requestId, selectedId) {
  renderProvincialGdpContext(parent, requestId, selectedId);
  const section = appendCensusSection(
    parent,
    "South Africa · national economic context",
    "World Bank World Development Indicators. These country-level series are not provincial or municipal output."
  );
  addDetailMessage(section, "Loading national economic indicators", "Fetching the latest available annual GDP and sector-value-added series…", "finance-loading");
  void getJson("/api/economy/national").then((result) => {
    if (requestId !== state.economyRequestId || state.tab !== "economy" || state.selected?.id !== selectedId) return;
    section.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "South Africa · national economic context";
    section.append(heading);
    const note = document.createElement("p");
    note.className = "census-section-note";
    note.textContent = result.source.note;
    section.append(note);

    const metrics = document.createElement("div");
    metrics.className = "census-metric-grid";
    const errors = [];
    result.indicators.forEach((indicator) => {
      if (indicator.error || !indicator.values.length) {
        errors.push(`${indicator.label}: ${indicator.error ?? "no numeric observations returned"}`);
        return;
      }
      const latest = indicator.values.at(-1);
      let value;
      if (indicator.unit === "current US$") {
        value = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 2
        }).format(latest.value);
      } else {
        value = `${formatCensusNumber(latest.value, 2)}%`;
      }
      appendCensusMetric(metrics, indicator.label, value, `Latest available: ${latest.year} · ${indicator.unit}`);
    });
    section.append(metrics);

    const gdp = result.indicators.find((indicator) => indicator.key === "gdpCurrentUsd");
    if (gdp?.values.length) {
      const trend = appendCensusSection(
        section,
        "Nominal GDP trend · current US$ billions",
        "Annual current-dollar values are nominal and are not adjusted for inflation."
      );
      const chart = document.createElement("div");
      chart.className = "census-chart";
      const values = gdp.values.slice(-8).map((record) => ({ year: record.year, value: record.value / 1e9 }));
      const maximum = Math.max(...values.map((record) => record.value));
      values.forEach((record) =>
        appendCensusBar(chart, String(record.year), record.value, maximum, " bn US$")
      );
      trend.append(chart);
    }

    if (errors.length) {
      const warning = document.createElement("p");
      warning.className = "finance-source-note";
      warning.textContent = `Some World Bank series could not be loaded: ${errors.join(" · ")}`;
      section.append(warning);
    }
    const provenance = document.createElement("p");
    provenance.className = "finance-source-note";
    provenance.textContent = `Source: ${result.source.publisher} · ${result.source.dataset} · fetched ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
    section.append(provenance);
    addSourceLink(section, result.source.url, "Open World Bank South Africa indicators ↗");

    const exportButton = document.createElement("button");
    exportButton.className = "action-button finance-export";
    exportButton.type = "button";
    exportButton.textContent = "Download national economic data";
    exportButton.addEventListener("click", () => {
      const rows = [["country", "indicator", "indicator_code", "year", "value", "unit", "source"]];
      result.indicators.forEach((indicator) => indicator.values.forEach((record) => {
        rows.push([
          result.country,
          indicator.label,
          indicator.code,
          record.year,
          record.value,
          indicator.unit,
          indicator.sourceUrl ?? result.source.url
        ]);
      }));
      downloadCsv("civicstats-south-africa-national-economy.csv", rows);
    });
    section.append(exportButton);
  }).catch((error) => {
    if (requestId !== state.economyRequestId || state.tab !== "economy" || state.selected?.id !== selectedId) return;
    section.replaceChildren();
    addDetailError(section, "National economic indicators unavailable", `${error.message} No source substitution was used. Try again to contact the source.`);
    addSourceLink(section, "https://data.worldbank.org/country/south-africa", "Open World Bank South Africa data ↗");
  });
}

function renderProvincialGdpContext(parent, requestId, selectedId) {
  const section = appendCensusSection(
    parent,
    "Provincial economic activity · Stats SA GDP-R",
    "GDP and industry value added are reported at province level only. They are not municipal GDP, business turnover or employment."
  );
  addDetailMessage(section, "Loading provincial GDP-R data", `Loading the source-linked 2014–2024 provincial series for ${state.economyMapYear}…`, "finance-loading");
  void loadProvincialGdpData(state.economyMapYear).then((dataset) => {
    if (requestId !== state.economyRequestId || state.tab !== "economy" || state.selected?.id !== selectedId) return;
    section.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Provincial economic activity · Stats SA GDP-R";
    section.append(heading);
    if (!dataset) {
      addDetailError(section, "Provincial GDP-R unavailable", `${state.economyMapError ?? "The Stats SA dataset could not be loaded."} No values were substituted. Try again to load this dataset.`);
      addSourceLink(section, "https://www.statssa.gov.za/publications/P04412/P044122024.pdf", "Open Stats SA Provincial GDP, 2024 ↗");
      return;
    }

    const selected = state.selected?.id === selectedId ? state.selected : null;
    const provinceName = selected?.level === "ADM1" ? selected.name : selected?.province;
    const selectedProvince = dataset.records.find((record) => record.province === provinceName);
    const periodControl = document.createElement("label");
    periodControl.className = "finance-type-control";
    periodControl.textContent = "REPORTING YEAR";
    const yearSelect = document.createElement("select");
    yearSelect.setAttribute("aria-label", "Provincial GDP-R reporting year");
    [...dataset.availableYears].reverse().forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      option.selected = year === dataset.year;
      yearSelect.append(option);
    });
    yearSelect.addEventListener("change", () => {
      state.economyMapYear = Number(yearSelect.value);
      const mapYear = document.querySelector("#economy-year");
      if (mapYear) mapYear.value = String(state.economyMapYear);
      void loadProvincialGdpData(state.economyMapYear).then(() => {
        refreshMapStyles();
        if (state.tab === "economy") renderDetail();
      });
    });
    periodControl.append(yearSelect);
    section.append(periodControl);

    const note = document.createElement("p");
    note.className = "census-section-note";
    note.textContent = `${dataset.source.publisher} · ${dataset.source.title} (${dataset.source.reportNumber}), released ${dataset.source.publicationDate}. Reporting year ${dataset.year}; nominal values are in R million.`;
    section.append(note);

    const nationalMetrics = document.createElement("div");
    nationalMetrics.className = "census-metric-grid";
    appendCensusMetric(
      nationalMetrics,
      `National GDP · ${dataset.year}`,
      `R${formatCensusNumber(dataset.national.gdpCurrentPricesRandMillions / 1000, 1)} bn`,
      "current prices · nominal"
    );
    appendCensusMetric(
      nationalMetrics,
      `National real GDP growth · ${dataset.year}`,
      `${formatCensusNumber(dataset.national.realGdpGrowthPercent, 1)}%`,
      "Stats SA GDP-R"
    );
    section.append(nationalMetrics);

    const provinceRows = [...dataset.records]
      .sort((left, right) => right.gdpContributionPercent - left.gdpContributionPercent);
    const tableSection = appendCensusSection(
      section,
      `Provincial contribution to national GDP · ${dataset.year}`,
      `Share of national GDP at current prices. ${provinceName ? `Selected geographic context: ${provinceName}; this is not a municipality-level estimate.` : "Select a province for its industry breakdown."}`
    );
    const tableWrap = document.createElement("div");
    tableWrap.className = "data-table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const header = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Province", "GDP share", "GDP · R million", "Real growth"].forEach((label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      headerRow.append(cell);
    });
    header.append(headerRow);
    const body = document.createElement("tbody");
    provinceRows.forEach((record) => {
      const row = document.createElement("tr");
      if (record.province === provinceName) row.classList.add("selected-row");
      [
        record.province,
        `${formatCensusNumber(record.gdpContributionPercent, 1)}%`,
        formatCensusNumber(record.gdpCurrentPricesRandMillions),
        `${formatCensusNumber(record.realGdpGrowthPercent, 1)}%`
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      body.append(row);
    });
    table.append(header, body);
    tableWrap.append(table);
    tableSection.append(tableWrap);

    if (selectedProvince) {
      const industrySection = appendCensusSection(
        section,
        `${selectedProvince.province} · industry activity · ${dataset.year}`,
        "Gross value added by published industry at current prices. Subtotal groups are excluded to avoid double counting. Values are R million."
      );
      const industries = [...selectedProvince.industries]
        .sort((left, right) => right.gvaCurrentPricesRandMillions - left.gvaCurrentPricesRandMillions);
      const maximum = Math.max(...industries.map((item) => item.gvaCurrentPricesRandMillions), 1);
      const chart = document.createElement("div");
      chart.className = "census-chart";
      industries.forEach((item) => appendCensusBar(
        chart,
        item.activity,
        item.gvaCurrentPricesRandMillions,
        maximum,
        " R million"
      ));
      industrySection.append(chart);
      const detailMetrics = document.createElement("div");
      detailMetrics.className = "census-metric-grid";
      appendCensusMetric(
        detailMetrics,
        `${selectedProvince.province} GDP · ${dataset.year}`,
        `R${formatCensusNumber(selectedProvince.gdpCurrentPricesRandMillions / 1000, 1)} bn`,
        "current prices · nominal"
      );
      appendCensusMetric(
        detailMetrics,
        "Share of national GDP",
        `${formatCensusNumber(selectedProvince.gdpContributionPercent, 1)}%`
      );
      appendCensusMetric(
        detailMetrics,
        "Real GDP growth",
        `${formatCensusNumber(selectedProvince.realGdpGrowthPercent, 1)}%`,
        "constant-price measure"
      );
      industrySection.append(detailMetrics);
    }

    const provenance = document.createElement("p");
    provenance.className = "finance-source-note";
    provenance.textContent = `${dataset.source.note} Values are from the bundled extraction; source publication date: ${dataset.source.publicationDate}.`;
    section.append(provenance);
    addSourceLink(section, dataset.source.url, "Open original Stats SA GDP-R report ↗");
    const exportButton = document.createElement("button");
    exportButton.className = "action-button finance-export";
    exportButton.type = "button";
    exportButton.textContent = "Download provincial GDP-R data";
    exportButton.addEventListener("click", () => {
      const rows = [[
        "province", "year", "gdp_current_prices_rand_millions", "share_of_national_gdp_percent",
        "real_gdp_growth_percent", "industry", "industry_gva_current_prices_rand_millions", "source"
      ]];
      dataset.records.forEach((record) => record.industries.forEach((industry) => {
        rows.push([
          record.province,
          dataset.year,
          record.gdpCurrentPricesRandMillions,
          record.gdpContributionPercent,
          record.realGdpGrowthPercent,
          industry.activity,
          industry.gvaCurrentPricesRandMillions,
          dataset.source.title
        ]);
      }));
      downloadCsv(`civicstats-provincial-gdp-r-${dataset.year}.csv`, rows);
    });
    section.append(exportButton);
  });
}

function renderAuditOpinion(parent, result) {
  const title = document.createElement("h3");
  title.className = "finance-section-title";
  title.textContent = `Audit opinion · FY ${result.year}`;
  parent.append(title);

  if (!result.rows.length) {
    addDetailMessage(
      parent,
      `No audit-opinion record returned for ${result.year}`,
      "This does not mean that no audit occurred or that the municipality received a clean audit."
    );
    return;
  }

  result.rows.forEach((row) => {
    const entry = document.createElement("div");
    entry.className = "audit-opinion";
    const label = document.createElement("strong");
    label.textContent = row.opinion ?? "Opinion not specified by source";
    entry.append(label);
    if (row.reportUrl) addSourceLink(entry, row.reportUrl, "Open Treasury-hosted audit report ↗");
    parent.append(entry);
  });
  const source = document.createElement("p");
  source.className = "finance-source-note";
  source.textContent = `Source: ${result.source}.`;
  parent.append(source);
}

function renderPoliticsDetail() {
  const requestId = ++state.politicsRequestId;
  const selected = state.selected;
  const latestElection = {
    year: 2026,
    checkedDate: "2026-11-10",
    update: "The IEC reported results declared on 9 November 2026 and ordered a revote for one Siyancuma voting district on 10 November 2026. A verified 2026 municipal seat dataset has not been imported here; consult the IEC for current results.",
    resultsUrl: "https://results.elections.org.za/home/Downloads/ME-Results",
    wardCouncillorsUrl: "https://www.elections.org.za/pw/StatsData/List-Of-Current-Ward-Councillors"
  };
  const appendLatestElection = () => {
    const section = appendCensusSection(
      detailBody,
      `${latestElection.year} election update`,
      `${latestElection.update} Checked ${latestElection.checkedDate}.`
    );
    addSourceLink(section, latestElection.resultsUrl, "Open IEC 2026 election results ↗");
    addSourceLink(section, latestElection.wardCouncillorsUrl, "Open IEC current ward-councillor list ↗");
    const note = document.createElement("p");
    note.className = "finance-source-note";
    note.textContent = "The IEC councillor list covers ward councillors only; it is not the full council composition.";
    section.append(note);
  };

  detailBody.replaceChildren();
  appendLatestElection();
  if (!selected) {
    addDetailMessage(detailBody, "Select a municipality", "Dated elected-councillor seat counts and municipal audit opinions are available for individual municipalities.");
    return;
  }
  if (selected.level !== "ADM3") {
    addDetailMessage(detailBody, "Municipality required", "Select an ADM3 municipality to view its elected-councillor snapshot and audit opinion.");
    return;
  }

  const auditLabel = document.createElement("label");
  auditLabel.className = "finance-type-control";
  auditLabel.textContent = "AUDIT REPORTING YEAR";
  const auditYear = document.createElement("select");
  auditYear.setAttribute("aria-label", "Governance audit reporting year");
  for (let year = new Date().getUTCFullYear(); year >= 2011; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    option.selected = year === state.politicsAuditYear;
    auditYear.append(option);
  }
  auditYear.addEventListener("change", () => {
    state.politicsAuditYear = Number.parseInt(auditYear.value, 10);
    renderDetail();
  });
  auditLabel.append(auditYear);
  detailBody.append(auditLabel);
  addDetailMessage(
    detailBody,
    "Loading election and governance records",
    `Requesting the dated IEC seat snapshot and FY ${state.politicsAuditYear} audit opinion for ${selected.name}…`,
    "finance-loading"
  );

  const politicsUrl = `/api/municipalities/${encodeURIComponent(selected.id)}/politics`;
  const auditUrl = `/api/municipalities/${encodeURIComponent(selected.id)}/audit?year=${state.politicsAuditYear}`;
  void Promise.allSettled([getJson(politicsUrl), getJson(auditUrl)]).then(([politicsResult, auditResult]) => {
    if (requestId !== state.politicsRequestId || state.tab !== "politics" || state.selected?.id !== selected.id) return;
    detailBody.replaceChildren();
    appendLatestElection();
    detailBody.append(auditLabel);

    if (politicsResult.status === "rejected") {
      addDetailError(
        detailBody,
        "IEC councillor data unavailable",
        `${politicsResult.reason.message} No political representation values were substituted. Try again when the source is available.`
      );
    } else {
      renderMunicipalCouncilSeats(detailBody, politicsResult.value);
    }

    if (auditResult.status === "rejected") {
      addDetailError(detailBody, `Audit opinion unavailable · FY ${state.politicsAuditYear}`, auditResult.reason.message);
    } else {
      renderAuditOpinion(detailBody, auditResult.value);
    }
  });
}

function renderMunicipalCouncilSeats(parent, result) {
  const election = result.election;
  const section = appendCensusSection(
    parent,
    `${result.municipality.name} · elected council seats · ${election.year}`,
    "Seat counts are aggregated from the IEC elected-councillor list. This is a historical election snapshot, not a current officeholder, mayor, coalition or ruling-party indicator."
  );
  const metrics = document.createElement("div");
  metrics.className = "census-metric-grid";
  appendCensusMetric(metrics, "Elected seats", formatCensusNumber(election.totalSeats));
  appendCensusMetric(metrics, "Parties represented", formatCensusNumber(election.parties.length));
  section.append(metrics);

  const tableWrap = document.createElement("div");
  tableWrap.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table politics-table";
  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Party", "Total seats", "Ward", "PR"].forEach((label) => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.append(cell);
  });
  header.append(headerRow);
  const body = document.createElement("tbody");
  election.parties.forEach((party) => {
    const row = document.createElement("tr");
    [party.name, formatCensusNumber(party.totalSeats), formatCensusNumber(party.wardSeats),
      formatCensusNumber(party.proportionalRepresentationSeats)].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index > 0) cell.className = "mono";
      row.append(cell);
    });
    body.append(row);
  });
  table.append(header, body);
  tableWrap.append(table);
  section.append(tableWrap);

  const metadata = document.createElement("p");
  metadata.className = "finance-source-note";
  metadata.textContent = `${election.source.title} · published ${election.publishedDate}. ${election.source.methodology} ${election.source.limitations}`;
  section.append(metadata);
  addSourceLink(section, election.source.url, "Open original IEC councillor list ↗");

  const exportButton = document.createElement("button");
  exportButton.className = "action-button finance-export";
  exportButton.type = "button";
  exportButton.textContent = "Download party seat counts";
  exportButton.addEventListener("click", () => {
    downloadCsv(`civicstats-${election.municipalityCode.toLowerCase()}-council-seats-${election.year}.csv`, [
      ["municipality", "municipality_code", "province", "election_year", "party", "total_seats", "ward_seats", "pr_seats", "source"],
      ...election.parties.map((party) => [
        result.municipality.name,
        election.municipalityCode,
        result.municipality.province,
        election.year,
        party.name,
        party.totalSeats,
        party.wardSeats,
        party.proportionalRepresentationSeats,
        election.source.url
      ])
    ]);
  });
  section.append(exportButton);
}

function createDocumentsProjectsNavigation() {
  const navigation = document.createElement("div");
  navigation.className = "documents-project-tabs";
  navigation.setAttribute("aria-label", "Documents and projects data");
  [
    ["documents", "Documents"],
    ["projects", "Capital spending categories"],
    ["named-projects", "Named infrastructure projects"]
  ].forEach(([pane, label]) => {
    const button = document.createElement("button");
    button.className = `section-tab${state.documentsProjectsPane === pane ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.documentsProjectsPane === pane));
    button.textContent = label;
    button.addEventListener("click", () => {
      state.documentsProjectsPane = pane;
      renderDetail();
    });
    navigation.append(button);
  });
  return navigation;
}

function renderDocumentsProjects() {
  const requestId = ++state.documentsProjectsRequestId;
  const selected = state.selected;
  const navigation = createDocumentsProjectsNavigation();
  detailBody.replaceChildren(navigation);

  if (!selected) {
    addDetailMessage(detailBody, "Select a municipality", "Official audit-report links and Treasury capital-acquisition records are available at municipality level.");
    return;
  }
  if (selected.level !== "ADM3") {
    addDetailMessage(detailBody, "Municipality required", "Select an ADM3 municipality to view its official document links and reported capital acquisitions.");
    return;
  }

  if (state.documentsProjectsPane === "documents") {
    addDetailMessage(detailBody, "Loading municipal documents", `Checking National Treasury's municipality directory and audit-report catalogue for ${selected.name}…`, "finance-loading");
    void getJson(`/api/municipalities/${encodeURIComponent(selected.id)}/documents`).then((result) => {
      if (requestId !== state.documentsProjectsRequestId ||
        state.tab !== "documents" || state.selected?.id !== selected.id ||
        state.documentsProjectsPane !== "documents") return;
      detailBody.replaceChildren(createDocumentsProjectsNavigation());
      renderMunicipalDocuments(detailBody, result);
    }).catch((error) => {
      if (requestId !== state.documentsProjectsRequestId ||
        state.tab !== "documents" || state.selected?.id !== selected.id ||
        state.documentsProjectsPane !== "documents") return;
      detailBody.replaceChildren(createDocumentsProjectsNavigation());
      addDetailError(detailBody, "Municipal documents unavailable", `${error.message} No documents were substituted. Try again when the source is available.`);
      addSourceLink(detailBody, "https://municipaldata.treasury.gov.za/", "Open National Treasury Municipal Money ↗");
    });
    return;
  }

  if (state.documentsProjectsPane === "named-projects") {
    renderNamedMunicipalProjects(selected, requestId, navigation);
    return;
  }
  renderMunicipalProjects(selected, requestId, navigation);
}

function renderNamedMunicipalProjects(selected, requestId, navigation) {
  const parent = detailBody;
  const controls = document.createElement("div");
  controls.className = "finance-controls";
  const label = document.createElement("label");
  label.textContent = "SOURCE REPORTING YEAR";
  const yearSelect = document.createElement("select");
  yearSelect.setAttribute("aria-label", "Named infrastructure project reporting year");
  const years = ["2023/2024", "2022/2023", "2021/2022", "2020/2021", "2019/2020", "2017/2018"];
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    option.selected = year === (state.namedProjectsYear ?? years[0]);
    yearSelect.append(option);
  });
  yearSelect.addEventListener("change", () => {
    state.namedProjectsYear = yearSelect.value;
    renderDetail();
  });
  label.append(yearSelect);
  controls.append(label);
  parent.replaceChildren(navigation, controls);
  const year = state.namedProjectsYear ?? years[0];
  addDetailMessage(parent, "Loading named infrastructure projects", `Requesting ${year} records for ${selected.name}…`, "finance-loading");
  void getJson(`/api/municipalities/${encodeURIComponent(selected.id)}/named-projects?year=${encodeURIComponent(year)}`).then((result) => {
    if (requestId !== state.documentsProjectsRequestId || state.tab !== "documents" ||
      state.selected?.id !== selected.id || state.documentsProjectsPane !== "named-projects") return;
    parent.replaceChildren(navigation, controls);
    renderNamedProjectRecords(parent, result);
  }).catch((error) => {
    if (requestId !== state.documentsProjectsRequestId || state.tab !== "documents" ||
      state.selected?.id !== selected.id || state.documentsProjectsPane !== "named-projects") return;
    parent.replaceChildren(navigation, controls);
    addDetailError(parent, "Named project data unavailable", `${error.message} No project records were substituted. Try again when the source is available.`);
    addSourceLink(parent, "https://municipalmoney.gov.za/infrastructure/projects/", "Open Municipal Money project register ↗");
  });
}

function renderNamedProjectRecords(parent, result) {
  const section = appendCensusSection(parent,
    `${result.municipality.name} · named infrastructure projects`,
    `Municipal Money source records for FY ${result.financialYear}. The source provides selected years from FY 2017/2018 through FY 2023/2024; FY 2018/2019 is absent from its published catalogue. Project type is not a completion status.`);
  const searchLabel = document.createElement("label");
  searchLabel.className = "project-search-label";
  searchLabel.textContent = "SEARCH PROJECTS";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "project-search-input";
  search.placeholder = "Name, project number, ward, type or budget phase";
  search.setAttribute("aria-label", "Search named projects by name, project number, ward, type or budget phase");
  searchLabel.append(search);
  section.append(searchLabel);
  const note = document.createElement("p");
  note.className = "finance-source-note";
  let displayed = 0;
  const list = document.createElement("div");
  const more = document.createElement("button");
  more.type = "button";
  more.className = "section-tab";
  more.textContent = "Load next 50 projects";
  let filteredProjects = result.projects;
  const updateNote = () => {
    const allCount = Number(result.totalRecords).toLocaleString("en-ZA");
    note.textContent = `Showing ${displayed.toLocaleString("en-ZA")} of ${filteredProjects.length.toLocaleString("en-ZA")} matching projects (${allCount} source records)${result.truncated ? `; source retrieval capped at ${result.projects.length.toLocaleString("en-ZA")}` : ""}. Source checked ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
  };
  section.append(note);
  if (!result.projects.length) {
    addDetailMessage(section, "No records returned", "The source returned no named-project records for this municipality and reporting year. This is not evidence that the municipality had no projects.");
  } else {
    const appendProjects = (to) => {
      filteredProjects.slice(displayed, to).forEach((project) => {
        const article = document.createElement("article");
        article.className = "audit-opinion document-record";
        const title = document.createElement("strong");
        title.textContent = project.name;
        article.append(title);
        const details = document.createElement("p");
        details.className = "finance-source-note";
        details.textContent = [project.projectNumber && `Project ${project.projectNumber}`, project.type && `Type: ${project.type}`, project.function && `Function: ${project.function}`, project.ward && `Ward: ${project.ward}`].filter(Boolean).join(" · ") || "No additional project details supplied.";
        article.append(details);
        project.expenditure.forEach((item) => {
          const amount = document.createElement("p");
          amount.className = "finance-source-note";
          amount.textContent = `${item.financialYear || result.financialYear} · ${item.budgetPhase}: R ${item.amount.toLocaleString("en-ZA", { maximumFractionDigits: 2 })}`;
          article.append(amount);
        });
        list.append(article);
      });
      displayed = to;
      updateNote();
      more.hidden = displayed >= filteredProjects.length;
    };
    more.addEventListener("click", () => appendProjects(Math.min(displayed + 50, filteredProjects.length)));
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      filteredProjects = result.projects.filter((project) => {
        const fields = [project.name, project.projectNumber, project.type, project.function, project.ward,
          ...project.expenditure.flatMap((entry) => [entry.financialYear, entry.budgetPhase])];
        return fields.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
      });
      displayed = 0;
      list.replaceChildren();
      appendProjects(Math.min(50, filteredProjects.length));
      if (!filteredProjects.length) addDetailMessage(list, "No matching projects", "Try a different project name, number, ward, type or budget phase.");
    });
    section.append(list, more);
    appendProjects(Math.min(50, filteredProjects.length));
  }
  addSourceLink(section, result.source.url, "Open source municipal project register ↗");
}

function renderMunicipalDocuments(parent, result) {
  const portalSection = appendCensusSection(
    parent,
    `${result.municipality.name} · official document sources`,
    "Use the municipality's own site for its IDP, budget, annual report and council documents. Direct publication URLs are listed below only when returned by the official source."
  );
  if (result.officialMunicipalWebsite) {
    addSourceLink(portalSection, result.officialMunicipalWebsite, "Open official municipal website ↗");
  } else {
    addDetailMessage(portalSection, "Municipal website not listed", "National Treasury did not provide an official website URL for this municipality.");
  }

  const reports = result.auditRecords.filter((record) => record.reportUrl);
  const reportSection = appendCensusSection(
    parent,
    "Auditor-General municipal audit reports",
    "National Treasury's Audit Opinions dataset links available reports and states the opinion for each reporting year. A missing report link is not evidence that no audit took place."
  );
  if (!result.treasuryMunicipality) {
    addDetailMessage(reportSection, "No exact Treasury municipality match", "The source directory did not return a matching municipality, so no municipal report records are shown.");
  } else if (!result.auditRecords.length) {
    addDetailMessage(reportSection, "No audit records returned", "National Treasury returned no audit-opinion records for this municipality. This is not a clean-audit or no-audit conclusion.");
  } else {
    result.auditRecords.forEach((record) => {
      const entry = document.createElement("article");
      entry.className = "audit-opinion document-record";
      const title = document.createElement("strong");
      title.textContent = `Financial year ending ${record.year}`;
      const opinion = document.createElement("p");
      opinion.className = "finance-source-note";
      opinion.textContent = `Audit opinion: ${record.opinion ?? "Not specified by source"}.`;
      entry.append(title, opinion);
      if (record.reportUrl) {
        addSourceLink(entry, record.reportUrl, "Open Auditor-General audit report ↗");
      } else {
        const missing = document.createElement("small");
        missing.textContent = "The source record does not include a report URL.";
        entry.append(missing);
      }
      reportSection.append(entry);
    });
    const sourceNote = document.createElement("p");
    sourceNote.className = "finance-source-note";
    sourceNote.textContent = `${result.auditRecords.length} audit-opinion records returned; ${reports.length} include a report link. Checked ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
    reportSection.append(sourceNote);
  }
  addSourceLink(reportSection, result.sourceUrl, "Open source audit-opinion records ↗");

  const nationalPortals = appendCensusSection(
    parent,
    "Additional public document libraries",
    "These are official document portals, not a claim that a specific municipality's IDP, budget or project file has been indexed."
  );
  addSourceLink(nationalPortals, "http://mfma.treasury.gov.za/Media_Releases/s71/Pages/default.aspx", "National Treasury · municipal Section 71 reports ↗");
  addSourceLink(nationalPortals, "https://www.salga.org.za/knowledge-hub/documentations-publications", "SALGA · publications library ↗");
}

function renderMunicipalProjects(selected, requestId, navigation) {
  const parent = detailBody;
  const controls = document.createElement("div");
  controls.className = "finance-controls";

  const yearLabel = document.createElement("label");
  yearLabel.textContent = "FINANCIAL YEAR ENDING";
  const yearSelect = document.createElement("select");
  yearSelect.setAttribute("aria-label", "Capital acquisition reporting year");
  for (let year = new Date().getUTCFullYear(); year >= 2019; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    option.selected = year === state.projectsYear;
    yearSelect.append(option);
  }
  yearSelect.addEventListener("change", () => {
    state.projectsYear = Number.parseInt(yearSelect.value, 10);
    state.projectsAmountType = "AUDA";
    renderDetail();
  });
  yearLabel.append(yearSelect);

  const typeLabel = document.createElement("label");
  typeLabel.textContent = "BUDGET / ACTUAL TYPE";
  const typeSelect = document.createElement("select");
  typeSelect.setAttribute("aria-label", "Capital acquisition amount type");
  typeSelect.disabled = true;
  typeSelect.addEventListener("change", () => {
    state.projectsAmountType = typeSelect.value;
    renderProjectRecords(detailBody, state.projectDataset, typeSelect);
  });
  typeLabel.append(typeSelect);
  controls.append(yearLabel, typeLabel);
  parent.replaceChildren(navigation, controls);
  addDetailMessage(parent, "Loading capital acquisition data", `Requesting National Treasury's ${state.projectsYear} capital-acquisition records for ${selected.name}…`, "finance-loading");

  void getJson(`/api/municipalities/${encodeURIComponent(selected.id)}/projects?year=${state.projectsYear}`).then((result) => {
    if (requestId !== state.documentsProjectsRequestId ||
      state.tab !== "documents" || state.selected?.id !== selected.id ||
      state.documentsProjectsPane !== "projects") return;
    state.projectDataset = result;
    const amountTypes = [...new Map(result.rows.map((row) => {
      const code = String(row["amount_type.code"] ?? "");
      return code ? [code, { code, label: String(row["amount_type.label"] ?? code) }] : null;
    }).filter(Boolean))].map(([, item]) => item);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All reported types";
    typeSelect.append(allOption);
    amountTypes.forEach(({ code, label }) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${label} (${code})`;
      typeSelect.append(option);
    });
    const selectedType = amountTypes.some(({ code }) => code === state.projectsAmountType)
      ? state.projectsAmountType
      : amountTypes.some(({ code }) => code === "AUDA")
        ? "AUDA"
        : amountTypes.some(({ code }) => code === "ADJB")
          ? "ADJB"
          : "all";
    state.projectsAmountType = selectedType;
    typeSelect.value = selectedType;
    typeSelect.disabled = amountTypes.length === 0;
    parent.replaceChildren(navigation, controls);
    renderProjectRecords(parent, result, typeSelect);
  }).catch((error) => {
    if (requestId !== state.documentsProjectsRequestId ||
      state.tab !== "documents" || state.selected?.id !== selected.id ||
      state.documentsProjectsPane !== "projects") return;
    parent.replaceChildren(navigation, controls);
    addDetailError(parent, "Capital acquisition data unavailable", `${error.message} No project or expenditure values were substituted. Try again when the source is available.`);
    addSourceLink(parent, "https://municipaldata.treasury.gov.za/docs#cube-capital_v2", "Open National Treasury Capital Acquisition documentation ↗");
  });
}

function renderProjectRecords(parent, result, typeSelect) {
  parent.querySelectorAll(".projects-results").forEach((section) => section.remove());
  const output = document.createElement("section");
  output.className = "projects-results";
  const projectNote = document.createElement("p");
  projectNote.className = "finance-source-note project-scope-note";
  projectNote.textContent = "The table below is reported municipal capital-acquisition expenditure by accounting category; it is not a list of named projects. National Treasury and OpenUp publish a separate municipality-filtered register with named infrastructure projects, budget, type and project status. The register notes that 2026 Q2 data is still being checked for completeness and integrity.";
  output.append(projectNote);
  const projectRegister = new URL("https://municipalmoney.gov.za/infrastructure/projects/");
  projectRegister.searchParams.set("municipality", result.municipality.name);
  projectRegister.searchParams.set("province", result.municipality.province);
  addSourceLink(output, projectRegister.toString(), `Open ${result.municipality.name} named infrastructure project register ↗`);

  if (!result.treasuryMunicipality) {
    addDetailMessage(output, "No exact Treasury municipality match", `National Treasury did not return a matching municipality for ${result.municipality.name}.`);
    parent.append(output);
    return;
  }

  const filtered = result.rows
    .filter((row) => state.projectsAmountType === "all" ||
      row["amount_type.code"] === state.projectsAmountType)
    .filter((row) => typeof row["amount.sum"] === "number" && Number.isFinite(row["amount.sum"]))
    .sort((left, right) => right["amount.sum"] - left["amount.sum"]);
  const summary = document.createElement("p");
  summary.className = "finance-source-note";
  const amountLabel = typeSelect.selectedOptions[0]?.textContent ?? state.projectsAmountType;
  summary.textContent = `${result.treasuryMunicipality.name} · FY ending ${result.year} · ${filtered.length.toLocaleString("en-ZA")} numeric source rows · ${amountLabel}. Amounts are reported in South African rand (ZAR).`;
  output.append(summary);

  if (!filtered.length) {
    addDetailMessage(output, "No matching capital records", "The source returned no numeric records for this reporting year and amount type. This is not a zero expenditure result.");
  } else {
    const wrap = document.createElement("div");
    wrap.className = "finance-table-wrap";
    const table = document.createElement("table");
    table.className = "data-table finance-table project-table";
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    ["Capital acquisition category", "Record type", "Amount (ZAR)"].forEach((label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      header.append(cell);
    });
    thead.append(header);
    const tbody = document.createElement("tbody");
    filtered.slice(0, 40).forEach((record) => {
      const row = document.createElement("tr");
      const category = [
        record["function.label"],
        record["item.label"],
        record["capital_type.label"]
      ].filter(Boolean).join(" · ") || "Source category not named";
      [
        category,
        record["amount_type.label"] ?? record["amount_type.code"] ?? "Source type not named",
        formatRand(record["amount.sum"])
      ].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        if (index === 2) cell.className = "mono";
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    wrap.append(table);
    output.append(wrap);
    if (filtered.length > 40) {
      const cap = document.createElement("p");
      cap.className = "finance-source-note";
      cap.textContent = `Showing 40 of ${filtered.length.toLocaleString("en-ZA")} numeric source rows. The CSV export includes all filtered rows.`;
      output.append(cap);
    }

    const exportButton = document.createElement("button");
    exportButton.className = "action-button finance-export";
    exportButton.type = "button";
    exportButton.textContent = "Download capital acquisition records";
    exportButton.addEventListener("click", () => {
      downloadCsv(`civicstats-${result.treasuryMunicipality.code.toLowerCase()}-capital-acquisitions-${result.year}.csv`, [
        ["municipality", "municipality_code", "province", "financial_year_end", "function_code", "function", "item_code", "item", "capital_type_code", "capital_type", "amount_type_code", "amount_type", "amount_ZAR", "source"],
        ...filtered.map((record) => [
          result.treasuryMunicipality.name,
          result.treasuryMunicipality.code,
          result.municipality.province,
          result.year,
          record["function.code"],
          record["function.label"],
          record["item.code"],
          record["item.label"],
          record["capital_type.code"],
          record["capital_type.label"],
          record["amount_type.code"],
          record["amount_type.label"],
          record["amount.sum"],
          result.source.apiUrl
        ])
      ]);
    });
    output.append(exportButton);
  }

  const provenance = document.createElement("p");
  provenance.className = "finance-source-note";
  provenance.textContent = `${result.source.publisher} · ${result.source.dataset} · ${result.source.note} Checked ${new Date(result.checkedAt).toLocaleString("en-ZA")}.`;
  output.append(provenance);
  addSourceLink(output, result.source.url, "Open National Treasury dataset documentation ↗");
  if (result.source.apiUrl) addSourceLink(output, result.source.apiUrl, "Open source records ↗");
  parent.append(output);
}

function updateProfile(selected) {
  state.selected = selected;
  state.overviewLevel = selected.level;
  syncOverviewLevelSwitcher();
  document.querySelector("#profile-panel").classList.remove("scope-awaiting-selection");
  document.querySelector("#overview-scope-prompt").hidden = true;
  if (!selected) return;
  document.querySelector("#fit-map").hidden = false;
  profileName.textContent = selected.name;
  const location = [selected.province, selected.district]
    .filter((name, index, list) => name && name !== selected.name && list.indexOf(name) === index)
    .join(" · ");
  profileLocation.textContent = location || formatBoundaryLevel(selected.level);
  document.querySelector("#profile-code-label").textContent = selected.level === "ADM3"
    ? "OFFICIAL MUNICIPAL CODE"
    : "OFFICIAL GEOGRAPHIC CODE";
  document.querySelector("#profile-boundary-label").textContent = "UNIQUE BOUNDARY ID · GEOBOUNDARIES";
  document.querySelector("#profile-area-label").textContent = "AREA · BOUNDARY-DERIVED";
  document.querySelector("#profile-code").textContent = selected.officialCode ??
    state.censusMapRecords.get(selected.id)?.censusCode ?? "Data unavailable";
  document.querySelector("#profile-boundary-id").textContent = selected.id || "—";
  const levelLabels = { ADM1: "PROVINCE", ADM2: "DISTRICT / METRO", ADM3: "MUNICIPALITY" };
  const levelLabel = levelLabels[selected.level] ?? formatBoundaryLevel(selected.level).toUpperCase();
  document.querySelector("#profile-scope-label").textContent = `SELECTED ${levelLabel}`;
  document.querySelector("#profile-type").textContent =
    (selected.category ?? levelLabel).toUpperCase();
  document.querySelector("#profile-population-label").textContent =
    `POPULATION · ${levelLabel} · CENSUS 2022`;
  const populationQuality = document.querySelector("#profile-population-quality");
  populationQuality.textContent = selected.level === "ADM2" ? "DERIVED" : "OFFICIAL";
  populationQuality.classList.toggle("derived", selected.level === "ADM2");
  populationQuality.classList.toggle("official", selected.level !== "ADM2");
  document.querySelector("#profile-area-quality").textContent = "APPROX.";
  document.querySelector("#profile-area").textContent = formatArea(selected.areaKm2);
  document.querySelector("#profile-area-note").textContent = selected.areaKm2 == null
    ? "Not calculated for this boundary"
    : "Spherical GeoJSON calculation · approximate";
  updateBreadcrumb();
  document.querySelector("#open-municipality-profile").disabled = selected.level !== "ADM3";
  document.querySelector("#compare-profile-place").disabled = selected.level !== "ADM3";
  updateMapZoomPath();
  void renderGeographyChildren(selected);
  renderDetail();
  updatePageHeading();
  void updateProfileSummary(selected);

  if (state.boundaryLayer) {
    state.boundaryLayer.eachLayer((layer) => {
      const isSelected = layer.feature.properties.shapeID === selected.id;
      layer.setStyle(isSelected ? selectedStyle(layer.feature) : mapStyle(layer.feature));
      if (isSelected && state.boundaryLevel !== "ADM1") layer.bringToFront();
    });
    refreshSelectionLayer();
    updateMapRegionAccessibility();
  }
}

function renderGeographyChildren(selected) {
  const container = document.querySelector("#geography-children");
  if (!container) return;
  const childLevel = selected.level === "ADM1" ? "ADM2" : selected.level === "ADM2" ? "ADM3" : null;
  if (!childLevel) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  const children = state.geographies.filter((item) =>
    item.level === childLevel &&
    (childLevel === "ADM2" ? item.provinceId === selected.id : item.districtId === selected.id)
  );
  const heading = document.createElement("span");
  heading.className = "panel-kicker";
  heading.textContent = childLevel === "ADM2"
    ? "DISTRICTS & METROS IN THIS PROVINCE"
    : "LOCAL & METRO MUNICIPALITIES IN THIS DISTRICT";
  const list = document.createElement("div");
  list.className = "geography-child-list";
  children.forEach((child) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "geography-child";
    button.dataset.geographyId = child.id;
    const name = document.createElement("strong");
    name.textContent = child.name;
    const category = document.createElement("small");
    category.textContent = child.category;
    button.append(name, category);
    list.append(button);
  });
  container.replaceChildren(heading, list);
  container.hidden = false;
}

function updateNationalProfileSummary() {
  if (state.selected) return;
  syncOverviewLevelSwitcher();
  const profilePanel = document.querySelector("#profile-panel");
  const prompt = document.querySelector("#overview-scope-prompt");
  if (state.overviewLevel !== "national") {
    const levelName = ({ ADM1: "province", ADM2: "district or metro", ADM3: "municipality" })[state.overviewLevel];
    profilePanel.classList.add("scope-awaiting-selection");
    document.querySelector("#profile-scope-label").textContent = `${levelName.toUpperCase()} OVERVIEW`;
    document.querySelector("#profile-type").textContent = "CHOOSE AN AREA";
    document.querySelector("#profile-name").textContent = `Select a ${levelName}`;
    document.querySelector("#profile-location").textContent = "Choose an area on the map to view its verified statistics.";
    prompt.hidden = false;
    prompt.textContent = `The map is showing ${levelName} boundaries. Select one to load its overview.`;
    syncOverviewLevelSwitcher();
    return;
  }
  profilePanel.classList.remove("scope-awaiting-selection");
  prompt.hidden = true;
  const provinces = state.geographies.filter((item) => item.level === "ADM1");
  const provinceCount = provinces.length;
  const municipalityCount = state.municipalities.length;
  profileName.textContent = "South Africa";
  profileLocation.textContent = provinceCount && municipalityCount
    ? `${provinceCount} provinces · ${municipalityCount} municipalities`
    : "National geographic coverage";
  document.querySelector("#profile-scope-label").textContent = "NATIONAL OVERVIEW";
  document.querySelector("#profile-type").textContent = "COUNTRYWIDE";
  document.querySelector("#profile-code-label").textContent = "ADMINISTRATIVE COVERAGE";
  document.querySelector("#profile-code").textContent = provinceCount && municipalityCount
    ? `${provinceCount} provinces · ${municipalityCount} municipalities`
    : "Loading coverage…";
  document.querySelector("#profile-boundary-label").textContent = "GEOGRAPHY SCOPE";
  document.querySelector("#profile-boundary-id").textContent = "South Africa · national";
  document.querySelector("#profile-population-label").textContent = "POPULATION · CENSUS 2022";
  const populationQuality = document.querySelector("#profile-population-quality");
  populationQuality.textContent = "OFFICIAL";
  populationQuality.classList.remove("derived");
  populationQuality.classList.add("official");
  document.querySelector("#profile-area-quality").textContent = "APPROX.";
  document.querySelector("#profile-population-note").textContent = state.nationalCensusPopulation2022
    ? `${state.nationalCensusPopulation2022.source.publisher} · Census 2022 · official national total`
    : state.nationalCensusPopulationError
      ? "Stats SA Census 2022 national total unavailable"
      : "Loading official Stats SA national total…";
  document.querySelector("#profile-population").textContent = state.nationalCensusPopulation2022
    ? formatCensusNumber(state.nationalCensusPopulation2022.population)
    : state.nationalCensusPopulationError ? "Unavailable" : "Loading…";

  document.querySelector("#profile-area-label").textContent = "AREA · BOUNDARY-DERIVED";
  const provinceAreas = provinces.map((item) => item.areaKm2);
  const nationalArea = provinceCount > 0 && provinceAreas.every((area) => Number.isFinite(area) && area > 0)
    ? provinceAreas.reduce((sum, area) => sum + area, 0)
    : null;
  document.querySelector("#profile-area").textContent = nationalArea == null
    ? provinceCount ? "Unavailable" : "Loading…"
    : formatArea(nationalArea);
  document.querySelector("#profile-area-note").textContent = nationalArea == null
    ? "Provincial boundaries are not yet available"
    : `Approximate sum of ${provinceCount} geoBoundaries province areas`;

  const labourValues = [...state.labourMapRecords.values()]
    .map((record) => record.officialRate)
    .filter(Number.isFinite);
  const unemployment = document.querySelector("#profile-unemployment");
  const unemploymentNote = document.querySelector("#profile-unemployment-note");
  if (labourValues.length === 9 && state.labourData) {
    const period = state.labourData.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter;
    unemployment.textContent = `${formatCensusNumber(Math.min(...labourValues), 1)}–${formatCensusNumber(Math.max(...labourValues), 1)}%`;
    unemploymentNote.textContent = `Stats SA QLFS ${period} · range across nine provincial estimates; not a national rate`;
  } else {
    unemployment.textContent = state.labourMapError ? "Unavailable" : "Loading…";
    unemploymentNote.textContent = state.labourMapError
      ? "Stats SA provincial estimates are unavailable"
      : "Loading Stats SA province-level estimates…";
  }

  const civicScore = document.querySelector("#profile-civicscore");
  civicScore.textContent = "NO NATIONAL SCORE";
  civicScore.classList.add("unscored");
  civicScore.classList.remove("civic-score-value");
  document.querySelector("#profile-civicscore-note").textContent = "The basic-services pilot is municipality-only; no countrywide score is calculated.";
  document.querySelector("#profile-indicator-status").textContent = "NATIONAL DATA PROFILE";
  document.querySelector("#profile-indicator-period").textContent = state.nationalCensusPopulation2022 ? "CENSUS 2022" : "LOADING CENSUS";
  const hasData = Boolean(state.nationalCensusPopulation2022 || labourValues.length === 9 || nationalArea != null);
  document.querySelector("#profile-status-dot").classList.toggle("muted", !hasData);
  document.querySelector("#source-indicator-dot").classList.toggle("loaded", hasData);
  document.querySelector("#source-indicator-label").textContent = hasData ? "NATIONAL SOURCES" : "LOADING SOURCES";
  document.querySelector("#source-summary-note").textContent = "National Census population, provincial QLFS range and mapped administrative coverage.";
  document.querySelector("#open-municipality-profile").disabled = true;
  document.querySelector("#compare-profile-place").disabled = true;
  updateBreadcrumb();
  updateMapZoomPath();

  if (!state.nationalCensusPopulation2022 && !state.nationalCensusPopulationLoading && !state.nationalCensusPopulationError) {
    state.nationalCensusPopulationLoading = true;
    void getNationalCensusPopulation2022().then((result) => {
      state.nationalCensusPopulation2022 = result;
      state.nationalCensusPopulationError = null;
    }).catch((error) => {
      state.nationalCensusPopulationError = error.message;
    }).finally(() => {
      state.nationalCensusPopulationLoading = false;
      updateNationalProfileSummary();
    });
  }
}

async function districtCensusPopulation(selected) {
  const members = state.municipalities.filter((item) => item.districtId === selected.id);
  if (!members.length) return null;
  const results = await Promise.allSettled(members.map((item) => getMunicipalityCensus(item.id)));
  const matched = results.flatMap((result, index) => {
    const census = result.status === "fulfilled" ? result.value : null;
    const population = census?.census?.indicators?.total_pop_2022;
    return Number.isFinite(population) && population >= 0 && hasVerifiedCensusSource(census)
      ? [{ name: members[index].name, population }]
      : [];
  });
  const matchedNames = new Set(matched.map((item) => item.name));
  return {
    population: matched.reduce((total, item) => total + item.population, 0),
    matchedCount: matched.length,
    totalCount: members.length,
    missingNames: members.filter((item) => !matchedNames.has(item.name)).map((item) => item.name)
  };
}

function syncOverviewLevelSwitcher() {
  const levelName = ({ national: "National", ADM1: "Province", ADM2: "District / metro", ADM3: "Municipality" })[state.overviewLevel] ?? "National";
  const currentPlace = state.selected?.name ?? (state.overviewLevel === "national" ? "South Africa" : "Select an area");
  const placeLabel = document.querySelector("#overview-current-place");
  if (placeLabel) placeLabel.textContent = `${levelName} · ${currentPlace}`;
  document.querySelectorAll("[data-overview-level]").forEach((button) => {
    const active = button.dataset.overviewLevel === state.overviewLevel;
    button.setAttribute("aria-pressed", String(active));
  });
}

function clearGeographySelection() {
  state.selected = null;
  document.querySelector("#fit-map").hidden = true;
  setMobileProfileOpen(false);
  state.profileSummaryRequestId += 1;
  updateNationalProfileSummary();
  document.querySelector("#geography-children").hidden = true;
  document.querySelector("#geography-children").replaceChildren();
  document.querySelector("#map-location").textContent = "SOUTH AFRICA · 9 PROVINCES";
  updateMapZoomPath();
  renderDetail();
  updatePageHeading();
  refreshMapStyles();
}

async function updateProfileSummary(selected) {
  const requestId = ++state.profileSummaryRequestId;
  const population = document.querySelector("#profile-population");
  const populationNote = document.querySelector("#profile-population-note");
  const unemployment = document.querySelector("#profile-unemployment");
  const unemploymentNote = document.querySelector("#profile-unemployment-note");
  const status = document.querySelector("#profile-indicator-status");
  const periodLabel = document.querySelector("#profile-indicator-period");
  const statusDot = document.querySelector("#profile-status-dot");
  const sourceDot = document.querySelector("#source-indicator-dot");
  const sourceLabel = document.querySelector("#source-indicator-label");
  const sourceNote = document.querySelector("#source-summary-note");
  const civicScore = document.querySelector("#profile-civicscore");
  const civicScoreNote = document.querySelector("#profile-civicscore-note");
  civicScore.textContent = selected.level === "ADM3" ? "CALCULATING…" : "MUNICIPAL ONLY";
  civicScore.classList.add("unscored");
  civicScore.classList.remove("civic-score-value");
  civicScoreNote.textContent = selected.level === "ADM3"
    ? "Checking all three verified Census 2022 measures"
    : "The pilot uses municipal Census service indicators";
  population.textContent = "Loading…";
  populationNote.textContent = selected.level === "ADM1"
    ? "Stats SA provincial Census total"
    : selected.level === "ADM2"
      ? "Derived from matched municipal Census 2022 records"
      : "Stats SA municipal profile";
  unemployment.textContent = "Loading…";
  unemploymentNote.textContent = "Stats SA QLFS · provincial estimate only";
  status.textContent = "LOADING VERIFIED INDICATORS";
  periodLabel.textContent = "—";
  statusDot.classList.add("muted");

  const censusRequest = selected.level === "ADM3"
    ? getMunicipalityCensus(selected.id)
    : selected.level === "ADM1"
      ? getProvinceCensusPopulation(selected.name)
      : selected.level === "ADM2"
        ? districtCensusPopulation(selected)
      : Promise.resolve(null);
  const labourRequest = state.labourData
    ? Promise.resolve(state.labourData)
    : loadProvincialLabourData();
  const [censusResult, labourResult] = await Promise.allSettled([censusRequest, labourRequest]);
  if (requestId !== state.profileSummaryRequestId || state.selected?.id !== selected.id) return;

  let verifiedIndicators = 0;
  let censusLoaded = false;
  let censusPeriod = "";
  if (selected.level === "ADM1" && censusResult.status === "fulfilled" &&
    Number.isSafeInteger(censusResult.value?.population) && censusResult.value?.source?.publisher === "Statistics South Africa") {
    population.textContent = formatCensusNumber(censusResult.value.population);
    populationNote.textContent = `${censusResult.value.source.publisher} · Census 2022 · Table 2.2`;
    verifiedIndicators += 1;
    censusLoaded = true;
    censusPeriod = "Census 2022";
  } else if (selected.level === "ADM1") {
    population.textContent = "Unavailable";
    populationNote.textContent = censusResult.status === "rejected"
      ? `Provincial Census request failed: ${censusResult.reason.message}`
      : "No verified Census population record was returned for this province";
  } else if (selected.level === "ADM2" && censusResult.status === "fulfilled" && censusResult.value?.matchedCount > 0) {
    const coverage = censusResult.value;
    const complete = coverage.matchedCount === coverage.totalCount;
    population.textContent = complete ? formatCensusNumber(coverage.population) : "PARTIAL";
    populationNote.replaceChildren();
    const sourceAttribution = document.createElement("span");
    sourceAttribution.className = "profile-source-attribution";
    sourceAttribution.textContent = "Stats SA Census 2022";
    const methodNote = document.createElement("span");
    const missingPreview = coverage.missingNames.slice(0, 3).join(", ");
    const moreMissing = coverage.missingNames.length > 3 ? ` and ${coverage.missingNames.length - 3} more` : "";
    methodNote.textContent = complete
      ? ` · Derived sum · coverage ${coverage.matchedCount}/${coverage.totalCount} municipal records; not an official district tabulation`
      : ` · Subtotal ${formatCensusNumber(coverage.population)} · coverage ${coverage.matchedCount}/${coverage.totalCount}; missing: ${missingPreview}${moreMissing}`;
    populationNote.append(sourceAttribution, methodNote);
    verifiedIndicators += 1;
    censusLoaded = true;
    censusPeriod = "Census 2022";
  } else if (selected.level === "ADM2") {
    population.textContent = censusResult.status === "pending" ? "Loading…" : "Unavailable";
    populationNote.textContent = censusResult.status === "rejected"
      ? "Census population could not be retrieved for this district"
      : "No verified municipal Census 2022 population records were found for this district";
  } else if (censusResult.status === "fulfilled" && censusResult.value?.census) {
    const indicators = censusResult.value.census.indicators;
    const officialCode = censusResult.value.census.officialCode;
    selected.officialCode = officialCode;
    document.querySelector("#profile-code").textContent = officialCode || "Data unavailable";
    if (Number.isFinite(indicators.total_pop_2022) && hasVerifiedCensusSource(censusResult.value)) {
      population.textContent = formatCensusNumber(indicators.total_pop_2022);
      populationNote.textContent = `${censusResult.value.source.publisher} · Census 2022`;
      verifiedIndicators += 1;
      censusLoaded = true;
      censusPeriod = "Census 2022";
    } else {
      population.textContent = "Unavailable";
      populationNote.textContent = hasVerifiedCensusSource(censusResult.value)
        ? "The source record has no 2022 population value"
        : "A verified Stats SA source reference is missing";
    }
  } else if (selected.level !== "ADM3") {
    population.textContent = "Data unavailable";
    populationNote.textContent = "Census profile figures are available at municipality level";
  } else {
    population.textContent = "Unavailable";
    populationNote.textContent = censusResult.status === "rejected"
      ? `Census request failed: ${censusResult.reason.message}`
      : "No Census record was returned for this municipality";
  }

  const pilot = selected.level === "ADM3" && censusResult.status === "fulfilled"
    ? censusResult.value?.basicServicesPilot
    : null;
  if (pilot && Number.isFinite(pilot.score) && pilot.score >= 0 && pilot.score <= 100 &&
    pilot.scale === 100 && pilot.year === 2022 && Array.isArray(pilot.components) && pilot.components.length === 3) {
    civicScore.textContent = `${formatCensusNumber(pilot.score, 1)} / 100`;
    civicScore.classList.remove("unscored");
    civicScore.classList.add("civic-score-value");
    civicScoreNote.textContent = "Census 2022 · 3 household shares · pilot";
  } else {
    civicScore.textContent = selected.level === "ADM3" ? "UNAVAILABLE" : "MUNICIPAL ONLY";
    civicScore.classList.add("unscored");
    civicScore.classList.remove("civic-score-value");
    civicScoreNote.textContent = selected.level === "ADM3"
      ? "All three verified Census 2022 measures are required"
      : "The pilot is currently available for municipalities";
  }

  const labour = labourResult.status === "fulfilled" ? labourResult.value : null;
  const province = selected.level === "ADM1" ? selected.name : selected.province;
  const period = labour?.periods.find((item) => item.code === state.labourQuarter) ?? labour?.periods.at(-1);
  const labourRecord = labour?.records.find((record) =>
    record.province === province && record.quarter === period?.code
  );
  if (labourRecord && period) {
    unemployment.textContent = `${formatCensusNumber(labourRecord.officialRate, 1)}%`;
    const selectedLevelLabel = selected.level === "ADM1"
      ? "provincial rate"
      : selected.level === "ADM2"
        ? "province-level estimate · not a district rate"
        : "province-level estimate · not a municipal rate";
    unemploymentNote.textContent = `${province} · ${period.label} · ${selectedLevelLabel}`;
    verifiedIndicators += 1;
  } else {
    unemployment.textContent = province ? "Unavailable" : "Province required";
    unemploymentNote.textContent = labour
      ? `Stats SA QLFS reports ${province ? `a ${province} provincial estimate` : "unemployment"} only; no municipality or district rate is available`
      : `Provincial QLFS unavailable${state.labourMapError ? `: ${state.labourMapError}` : ""}`;
  }

  const hasVerifiedIndicators = verifiedIndicators > 0;
  status.textContent = hasVerifiedIndicators
    ? `${verifiedIndicators} VERIFIED INDICATOR${verifiedIndicators === 1 ? "" : "S"}`
    : "NO INDICATORS AVAILABLE";
  periodLabel.textContent = [
    censusPeriod,
    labourRecord && period ? `QLFS ${period.code}` : ""
  ].filter(Boolean).join(" · ") || "—";
  statusDot.classList.toggle("muted", !hasVerifiedIndicators);
  sourceDot.classList.toggle("loaded", hasVerifiedIndicators);
  sourceLabel.textContent = hasVerifiedIndicators ? "LOADED" : "UNAVAILABLE";
  sourceNote.textContent = [
    "Boundary vintage 2020 · geoBoundaries.",
    censusLoaded
      ? selected.level === "ADM1"
        ? "Stats SA Census 2022 provincial population total loaded."
        : "Stats SA Census 2022 municipal profile loaded."
      : "",
    labourRecord && period ? `Stats SA QLFS provincial estimate · ${period.label}.` : "",
    staticDeployment
      ? "Treasury finance, climate and live publication data require a separately hosted Node API."
      : "National Treasury finance data loads on demand."
  ].filter(Boolean).join(" ");
}

function baseStyle(feature) {
  const isProvince = feature.properties.shapeType === "ADM1";
  return {
    color: isProvince ? "#66756e" : "#596861",
    weight: isProvince ? 1.3 : state.boundaryLevel === "ADM3" ? 0.65 : 1,
    opacity: isProvince ? 0.85 : 0.68,
    fillColor: "#26322d",
    fillOpacity: isProvince ? 0.035 : 0.19
  };
}

function selectedStyle(feature) {
  const missingValue = feature && !["boundaries", "airQuality"].includes(state.mapLayer) && mapIndicatorValue(feature) === null;
  return {
    color: "#eafffb",
    weight: 3,
    opacity: 1,
    fillColor: missingValue ? "url(#civicstats-map-no-data-pattern)" : "#29b6ad",
    fillOpacity: missingValue ? 1 : 0.48
  };
}

function comparisonStyle() {
  return { color: "#c19a5a", weight: 2, opacity: 0.95, fillColor: "#8b7040", fillOpacity: 0.38 };
}

function isComparisonSelection(feature) {
  return state.comparisonSelections.includes(feature.properties.shapeID);
}

function styleForFeature(feature) {
  if (feature.properties.shapeID === state.selected?.id) return selectedStyle(feature);
  if (isComparisonSelection(feature)) return comparisonStyle();
  return mapStyle(feature);
}

function refreshSelectionLayer() {
  if (!state.map) return;
  if (state.selectionLayer) {
    state.map.removeLayer(state.selectionLayer);
    state.selectionLayer = null;
  }
  const selected = state.selected;
  if (selected && selected.level !== state.boundaryLevel) {
    const feature = state.collections.get(selected.level)?.features.find((item) =>
      item.properties.shapeID === selected.id
    );
    if (feature) {
      state.selectionLayer = L.geoJSON(feature, {
        style: selectedStyle,
        interactive: false
      }).addTo(state.map);
    }
  }
  refreshNationalOutlineLayer();
}

function refreshNationalOutlineLayer() {
  if (!state.map) return;
  if (state.nationalProvinceBordersLayer) {
    state.map.removeLayer(state.nationalProvinceBordersLayer);
    state.nationalProvinceBordersLayer = null;
  }
  if (state.nationalOutlineLayer) {
    state.map.removeLayer(state.nationalOutlineLayer);
    state.nationalOutlineLayer = null;
  }
  if (state.view !== "dashboard" || state.selected) return;
  const provinces = state.collections.get("ADM1");
  if (!provinces) return;
  const colors = ["#78a99a", "#b99568", "#7d9ab5", "#ae986d", "#93aa70", "#b07f98", "#68a0a8", "#c78462", "#8e9c83"];
  const provinceOrder = [
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape"
  ];
  const provinceColors = new Map(provinceOrder.map((name, index) => [name, colors[index]]));
  state.nationalProvinceBordersLayer = L.geoJSON(provinces, {
    style: (feature) => ({
      color: provinceColors.get(canonicalProvinceName(feature.properties.shapeName)) ?? "#8e9c83",
      weight: 1.15,
      opacity: 0.88,
      fill: false,
      fillOpacity: 0
    }),
    interactive: false
  }).addTo(state.map);
  state.nationalOutlineCollection ??= buildNationalOutlineCollection(provinces);
  state.nationalOutlineLayer = L.geoJSON(state.nationalOutlineCollection, {
    style: {
      color: "#57c7c1",
      weight: 3,
      opacity: 0.95,
      fill: false,
      fillOpacity: 0
    },
    interactive: false
  }).addTo(state.map);
}

function buildNationalOutlineCollection(provinces) {
  const coordinateKey = ([longitude, latitude]) => `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
  const segments = new Map();
  provinces.features.forEach((feature) => {
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : [];
    polygons.forEach((polygon) => {
      const exterior = polygon[0] ?? [];
      for (let index = 0; index < exterior.length - 1; index += 1) {
        const start = exterior[index];
        const end = exterior[index + 1];
        const startKey = coordinateKey(start);
        const endKey = coordinateKey(end);
        const segmentKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
        if (segments.has(segmentKey)) segments.delete(segmentKey);
        else segments.set(segmentKey, { start, end, startKey, endKey });
      }
    });
  });

  const adjacency = new Map();
  const addAdjacentSegment = (key, segment) => {
    const attached = adjacency.get(key) ?? [];
    attached.push(segment);
    adjacency.set(key, attached);
  };
  segments.forEach((segment) => {
    addAdjacentSegment(segment.startKey, segment);
    addAdjacentSegment(segment.endKey, segment);
  });
  const unused = new Set(segments.values());
  const lines = [];
  while (unused.size) {
    const seed = unused.values().next().value;
    const startKey = (adjacency.get(seed.startKey)?.length ?? 0) === 1
      ? seed.startKey
      : (adjacency.get(seed.endKey)?.length ?? 0) === 1
        ? seed.endKey
        : seed.startKey;
    let currentKey = startKey;
    const line = [startKey === seed.startKey ? seed.start : seed.end];
    let firstStep = true;
    while (true) {
      const candidates = (adjacency.get(currentKey) ?? []).filter((segment) => unused.has(segment));
      if (!candidates.length) break;
      const segment = firstStep ? seed : candidates[0];
      firstStep = false;
      unused.delete(segment);
      const nextKey = segment.startKey === currentKey ? segment.endKey : segment.startKey;
      line.push(segment.startKey === currentKey ? segment.end : segment.start);
      currentKey = nextKey;
      if (currentKey === startKey) break;
    }
    if (line.length > 1) lines.push(line);
  }
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { source: "geoBoundaries ADM1 · exterior boundary" },
      geometry: { type: "MultiLineString", coordinates: lines }
    }]
  };
}

function censusMapRecordForFeature(feature) {
  const properties = feature?.properties;
  if (!properties || !["ADM1", "ADM2", "ADM3"].includes(properties.shapeType)) return null;
  if (properties.shapeType === "ADM3") return state.censusMapRecords.get(properties.shapeID) ?? null;

  const cacheKey = `${state.censusMapYear}:${properties.shapeType}:${properties.shapeID}`;
  if (state.censusMapAggregates.has(cacheKey)) return state.censusMapAggregates.get(cacheKey);
  const parentKey = properties.shapeType === "ADM1" ? "provinceId" : "districtId";
  const members = state.municipalities.filter((municipality) => municipality[parentKey] === properties.shapeID);
  const records = members.map((municipality) => state.censusMapRecords.get(municipality.id));
  if (!members.length || records.some((record) => !record)) {
    state.censusMapAggregates.set(cacheKey, null);
    return null;
  }

  const sum = (key) => records.reduce((total, record) => total + record[key], 0);
  const population = sum("population");
  const population2011 = sum("population2011");
  const population2022 = sum("population2022");
  const households = sum("households");
  const waterSchemeHouseholds = sum("waterSchemeHouseholds");
  const sourceAreaKm2 = sum("sourceAreaKm2");
  const weightedElectricityHouseholds = records.reduce((total, record) =>
    total + record.electricityLightingSharePercent * record.households / 100, 0);
  const aggregate = {
    id: properties.shapeID,
    name: properties.shapeName,
    year: state.censusMapYear,
    population,
    population2011,
    population2022,
    populationGrowthPercent: population2011 > 0
      ? Number(((population2022 / population2011 - 1) * 100).toFixed(2))
      : null,
    households,
    waterSchemeHouseholds,
    waterSchemeSharePercent: households > 0
      ? Number((waterSchemeHouseholds / households * 100).toFixed(2))
      : null,
    electricityLightingSharePercent: households > 0
      ? Number((weightedElectricityHouseholds / households * 100).toFixed(2))
      : null,
    sourceAreaKm2,
    populationDensityPerKm2: sourceAreaKm2 > 0
      ? Number((population / sourceAreaKm2).toFixed(2))
      : null,
    aggregated: true,
    municipalityCount: members.length
  };
  state.censusMapAggregates.set(cacheKey, aggregate);
  return aggregate;
}

function mapIndicatorValue(feature) {
  if (state.mapLayer === "airQuality") return null;
  if (state.mapLayer === "unemployment") {
    if (feature.properties.shapeType !== "ADM1") return null;
    const province = canonicalProvinceName(feature.properties.shapeName);
    return state.labourMapRecords.get(province)?.officialRate ?? null;
  }
  if (state.mapLayer === "economy") {
    if (feature.properties.shapeType !== "ADM1") return null;
    const province = canonicalProvinceName(feature.properties.shapeName);
    return state.provincialEconomyData?.records
      .find((record) => record.province === province)?.gdpContributionPercent ?? null;
  }
  if (state.mapLayer === "temperature") {
    if (feature.properties.shapeType !== "ADM1") return null;
    const province = canonicalProvinceName(feature.properties.shapeName);
    return state.climateMapRecords.get(province)?.annual?.temperatureC ?? null;
  }
  if (state.mapLayer === "precipitation") {
    if (feature.properties.shapeType !== "ADM1") return null;
    const province = canonicalProvinceName(feature.properties.shapeName);
    return state.climateMapRecords.get(province)?.annual?.precipitationMmPerDay ?? null;
  }
  const record = censusMapRecordForFeature(feature);
  if (!record) return null;
  return state.mapLayer === "population"
    ? record.populationDensityPerKm2
    : state.mapLayer === "growth"
      ? record.populationGrowthPercent
      : state.mapLayer === "water"
        ? record.waterSchemeSharePercent
        : state.mapLayer === "electricity"
          ? record.electricityLightingSharePercent
          : null;
}

function activeMapRecords() {
  if (state.mapLayer === "airQuality") return state.airQualityStations;
  if (state.mapLayer === "unemployment") return [...state.labourMapRecords.values()];
  if (state.mapLayer === "economy") return state.provincialEconomyData?.records ?? [];
  if (["temperature", "precipitation"].includes(state.mapLayer)) return [...state.climateMapRecords.values()];
  if (state.mapLayer === "boundaries") return [...state.censusMapRecords.values()];
  return (state.boundaryLayer?.getLayers() ?? [])
    .map((layer) => censusMapRecordForFeature(layer.feature))
    .filter(Boolean);
}

function appendMapCoverage(items) {
  if (state.mapLayer === "airQuality") return;
  const areas = (state.boundaryLayer?.getLayers() ?? [])
    .map((layer) => layer.feature)
    .filter((feature) => feature?.properties?.shapeID);
  if (!areas.length) return;
  const verified = areas.filter((feature) => {
    const value = mapIndicatorValue(feature);
    return typeof value === "number" && Number.isFinite(value);
  }).length;
  const level = ({ ADM1: "provinces", ADM2: "districts / metros", ADM3: "municipalities" })[state.boundaryLevel] ?? "areas";
  const coverage = document.createElement("span");
  coverage.className = "map-coverage-status";
  coverage.textContent = `Verified values: ${verified} of ${areas.length} ${level}`;
  items.append(coverage);
}

function mapIndicatorBreaks() {
  // Keep map colors comparable when users switch boundary levels or periods.
  const fixedBreaks = {
    population: [10, 50, 250, 1000],
    growth: [-10, 0, 10, 25],
    unemployment: [15, 20, 25, 30],
    economy: [5, 10, 15, 20],
    temperature: [10, 15, 20, 25],
    precipitation: [1, 2, 3, 4],
    electricity: [20, 40, 60, 80],
    water: [20, 40, 60, 80]
  };
  return fixedBreaks[state.mapLayer] ?? [];
}

function mapStyle(feature) {
  const style = baseStyle(feature);
  if (["boundaries", "airQuality"].includes(state.mapLayer)) return style;
  const value = mapIndicatorValue(feature);
  if (value === null) {
    return { ...style, color: "#87938d", fillColor: "url(#civicstats-map-no-data-pattern)", fillOpacity: 1 };
  }
  const breaks = mapIndicatorBreaks();
  const colors = ["#29463d", "#3c6252", "#61836a", "#9d9861", "#c1814f"];
  const colorIndex = breaks.findIndex((limit) => value <= limit);
  return {
    ...style,
    color: "#8e9b91",
    fillColor: colors[colorIndex < 0 ? colors.length - 1 : colorIndex],
    fillOpacity: 0.72
  };
}

function ensureNoDataMapPattern() {
  const svg = state.boundaryLayer?.getLayers()[0]?.getElement()?.ownerSVGElement;
  if (!svg || svg.querySelector("#civicstats-map-no-data-pattern")) return;
  const namespace = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(namespace, "defs");
  const pattern = document.createElementNS(namespace, "pattern");
  pattern.setAttribute("id", "civicstats-map-no-data-pattern");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", "8");
  pattern.setAttribute("height", "8");
  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("width", "8");
  background.setAttribute("height", "8");
  background.setAttribute("fill", "#303936");
  const hatch = document.createElementNS(namespace, "path");
  hatch.setAttribute("d", "M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6");
  hatch.setAttribute("fill", "none");
  hatch.setAttribute("stroke", "#87938d");
  hatch.setAttribute("stroke-width", "1");
  pattern.append(background, hatch);
  defs.append(pattern);
  svg.prepend(defs);
}

function mapTooltipData(feature) {
  const geographyLevel = feature.properties.shapeType;
  const geographyLabel = formatBoundaryLevel(geographyLevel).toLocaleLowerCase();
  const name = geographyLevel === "ADM1"
    ? canonicalProvinceName(feature.properties.shapeName)
    : feature.properties.shapeName;
  if (state.mapLayer === "boundaries") {
    return {
      place: name,
      indicator: "Administrative boundary",
      value: `${formatBoundaryLevel(feature.properties.shapeType)} boundary`,
      period: "2020 boundary vintage",
      source: "geoBoundaries · OCHA ROSEA / Municipal Demarcation Board",
      note: "Shows the mapped administrative outline, not a statistical value."
    };
  }
  if (state.mapLayer === "airQuality") {
    return {
      place: name,
      indicator: "PM2.5 monitoring stations",
      value: "Read station markers on the map",
      period: "Latest available reading per station",
      source: "OpenAQ · aggregated public monitoring data",
      note: "This layer shows station observations only. Areas without a station reading are data gaps, not evidence of clean air."
    };
  }
  if (state.mapLayer === "unemployment") {
    const period = state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter;
    if (geographyLevel !== "ADM1") {
      return { place: name, indicator: "Official unemployment rate", value: `Not available at ${geographyLabel} level`, period, source: "Statistics South Africa · QLFS", note: "Stats SA publishes this estimate at province level only. Choose Provinces to see a verified value." };
    }
    const record = state.labourMapRecords.get(name);
    return {
      place: name,
      indicator: "Official unemployment rate",
      value: Number.isFinite(record?.officialRate) ? `${record.officialRate.toFixed(1)}%` : "No data for this province",
      period,
      source: "Statistics South Africa · Quarterly Labour Force Survey",
      note: Number.isFinite(record?.officialRate) ? "Province-level estimate; not a district or municipal rate." : `No verified unemployment estimate is available for ${name} in ${period}.`
    };
  }
  if (state.mapLayer === "economy") {
    if (geographyLevel !== "ADM1") {
      return { place: name, indicator: "Regional GDP (GDP-R)", value: `Not available at ${geographyLabel} level`, period: String(state.economyMapYear), source: "Statistics South Africa · GDP-R P0441.2", note: "Stats SA publishes GDP-R at province level only. Choose Provinces to see a verified value." };
    }
    const record = state.provincialEconomyData?.records
      .find((item) => item.province === name);
    return {
      place: name,
      indicator: "Share of national GDP · nominal GDP-R",
      value: Number.isFinite(record?.gdpContributionPercent)
        ? `${record.gdpContributionPercent.toFixed(1)}% · R${formatCensusNumber(record.gdpCurrentPricesRandMillions)} million`
        : "No data for this province",
      period: String(state.economyMapYear),
      source: "Statistics South Africa · GDP-R P0441.2",
      note: Number.isFinite(record?.gdpContributionPercent) ? "Province-level estimate; GDP-R is not a district or municipal measure." : `No verified GDP-R value is available for ${name} in ${state.economyMapYear}.`
    };
  }
  if (state.mapLayer === "temperature") {
    if (geographyLevel !== "ADM1") {
      return { place: name, indicator: "Annual mean temperature", value: `Not available at ${geographyLabel} level`, period: "NASA POWER climatology", source: "NASA Langley Research Center · POWER", note: "This first-stage map layer reports province representative-point normals only." };
    }
    const result = state.climateMapRecords.get(name);
    const value = result?.annual?.temperatureC;
    return {
      place: name,
      indicator: "Annual mean temperature",
      value: Number.isFinite(value) ? `${formatCensusNumber(value, 1)} °C` : "No data for this province",
      period: result?.source?.period ?? "NASA POWER climatology period not reported",
      source: "NASA Langley Research Center · POWER",
      note: Number.isFinite(value) ? "Long-run gridded climatology at one representative point in the province; not a forecast or province-wide spatial average." : "No verified NASA POWER temperature normal is available for this province."
    };
  }
  if (state.mapLayer === "precipitation") {
    if (geographyLevel !== "ADM1") {
      return { place: name, indicator: "Mean daily precipitation", value: `Not available at ${geographyLabel} level`, period: "NASA POWER climatology", source: "NASA Langley Research Center · POWER", note: "This province-level climate layer is a climatological mean daily rate, not annual rainfall totals." };
    }
    const result = state.climateMapRecords.get(name);
    const value = result?.annual?.precipitationMmPerDay;
    return {
      place: name,
      indicator: "Mean daily precipitation",
      value: Number.isFinite(value) ? `${formatCensusNumber(value, 1)} mm/day` : "No data for this province",
      period: result?.source?.period ?? "NASA POWER climatology period not reported",
      source: "NASA Langley Research Center · POWER",
      note: Number.isFinite(value) ? "Long-run climatological mean daily precipitation at one representative point in the province; not an annual total or forecast." : "No verified NASA POWER precipitation normal is available for this province."
    };
  }
  const record = censusMapRecordForFeature(feature);
  const source = state.mapLayer === "electricity"
    ? "Stats SA · municipal Census fact sheet"
    : "Statistics South Africa · Census";
  const period = state.mapLayer === "growth" ? "Census 2011–2022" : `Census ${state.censusMapYear}`;
  const indicators = {
    population: "Population density",
    growth: "Population change",
    electricity: "Electricity as main lighting source",
    water: "Water-scheme household share"
  };
  if (!record) {
    return { place: name, indicator: indicators[state.mapLayer] ?? "Census indicator", value: "No data for this area", period, source, note: `No verified ${period} Census record is available for ${name} at this geography level.` };
  }
  let value;
  let note = record.aggregated
    ? `${record.municipalityCount} matched municipal records combined for this larger area.`
    : "Municipality-level Census record.";
  if (state.mapLayer === "growth") {
    const growth = record.populationGrowthPercent;
    value = Number.isFinite(growth) ? `${formatCensusNumber(growth, 1)}%` : "Data unavailable";
    note = record.aggregated
      ? `${record.municipalityCount} matched municipalities combined; change is derived from summed Census totals.`
      : "Reported Census population change from 2011 to 2022.";
  } else if (state.mapLayer === "population") {
    value = Number.isFinite(record.populationDensityPerKm2)
      ? `${formatCensusNumber(record.populationDensityPerKm2, 1)} people/km²`
      : "Data unavailable";
  } else if (state.mapLayer === "electricity") {
    value = Number.isFinite(record.electricityLightingSharePercent)
      ? `${formatCensusNumber(record.electricityLightingSharePercent, 1)}% of households`
      : "Data unavailable";
    note = "Households reporting electricity as their main lighting source; this does not measure outages or reliability.";
    if (record.aggregated) note = `${record.municipalityCount} matched municipal records combined; ${note}`;
  } else {
    value = Number.isFinite(record.waterSchemeSharePercent)
      ? `${formatCensusNumber(record.waterSchemeSharePercent, 1)}% of households`
      : "Data unavailable";
    note = "Households reporting a water-scheme source; this does not measure water quality or supply continuity.";
    if (record.aggregated) note = `${record.municipalityCount} matched municipal records combined; ${note}`;
  }
  if (value === "Data unavailable") {
    note = `No verified ${indicators[state.mapLayer] ?? "Census indicator"} value is available for ${name} in ${period}.`;
  }
  return { place: name, indicator: indicators[state.mapLayer] ?? "Census indicator", value, period, source, note };
}

function mapTooltip(feature, { stateLabel = "PREVIEW", compact = false } = {}) {
  const data = mapTooltipData(feature);
  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip-card";
  const stateBadge = document.createElement("span");
  stateBadge.className = "map-tooltip-state";
  stateBadge.textContent = stateLabel;
  tooltip.append(stateBadge);
  const place = document.createElement("strong");
  place.className = "map-tooltip-place";
  place.textContent = data.place;
  tooltip.append(place);

  const indicator = document.createElement("span");
  indicator.className = "map-tooltip-indicator";
  indicator.textContent = data.indicator;
  tooltip.append(indicator);

  const value = document.createElement("strong");
  value.className = "map-tooltip-value";
  value.textContent = data.value;
  tooltip.append(value);

  if (compact) return tooltip;

  const metadata = document.createElement("div");
  metadata.className = "map-tooltip-metadata";
  for (const [label, content] of [["PERIOD", data.period], ["SOURCE", data.source]]) {
    const row = document.createElement("div");
    row.className = "map-tooltip-row";
    const key = document.createElement("span");
    key.className = "map-tooltip-key";
    key.textContent = label;
    const detail = document.createElement("span");
    detail.className = "map-tooltip-detail";
    detail.textContent = content;
    row.append(key, detail);
    metadata.append(row);
  }
  tooltip.append(metadata);
  if (data.note) {
    const note = document.createElement("span");
    note.className = "map-tooltip-note";
    note.textContent = data.note;
    tooltip.append(note);
  }
  return tooltip;
}

function pinMapIndicatorDetail(feature) {
  const panel = document.querySelector("#map-pinned-detail");
  const content = document.querySelector("#map-pinned-detail-content");
  if (!panel || !content) return;
  content.replaceChildren(mapTooltip(feature, { stateLabel: "SELECTED" }));
  panel.hidden = false;
}

function closeMapPinnedDetail() {
  const panel = document.querySelector("#map-pinned-detail");
  const content = document.querySelector("#map-pinned-detail-content");
  if (panel) panel.hidden = true;
  content?.replaceChildren();
}

function updateMapZoomPath() {
  const path = document.querySelector("#map-zoom-path");
  if (!path) return;
  const level = state.boundaryLevel ?? "ADM1";
  const currentLabel = level === "ADM3" ? "Municipality" : level === "ADM2" ? "District or metro" : "Province";
  path.setAttribute("aria-label", `Current map detail: ${currentLabel}`);
  path.querySelectorAll("[data-zoom-level]").forEach((step) => {
    if (step.dataset.zoomLevel === level) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
}

function showMapHoverComparison(feature, event) {
  const action = document.querySelector("#map-hover-compare");
  if (!action || !state.mapHoverPreviews) return;
  if (feature.properties.shapeType !== "ADM3") {
    action.hidden = true;
    state.hoveredMapGeographyId = null;
    return;
  }
  state.hoveredMapGeographyId = feature.properties.shapeID;
  const name = feature.properties.shapeName;
  document.querySelector("#map-hover-compare-name").textContent = name;
  document.querySelector("#map-hover-compare-button").setAttribute("aria-label", `Start a comparison with ${name}`);
  action.hidden = false;
  const size = state.map?.getSize();
  const point = event?.containerPoint;
  if (!size || !point) return;
  const { offsetWidth: width, offsetHeight: height } = action;
  const left = Math.max(8, Math.min(point.x + 14, size.x - width - 8));
  const top = Math.max(48, Math.min(point.y + 14, size.y - height - 8));
  action.style.left = `${left}px`;
  action.style.top = `${top}px`;
}

function mapTablePresentation() {
  const year = state.mapLayer === "unemployment"
    ? state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter
    : state.mapLayer === "economy"
      ? state.economyMapYear
      : state.censusMapYear;
  const values = {
    boundaries: ["Administrative boundary", "—", "Boundary vintage 2020"],
    population: ["Population density", "people/km²", `Census ${year}`],
    temperature: ["Annual mean temperature", "°C", "NASA POWER climatology"],
    precipitation: ["Mean daily precipitation", "mm/day", "NASA POWER climatology"],
    growth: ["Reported population change", "%", "Census 2011–2022"],
    unemployment: ["Official unemployment rate", "%", year],
    economy: ["Share of national GDP", "%", `GDP-R ${year}`],
    electricity: ["Households reporting electricity as their main lighting source", "% of households", `Census ${year}`],
    water: ["Households reporting a water-scheme source", "% of households", `Census ${year}`]
  };
  const [label, unit, period] = values[state.mapLayer] ?? ["Map indicator", "", ""];
  return { label, unit, period };
}

function renderMapDataTable() {
  const panel = document.querySelector("#map-data-table-panel");
  const title = document.querySelector("#map-data-table-title");
  const description = document.querySelector("#map-data-table-description");
  const content = document.querySelector("#map-data-table-content");
  if (!panel || panel.hidden || !title || !description || !content) return;
  const presentation = mapTablePresentation();
  if (state.mapLayer === "airQuality") {
    title.textContent = `PM2.5 station readings · ${state.airQualityStations.length} stations`;
    description.textContent = "Latest available OpenAQ PM2.5 observation for each reporting station. Times are supplied by the data provider; missing or old readings do not indicate clean air.";
    content.replaceChildren();
    const table = document.createElement("table");
    table.className = "data-table map-data-table";
    table.setAttribute("aria-describedby", "map-data-table-description");
    const caption = document.createElement("caption");
    caption.textContent = "Latest PM2.5 observation by monitoring station";
    table.append(caption);
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    ["Station", "PM2.5 (µg/m³)", "Observed at", "Provider"].forEach((label) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      header.append(cell);
    });
    thead.append(header);
    const tbody = document.createElement("tbody");
    state.airQualityStations.slice().sort((left, right) => left.name.localeCompare(right.name)).forEach((station) => {
      const row = document.createElement("tr");
      [station.name, formatCensusNumber(station.pm25.value, 2), station.pm25.observedAtLocal, station.provider].forEach((value, index) => {
        const cell = index === 0 ? document.createElement("th") : document.createElement("td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    content.append(table);
    return;
  }
  const geographyLevel = formatBoundaryLevel(state.boundaryLevel);
  title.textContent = `${presentation.label} · ${geographyLevel}`;
  const aggregateNote = state.boundaryLevel === "ADM3" || state.mapLayer === "boundaries"
    ? ""
    : state.mapLayer === "population"
      ? " District and province values sum matched municipal Census populations and Census source areas."
      : state.mapLayer === "growth"
        ? " District and province values calculate change from summed municipal 2011 and 2022 Census populations."
        : state.mapLayer === "water"
          ? " District and province shares divide summed water-scheme households by summed households."
          : " District and province electricity shares are household-weighted averages of published municipal percentages, so are approximate.";
  const geographyNote = aggregateNote
    ? " Municipal membership follows representative points within geoBoundaries 2020 polygons; these are derived views, not official Stats SA parent-area tabulations."
    : "";
  description.textContent = `Reporting period: ${presentation.period}. Values are ${presentation.unit}. “Not available” means no compatible source value was loaded for that area.${aggregateNote}${geographyNote}`;
  content.replaceChildren();
  const collection = state.collections.get(state.boundaryLevel);
  if (!collection?.features?.length) {
    const message = document.createElement("p");
    message.className = "finance-source-note";
    message.textContent = "Boundary data is still loading.";
    content.append(message);
    return;
  }
  const table = document.createElement("table");
  table.className = "data-table map-data-table";
  table.setAttribute("aria-describedby", "map-data-table-description");
  const caption = document.createElement("caption");
  caption.textContent = `${presentation.label} by ${geographyLevel.toLocaleLowerCase()}`;
  table.append(caption);
  const thead = document.createElement("thead");
  const header = document.createElement("tr");
  ["Area", `Value${presentation.unit && presentation.unit !== "—" ? ` (${presentation.unit})` : ""}`, "Reporting period"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    header.append(cell);
  });
  thead.append(header);
  const tbody = document.createElement("tbody");
  collection.features
    .slice()
    .sort((left, right) => left.properties.shapeName.localeCompare(right.properties.shapeName))
    .forEach((feature) => {
      const row = document.createElement("tr");
      const area = document.createElement("th");
      area.scope = "row";
      area.textContent = feature.properties.shapeName;
      const valueCell = document.createElement("td");
      const value = mapIndicatorValue(feature);
      valueCell.textContent = state.mapLayer === "boundaries"
        ? "Boundary available"
        : typeof value === "number" && Number.isFinite(value)
          ? formatCensusNumber(value, 1)
          : "Not available";
      const periodCell = document.createElement("td");
      periodCell.textContent = presentation.period;
      row.append(area, valueCell, periodCell);
      tbody.append(row);
    });
  table.append(thead, tbody);
  content.append(table);
}

function exportMapDataTable() {
  const table = document.querySelector("#map-data-table-content table");
  if (!table) {
    showToast("Map data is still loading. Try the download again shortly.");
    return;
  }
  const rows = [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th,td")].map((cell) => cell.textContent.trim())
  );
  const label = document.querySelector("#map-data-table-title")?.textContent ?? "map-data";
  const slug = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadCsv(`civicstats-${slug || "map-data"}.csv`, rows);
  showToast("Displayed map table downloaded as CSV.");
}

function appendMissingMapLegendEntry(items, label = "No verified value · hatched gray") {
  const row = document.createElement("span");
  row.className = "map-legend-range";
  const swatch = document.createElement("i");
  swatch.className = "map-legend-swatch missing-swatch";
  const text = document.createElement("span");
  text.textContent = label;
  row.append(swatch, text);
  items.append(row);
}

function renderMapLegend() {
  const heading = document.querySelector("#map-legend-heading");
  const items = document.querySelector("#map-legend-items");
  if (!heading || !items) return;
  items.replaceChildren();
  if (state.mapLayer === "boundaries") {
    heading.textContent = "BOUNDARY KEY";
    items.innerHTML = '<span><i class="legend-line active-line"></i>Selected municipality</span><span><i class="legend-line"></i>Municipal boundary</span><span class="legend-note">Real geoBoundaries polygons · 2020 vintage</span>';
    appendNationalBorderLegend(items);
    if (state.censusMapError) {
      const failure = document.createElement("span");
      failure.className = "legend-note";
      failure.textContent = "Census map data is temporarily unavailable.";
      items.append(failure);
      addRetryButton(items, () => void loadCensusMapData(state.censusMapYear), "Retry Census data");
    }
    return;
  }
  if (state.mapLayer === "airQuality") {
    heading.textContent = "STATION PM2.5 · OPENAQ";
    appendNationalBorderLegend(items);
    if (state.airQualityLoading) {
      const loading = document.createElement("span");
      loading.className = "legend-note";
      loading.textContent = "Loading latest available PM2.5 station observations…";
      items.append(loading);
      return;
    }
    if (state.airQualityError) {
      const message = document.createElement("span");
      message.className = "legend-note";
      message.textContent = state.airQualityError === "Air-quality station data is not configured on this server."
        ? "OpenAQ is not configured yet. Add OPENAQ_API_KEY as a private Render environment variable to load station readings."
        : "OpenAQ station readings are temporarily unavailable. Try again later.";
      items.append(message);
      if (state.airQualityError !== "Air-quality station data is not configured on this server.") {
        addRetryButton(items, () => void loadAirQualityData(), "Retry station data");
      }
    } else if (!state.airQualityStations.length) {
      const empty = document.createElement("span");
      empty.className = "legend-note";
      empty.textContent = "No latest PM2.5 observations were returned for South African stations.";
      items.append(empty);
    } else {
      const fresh = state.airQualityStations.filter((station) =>
        (Date.now() - Date.parse(station.pm25.observedAtUtc)) / 3600000 <= 48
      ).length;
      const coverage = document.createElement("span");
      coverage.className = "map-coverage-status";
      coverage.textContent = `${fresh} recent readings · ${state.airQualityStations.length} stations with data`;
      items.append(coverage);
      const thresholds = ["≤ 5 µg/m³", "> 5–15 µg/m³", "> 15–25 µg/m³", "> 25–35 µg/m³", "> 35 µg/m³"];
      thresholds.forEach((range, index) => {
        const row = document.createElement("span");
        row.className = "map-legend-range";
        const swatch = document.createElement("i");
        swatch.className = "map-legend-swatch air-quality-swatch";
        swatch.style.backgroundColor = pm25MarkerColor([2, 10, 20, 30, 40][index], false);
        const label = document.createElement("span");
        label.textContent = range;
        row.append(swatch, label);
        items.append(row);
      });
      const staleCount = state.airQualityStations.length - fresh;
      const staleNote = document.createElement("span");
      staleNote.className = "legend-note";
      staleNote.textContent = `${staleCount} readings older than 48 hours · gray markers are stale.`;
      items.append(staleNote);
      const checked = document.createElement("span");
      checked.className = "legend-note";
      checked.textContent = `Source checked ${new Date(state.airQualityCheckedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}.`;
      items.append(checked);
      const coverageNote = document.createElement("span");
      coverageNote.className = "legend-note";
      const metadata = state.airQualityMetadata;
      coverageNote.textContent = `Latest values are returned for ${metadata?.stationLocationsReturned ?? state.airQualityStations.length} of ${metadata?.stationLocationsFound ?? state.airQualityStations.length} PM2.5 station locations; ${metadata?.failedLocations ?? 0} station requests failed. Coverage is uneven. No marker is not evidence of clean air.`;
      items.append(coverageNote);
    }
    const sourceLink = document.createElement("a");
    sourceLink.className = "legend-source-link";
    sourceLink.href = "https://openaq.org/";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Open OpenAQ source ↗";
    items.append(sourceLink);
    return;
  }
  if (state.mapLayer === "unemployment") {
    const period = state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter;
    heading.textContent = `OFFICIAL UNEMPLOYMENT · ${period}`;
  } else if (state.mapLayer === "economy") {
    heading.textContent = `GDP CONTRIBUTION · ${state.economyMapYear}`;
  } else if (state.mapLayer === "temperature") {
    heading.textContent = "ANNUAL MEAN TEMPERATURE · NASA POWER";
  } else if (state.mapLayer === "precipitation") {
    heading.textContent = "MEAN DAILY PRECIPITATION · NASA POWER";
  } else if (state.mapLayer === "growth") {
    heading.textContent = "POPULATION GROWTH · CENSUS 2011–2022";
  } else {
    heading.textContent = state.mapLayer === "population"
      ? `POPULATION DENSITY · CENSUS ${state.censusMapYear}`
      : state.mapLayer === "electricity"
        ? `ELECTRICITY FOR LIGHTING · CENSUS ${state.censusMapYear}`
        : `WATER SCHEME SHARE · CENSUS ${state.censusMapYear}`;
  }
  appendNationalBorderLegend(items);
  appendMapCoverage(items);
  const records = activeMapRecords();
  if (!records.length) {
    const note = document.createElement("span");
    note.className = "legend-note";
    if (state.mapLayer === "unemployment") {
      note.textContent = state.labourMapError
        ? `Stats SA provincial data unavailable: ${state.labourMapError}`
        : state.labourMapLoading
          ? "Loading Stats SA provincial survey estimates…"
          : "Stats SA provincial estimates are unavailable.";
    } else if (state.mapLayer === "economy") {
      note.textContent = state.economyMapError
        ? `Stats SA GDP-R data unavailable: ${state.economyMapError}`
        : state.economyMapLoading
          ? "Loading Stats SA provincial GDP-R values…"
          : "Stats SA provincial GDP-R values are unavailable.";
    } else if (state.mapLayer === "temperature") {
      note.textContent = state.climateMapError
        ? `NASA POWER temperature data unavailable: ${state.climateMapError}`
        : state.climateMapLoading
          ? "Loading NASA POWER province temperature normals…"
          : "NASA POWER province temperature normals are unavailable.";
    } else if (state.mapLayer === "precipitation") {
      note.textContent = state.climateMapError
        ? `NASA POWER precipitation data unavailable: ${state.climateMapError}`
        : state.climateMapLoading
          ? "Loading NASA POWER province precipitation normals…"
          : "NASA POWER province precipitation normals are unavailable.";
    } else {
      note.textContent = state.censusMapError
        ? `Census layer unavailable: ${state.censusMapError}`
        : state.censusMapLoading
          ? "Loading verified Census municipality values…"
          : "Census map values are unavailable.";
    }
    items.append(note);
    appendMissingMapLegendEntry(items, "No verified data · hatched gray");
    const failed = state.mapLayer === "unemployment" ? Boolean(state.labourMapError)
      : state.mapLayer === "economy" ? Boolean(state.economyMapError)
        : ["temperature", "precipitation"].includes(state.mapLayer) ? Boolean(state.climateMapError)
        : Boolean(state.censusMapError);
    if (failed) addRetryButton(items, () => {
      if (state.mapLayer === "unemployment") void loadProvincialLabourData();
      else if (state.mapLayer === "economy") void loadProvincialGdpData(state.economyMapYear);
      else if (["temperature", "precipitation"].includes(state.mapLayer)) void loadProvincialTemperatureData();
      else void loadCensusMapData(state.censusMapYear);
    }, "Retry data");
    return;
  }
  const values = records
    .map((record) => state.mapLayer === "unemployment"
      ? record.officialRate
      : state.mapLayer === "population"
        ? record.populationDensityPerKm2
        : state.mapLayer === "economy"
          ? record.gdpContributionPercent
          : state.mapLayer === "temperature"
            ? record.annual?.temperatureC
            : state.mapLayer === "precipitation"
              ? record.annual?.precipitationMmPerDay
          : state.mapLayer === "electricity"
            ? record.electricityLightingSharePercent
            : record.waterSchemeSharePercent)
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!values.length) {
    const note = document.createElement("span");
    note.className = "legend-note";
    note.textContent = "No compatible indicator values are available for these areas.";
    items.append(note);
    appendMissingMapLegendEntry(items, "No verified data · hatched gray");
    return;
  }
  const breaks = mapIndicatorBreaks();
  const colors = ["#29463d", "#3c6252", "#61836a", "#9d9861", "#c1814f"];
  const direction = document.createElement("div");
  direction.className = "map-legend-direction";
  const lowerLabel = document.createElement("span");
  lowerLabel.textContent = "LOWER";
  const gradient = document.createElement("i");
  gradient.className = "map-legend-gradient";
  gradient.setAttribute("aria-hidden", "true");
  gradient.style.background = `linear-gradient(90deg, ${colors.join(", ")})`;
  const higherLabel = document.createElement("span");
  higherLabel.textContent = "HIGHER";
  direction.append(lowerLabel, gradient, higherLabel);
  items.append(direction);
  colors.forEach((color, index) => {
    const row = document.createElement("span");
    row.className = "map-legend-range";
    const swatch = document.createElement("i");
    swatch.className = "map-legend-swatch";
    swatch.style.backgroundColor = color;
    const rank = document.createElement("span");
    rank.className = "map-legend-band-rank";
    rank.textContent = String(index + 1);
    const range = document.createElement("span");
    const upper = breaks[index] ?? values.at(-1);
    const precision = 1;
    const suffix = state.mapLayer === "population" ? " people/km²" : state.mapLayer === "temperature" ? " °C" : state.mapLayer === "precipitation" ? " mm/day" : "%";
    const label = `Band ${index + 1}`;
    if (index === 0) {
      range.textContent = `${label}: ≤ ${formatCensusNumber(upper, precision)}${suffix}`;
    } else if (index === colors.length - 1) {
      range.textContent = `${label}: > ${formatCensusNumber(breaks[index - 1], precision)}${suffix}`;
    } else {
      range.textContent = `${label}: > ${formatCensusNumber(breaks[index - 1], precision)} to ≤ ${formatCensusNumber(upper, precision)}${suffix}`;
    }
    row.append(swatch, rank, range);
    items.append(row);
  });
  const layerMetadata = state.mapLayer === "unemployment"
    ? {
      detail: `Source: Stats SA QLFS · ${state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter}; unit: percent of labour force; provincial estimate.`,
      updated: `Source release ${state.labourData?.source.releaseDate ?? "date unavailable"}`,
      url: state.labourData?.source.sourceUrl
    }
    : ["temperature", "precipitation"].includes(state.mapLayer)
      ? {
        detail: state.mapLayer === "temperature"
          ? "Source: NASA Langley Research Center · POWER climatology; annual mean near-surface air temperature at one representative point per province; unit: °C."
          : "Source: NASA Langley Research Center · POWER climatology; mean daily precipitation at one representative point per province; unit: mm/day.",
        updated: `Normal period ${state.climateMapRecords.values().next().value?.source?.period ?? "reported by source"}`,
        url: "https://power.larc.nasa.gov/"
      }
      : state.mapLayer === "economy"
      ? {
        detail: `Source: Stats SA GDP-R P0441.2 · ${state.economyMapYear}; unit: percent of national nominal GDP; province-level only.`,
        updated: `Publication ${state.provincialEconomyData?.source.publicationDate ?? "date unavailable"}`,
        url: state.provincialEconomyData?.source.url
      }
      : state.mapLayer === "growth"
        ? {
          detail: "Source: Stats SA Census · reported population change, 2011–2022; unit: percent.",
          updated: "Source release 2023-10-10",
          url: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf"
        }
        : state.mapLayer === "population"
          ? {
            detail: `Source: Stats SA Census ${state.censusMapYear}; unit: people/km², calculated from reported population and source area.`,
            updated: "Source release 2023-10-10",
            url: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf"
          }
          : state.mapLayer === "electricity"
            ? {
              detail: `Source: Stats SA Census municipal fact sheet · ${state.censusMapYear}; unit: percent of households reporting electricity as main lighting source, not connection or reliability.`,
              updated: "Source release date not supplied in bundled metadata",
              url: "https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf"
            }
            : {
              detail: `Source: Stats SA Census ${state.censusMapYear}; unit: percent of households reporting water scheme as source.`,
              updated: "Source release 2023-10-10",
              url: "https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf"
            };
  const interpretation = state.mapLayer === "unemployment"
    ? "Shows the share of each province’s labour force without work. These are provincial survey estimates, not municipal rates."
    : state.mapLayer === "temperature"
      ? "Shows annual mean temperature from NASA POWER long-run climatology at one representative point per province. It is not live weather or a province-wide spatial average."
      : state.mapLayer === "precipitation"
        ? "Shows the climatological mean daily precipitation rate from NASA POWER at one representative point per province. This is not a yearly rainfall total or a forecast."
      : state.mapLayer === "economy"
      ? "Shows each province’s share of South Africa’s economy for the selected year. It does not show municipal economic output."
      : state.mapLayer === "growth"
        ? "Shows the change between the 2011 and 2022 Censuses. It is not an annual growth rate or a forecast."
        : state.mapLayer === "population"
          ? "People per square kilometre, calculated from the Census population and municipal area."
          : state.mapLayer === "electricity"
            ? "Share of households reporting electricity as their main source for lighting. It does not measure outages or reliability."
            : "Share of households in the Census water-scheme category. It does not measure current water quality or supply interruptions.";
  const interpretationNote = document.createElement("span");
  interpretationNote.className = "legend-note legend-interpretation";
  interpretationNote.textContent = interpretation;
  const scaleNote = document.createElement("span");
  scaleNote.className = "legend-note";
  scaleNote.textContent = state.mapLayer === "unemployment"
    ? "Same ranges at every boundary level. Higher means more people in the labour force are unemployed; that indicates a worse employment outcome."
    : state.mapLayer === "temperature"
      ? "Higher means a warmer climatological annual mean at the sampled representative point. Do not interpret as a forecast or local reading."
      : state.mapLayer === "precipitation"
        ? "Higher means a greater long-run average daily precipitation rate at the sampled representative point; it is not the total rainfall for a year."
      : state.mapLayer === "economy"
      ? "Same ranges at every boundary level. Higher means a larger share of national GDP-R, not higher income per person."
      : state.mapLayer === "growth"
        ? "Same ranges at every boundary level. Higher means faster population change; negative values indicate population decline."
        : state.mapLayer === "population"
          ? "Same ranges at every boundary level. Higher means more residents per km², not a larger total population."
          : state.mapLayer === "electricity"
            ? "Same ranges at every boundary level. Higher means more households report electricity as their main lighting source; it does not measure outages."
            : "Same ranges at every boundary level. Higher means more households report a water scheme as their source; it does not measure water quality or reliability.";
  const missingLabel = state.mapLayer === "unemployment" || state.mapLayer === "economy" || ["temperature", "precipitation"].includes(state.mapLayer)
    ? "No value at this level · province data only · hatched gray"
    : "No verified value in source or matched records · hatched gray";
  const coverageNote = document.createElement("span");
  coverageNote.className = "legend-note";
  coverageNote.textContent = state.mapLayer === "unemployment"
    ? "Coverage: Stats SA publishes this measure for provinces only. Use the province map for verified values; district and municipality areas are intentionally unscored."
    : state.mapLayer === "temperature" || state.mapLayer === "precipitation"
      ? "Coverage: province representative points only. District and municipality areas are intentionally unscored in this first stage."
      : state.mapLayer === "economy"
      ? "Coverage: GDP-R is published at province level only. Use the province map for verified values; district and municipality areas are intentionally unscored."
      : "Coverage: verified source records are municipal. District and province values are derived from matched municipal records; hatched areas have no usable verified value.";
  const note = document.createElement("span");
  note.className = "legend-note";
  const aggregateNote = state.boundaryLevel === "ADM3" || ["boundaries", "unemployment", "economy", "temperature", "precipitation"].includes(state.mapLayer)
    ? ""
    : state.mapLayer === "population"
      ? " Larger-area values sum matched municipal populations and source areas."
      : state.mapLayer === "growth"
        ? " Larger-area growth is calculated from summed 2011 and 2022 municipal population totals."
        : state.mapLayer === "water"
          ? " Larger-area shares divide summed municipal water-scheme households by summed households."
          : " Larger-area electricity shares are household-weighted averages of published municipal percentages and are approximate.";
  const geographyNote = aggregateNote
    ? " Municipality membership is crosswalked by representative point to geoBoundaries 2020 polygons; parent-area results are derived, not official Stats SA tabulations."
    : "";
  note.textContent = `${layerMetadata.detail} ${layerMetadata.updated}.${aggregateNote}${geographyNote} Hatched gray indicates no verified value for the selected indicator.`;
  items.append(interpretationNote, scaleNote, coverageNote);
  appendMissingMapLegendEntry(items, missingLabel);
  items.append(note);
  if (layerMetadata.url) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "legend-source-link";
    sourceLink.href = layerMetadata.url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Open original source ↗";
    items.append(sourceLink);
  }
}

function appendNationalBorderLegend(items) {
  if (state.view !== "dashboard" || state.selected) return;
  const outlineRow = document.createElement("span");
  outlineRow.className = "legend-border-key";
  const outline = document.createElement("span");
  outline.className = "legend-line national-boundary-key";
  const outlineLabel = document.createElement("span");
  outlineLabel.textContent = "South Africa outline";
  outlineRow.append(outline, outlineLabel);
  const provinceRow = document.createElement("span");
  provinceRow.className = "legend-border-key";
  const provinces = document.createElement("span");
  provinces.className = "legend-line province-boundary-key";
  const provinceLabel = document.createElement("span");
  provinceLabel.textContent = "Province borders";
  provinceRow.append(provinces, provinceLabel);
  items.prepend(provinceRow);
  items.prepend(outlineRow);
}

function setLabourQuarter(quarter) {
  if (!state.labourData) return;
  const period = state.labourData.periods.find((item) => item.code === quarter);
  if (!period) return;
  state.labourQuarter = period.code;
  state.labourMapRecords = new Map(state.labourData.records
    .filter((record) => record.quarter === period.code)
    .map((record) => [record.province, record]));
  const select = document.querySelector("#labour-quarter");
  if (select) select.value = period.code;
  refreshMapStyles();
  renderNationalHighlights();
  if (!state.selected) updateNationalProfileSummary();
}

async function loadProvincialLabourData() {
  if (state.labourData) return state.labourData;
  if (state.labourLoadPromise) return state.labourLoadPromise;
  state.labourMapLoading = true;
  state.labourMapError = null;
  refreshMapStyles();

  state.labourLoadPromise = getJson("/api/labour/provinces")
    .then((result) => {
      const expectedProvinces = [
        "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
        "Mpumalanga", "North West", "Northern Cape", "Western Cape"
      ];
      const periods = Array.isArray(result.periods) ? result.periods : [];
      const records = Array.isArray(result.records) ? result.records : [];
      const expectedKeys = new Set(periods.flatMap((period) =>
        expectedProvinces.map((province) => `${period.code}:${province}`)
      ));
      const actualKeys = new Set();
      const hasSource = result.source?.publisher === "Statistics South Africa" &&
        typeof result.source.sourceUrl === "string" &&
        result.source.sourceUrl.startsWith("https://");
      records.forEach((record) => actualKeys.add(`${record.quarter}:${record.province}`));
      if (!hasSource || result.totalProvinces !== expectedProvinces.length ||
        !periods.length || records.length !== expectedKeys.size || actualKeys.size !== expectedKeys.size ||
        [...expectedKeys].some((key) => !actualKeys.has(key)) ||
        records.some((record) =>
          !Number.isFinite(record.officialRate) || record.officialRate < 0 || record.officialRate > 100 ||
          !Number.isFinite(record.lu3Rate) || record.lu3Rate < 0 || record.lu3Rate > 100
        )) {
        throw new Error("Stats SA provincial unemployment data did not include valid rates for every province and reporting quarter.");
      }
      state.labourData = result;
      const select = document.querySelector("#labour-quarter");
      if (select) {
        select.replaceChildren(...periods.map((period) => {
          const option = document.createElement("option");
          option.value = period.code;
          option.textContent = period.label;
          return option;
        }));
      }
      const selectedQuarter = periods.some((period) => period.code === state.labourQuarter)
        ? state.labourQuarter
        : periods.at(-1).code;
      setLabourQuarter(selectedQuarter);
      return result;
    })
    .catch((error) => {
      state.labourMapError = error.message;
      state.labourMapRecords = new Map();
      return null;
    })
    .finally(() => {
      state.labourMapLoading = false;
      state.labourLoadPromise = null;
      refreshMapStyles();
      renderNationalMetrics();
      renderNationalHighlights();
      if (!state.selected) updateNationalProfileSummary();
      if (state.tab === "overview" && !state.selected) renderDetail();
      if (state.selected) void updateProfileSummary(state.selected);
    });
  return state.labourLoadPromise;
}

async function loadProvincialTemperatureData() {
  if (state.climateMapRecords.size === 9) return state.climateMapRecords;
  if (state.climateMapPromise) return state.climateMapPromise;
  const provinces = state.collections.get("ADM1")?.features ?? [];
  if (provinces.length !== 9) {
    state.climateMapError = "Province boundary data is unavailable.";
    return null;
  }
  state.climateMapLoading = true;
  state.climateMapError = null;
  updateMapLayerControls();
  state.climateMapPromise = Promise.all(provinces.map(async (feature) => {
    const result = await getJson(`/api/geographies/ADM1/${encodeURIComponent(feature.properties.shapeID)}/climate`);
    const name = canonicalProvinceName(result.geography?.name);
    if (!name || !Number.isFinite(result.annual?.temperatureC) ||
      !Number.isFinite(result.annual?.precipitationMmPerDay) || !result.source?.url) {
      throw new Error("NASA POWER returned incomplete provincial climate data.");
    }
    return [name, result];
  })).then((records) => {
    state.climateMapRecords = new Map(records);
    return state.climateMapRecords;
  }).catch((error) => {
    state.climateMapError = error.message;
    state.climateMapRecords = new Map();
    return null;
  }).finally(() => {
    state.climateMapLoading = false;
    state.climateMapPromise = null;
    refreshMapStyles();
    updateMapLayerControls();
    renderMapLegend();
  });
  return state.climateMapPromise;
}

async function loadAirQualityData() {
  if (state.airQualityStations.length) return state.airQualityStations;
  if (state.airQualityPromise) return state.airQualityPromise;
  state.airQualityLoading = true;
  state.airQualityError = null;
  refreshMapStyles();
  state.airQualityPromise = getJson("/api/environment/air-quality/pm25")
    .then((result) => {
      if (!Array.isArray(result.stations) ||
        result.source?.publisher !== "OpenAQ · aggregated air-quality observations" ||
        result.stations.some((station) => !Number.isFinite(station.latitude) ||
          !Number.isFinite(station.longitude) || !Number.isFinite(station.pm25?.value) ||
          typeof station.pm25?.observedAtUtc !== "string")) {
        throw new Error("The air-quality response did not contain valid station readings.");
      }
      state.airQualityStations = result.stations;
      state.airQualityCheckedAt = result.checkedAt;
      state.airQualityMetadata = result;
      return state.airQualityStations;
    })
    .catch((error) => {
      state.airQualityStations = [];
      state.airQualityError = error.message;
      return null;
    })
    .finally(() => {
      state.airQualityLoading = false;
      state.airQualityPromise = null;
      refreshMapStyles();
    });
  return state.airQualityPromise;
}

function pm25MarkerColor(value, stale) {
  if (stale) return "#87938d";
  if (value <= 5) return "#54beb4";
  if (value <= 15) return "#83b96b";
  if (value <= 25) return "#d3b65f";
  if (value <= 35) return "#d78e50";
  return "#cf625f";
}

function renderAirQualityStations() {
  if (!state.map) return;
  if (state.airQualityLayer) {
    state.map.removeLayer(state.airQualityLayer);
    state.airQualityLayer = null;
  }
  if (state.mapLayer !== "airQuality" || !state.airQualityStations.length) return;
  const group = L.featureGroup();
  state.airQualityStations.forEach((station) => {
    const ageHours = (Date.now() - Date.parse(station.pm25.observedAtUtc)) / 3600000;
    const stale = !Number.isFinite(ageHours) || ageHours > 48;
    const color = pm25MarkerColor(station.pm25.value, stale);
    const marker = L.circleMarker([station.latitude, station.longitude], {
      radius: 7,
      color: "#e8f3ef",
      weight: 1.5,
      opacity: 1,
      fillColor: color,
      fillOpacity: 0.95,
      bubblingMouseEvents: false,
      keyboard: true,
      title: `${station.name}: ${formatCensusNumber(station.pm25.value, 2)} µg/m³`
    });
    const popup = document.createElement("div");
    popup.className = "air-quality-station-popup";
    const heading = document.createElement("strong");
    heading.textContent = station.name;
    const measure = document.createElement("p");
    measure.textContent = `PM2.5: ${formatCensusNumber(station.pm25.value, 2)} µg/m³${stale ? " · older than 48 hours" : ""}`;
    const observed = document.createElement("p");
    observed.textContent = `Observed: ${station.pm25.observedAtLocal}`;
    const provider = document.createElement("p");
    provider.textContent = `Reporting provider: ${station.provider}`;
    const source = document.createElement("a");
    source.href = "https://openaq.org/";
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "OpenAQ source ↗";
    popup.append(heading, measure, observed, provider, source);
    marker.bindPopup(popup, { maxWidth: 280 });
    marker.addTo(group);
  });
  group.addTo(state.map);
  state.airQualityLayer = group;
}

async function activateAirQualityLayer() {
  state.mapLayer = "airQuality";
  closeMapPinnedDetail();
  refreshMapStyles();
  if (window.matchMedia("(max-width: 900px)").matches) setMobileLayerPickerOpen(false);
  void loadAirQualityData();
}

async function loadProvincialGdpData(year = state.economyMapYear) {
  if (state.provincialEconomyData?.year === year) return state.provincialEconomyData;
  if (state.economyLoadPromise && state.economyLoadYear === year) return state.economyLoadPromise;
  const requestId = ++state.economyMapRequestId;
  state.economyMapYear = year;
  state.provincialEconomyData = null;
  state.economyMapLoading = true;
  state.economyMapError = null;
  refreshMapStyles();
  state.economyLoadYear = year;
  state.economyLoadPromise = getJson(`/api/economy/provinces?year=${year}`)
    .then((result) => {
      const expectedProvinces = new Set([
        "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
        "Mpumalanga", "North West", "Northern Cape", "Western Cape"
      ]);
      const records = Array.isArray(result.records) ? result.records : [];
      const names = new Set(records.map((record) => record.province));
      const sourceValid = result.source?.publisher === "Statistics South Africa" &&
        result.source?.reportNumber === "P0441.2" &&
        result.source?.geographyLevel === "Province" &&
        result.source?.url?.startsWith("https://");
      if (result.year !== year || !sourceValid || records.length !== expectedProvinces.size ||
        names.size !== expectedProvinces.size ||
        [...expectedProvinces].some((province) => !names.has(province)) ||
        records.some((record) =>
          !Number.isFinite(record.gdpCurrentPricesRandMillions) ||
          !Number.isFinite(record.gdpContributionPercent) ||
          !Number.isFinite(record.realGdpGrowthPercent) ||
          !Array.isArray(record.industries) ||
          record.industries.some((industry) => !Number.isFinite(industry.gvaCurrentPricesRandMillions))
        )) {
        throw new Error("Stats SA provincial GDP-R data did not include complete, source-linked values for all nine provinces.");
      }
      if (requestId !== state.economyMapRequestId) return null;
      state.provincialEconomyData = result;
      state.economyMapError = null;
      return result;
    })
    .catch((error) => {
      if (requestId === state.economyMapRequestId) {
        state.economyMapError = error.message;
        state.provincialEconomyData = null;
      }
      return null;
    })
    .finally(() => {
      if (requestId === state.economyMapRequestId) {
        state.economyMapLoading = false;
        state.economyLoadPromise = null;
        state.economyLoadYear = null;
        refreshMapStyles();
        renderNationalMetrics();
        renderNationalHighlights();
      }
    });
  return state.economyLoadPromise;
}

function updateMapLayerSummary() {
  const summary = document.querySelector("#map-layer-summary");
  if (!summary) return;
  const descriptions = {
    boundaries: "Administrative outlines · geoBoundaries 2020. Shows geography only; no statistical value is shaded.",
    airQuality: "PM2.5 at South African monitoring stations · latest available OpenAQ observation per station. Station coverage is uneven; no marker does not mean clean air.",
    population: `Residents per square kilometre · Census ${state.censusMapYear}. Municipal source values; province and district values are derived from matched municipalities.`,
    growth: "Population change from Census 2011 to Census 2022. Parent-area values are derived from matched municipal totals, not annual growth.",
    unemployment: `Official Stats SA QLFS unemployment estimate · ${state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter}. Province-level only; not a district or municipal rate.`,
    economy: `Official Stats SA GDP-R · ${state.economyMapYear}. Shows each province’s share of national GDP; no district or municipal GDP-R values are published here.`,
    temperature: "Annual mean temperature · NASA POWER climatology at one representative point in each province. Province-level only; not a local forecast.",
    precipitation: "Mean daily precipitation · NASA POWER climatology at one representative point in each province. The rate is in mm/day, not annual totals.",
    electricity: `Households reporting electricity as their main lighting source · Census ${state.censusMapYear}. Municipal source percentages; larger-area values are approximate weighted aggregates.`,
    water: `Households reporting a water-scheme source · Census ${state.censusMapYear}. Municipal source counts; larger-area shares are derived aggregates.`
  };
  summary.textContent = descriptions[state.mapLayer] ?? "Select a map layer to see what it measures and how its values are reported.";
}

function updateMapLayerControls() {
  const censusAvailable = state.censusMapRecords.size === state.municipalities.length && state.municipalities.length > 0;
  const growthAvailable = censusAvailable && state.populationGrowthLayerAvailable;
  const unemploymentAvailable = state.labourMapRecords.size === 9;
  const provincialGdpAvailable = state.provincialEconomyData?.year === state.economyMapYear &&
    state.provincialEconomyData.records.length === 9;
  const temperatureAvailable = state.climateMapRecords.size === 9;
  const airQualityAvailable = state.airQualityStations.length > 0;
  const electricityAvailable = censusAvailable &&
    [...state.censusMapRecords.values()].every((record) => Number.isFinite(record.electricityLightingSharePercent));
  const yearSelect = document.querySelector("#map-census-year");
  if (yearSelect) yearSelect.value = String(state.censusMapYear);
  const censusControl = document.querySelector("#census-period-control");
  if (censusControl) censusControl.hidden = !["population", "water", "electricity"].includes(state.mapLayer);
  const labourControl = document.querySelector("#labour-period-control");
  if (labourControl) labourControl.hidden = state.mapLayer !== "unemployment";
  const labourSelect = document.querySelector("#labour-quarter");
  if (labourSelect && state.labourData) labourSelect.value = state.labourQuarter;
  const economyControl = document.querySelector("#economy-period-control");
  if (economyControl) economyControl.hidden = state.mapLayer !== "economy";
  const economySelect = document.querySelector("#economy-year");
  if (economySelect) economySelect.value = String(state.economyMapYear);
  document.querySelectorAll('input[name="map-layer"]').forEach((input) => {
    const thematic = input.value !== "boundaries";
    const airQualityLayer = input.value === "airQuality";
    const provinceOnly = ["unemployment", "economy", "temperature", "precipitation"].includes(input.value);
    const censusLayer = ["population", "growth", "water", "electricity"].includes(input.value);
    const supported = provinceOnly || censusLayer || airQualityLayer;
    const profileDataOnly = ["finance", "infrastructure"].includes(input.value);
    const available = input.value === "unemployment"
      ? unemploymentAvailable
      : airQualityLayer
        ? airQualityAvailable
      : input.value === "economy"
        ? provincialGdpAvailable
        : ["temperature", "precipitation"].includes(input.value)
          ? temperatureAvailable
        : input.value === "growth"
          ? growthAvailable
          : input.value === "electricity"
            ? electricityAvailable
            : censusLayer
              ? censusAvailable
              : false;
    const levelCompatible = !provinceOnly || state.boundaryLevel === "ADM1";
    const enabled = thematic && supported && available && levelCompatible;
    const loading = input.value === "unemployment"
      ? state.labourMapLoading
      : airQualityLayer
        ? state.airQualityLoading
      : input.value === "economy"
        ? state.economyMapLoading
          : ["temperature", "precipitation"].includes(input.value)
            ? state.climateMapLoading
        : state.censusMapLoading;
    const error = input.value === "unemployment"
      ? state.labourMapError
      : airQualityLayer
        ? state.airQualityError
      : input.value === "economy"
        ? state.economyMapError
          : ["temperature", "precipitation"].includes(input.value)
            ? state.climateMapError
        : state.censusMapError;
    input.checked = input.value === state.mapLayer;
    input.disabled = thematic && !enabled;
    const label = input.closest(".layer-option");
    label.title = !thematic
      ? "Official administrative boundary geometry"
      : !supported
        ? input.value === "finance"
          ? "Treasury finance facts load on demand; no complete, period-compatible municipal measure is loaded for map shading"
          : "No complete, period-compatible municipal infrastructure indicator is currently loaded"
        : !available
          ? error
            ? `Verified source data unavailable: ${error}`
            : loading
              ? "Loading verified source data"
              : airQualityLayer
                ? "Load latest OpenAQ PM2.5 station readings; add OPENAQ_API_KEY to Render if the source is not configured"
              : ["temperature", "precipitation"].includes(input.value)
                ? "Load NASA POWER normals by selecting this layer and switching the map to Provinces"
              : "Verified source data is unavailable"
          : !levelCompatible
            ? input.value === "unemployment"
              ? "Statistics South Africa QLFS estimates are available at province level only; choose Provinces"
              : input.value === "economy"
                ? "Statistics South Africa GDP-R values are available at province level only; choose Provinces"
                : "NASA POWER climate normals are shown at province level only; choose Provinces"
              : airQualityLayer
                ? "Latest PM2.5 observations by monitoring station; source timestamps shown per station"
              : provinceOnly
              ? input.value === "unemployment"
                ? `Statistics South Africa QLFS ${state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter} provincial data`
                : input.value === "economy"
                  ? `Statistics South Africa GDP-R ${state.economyMapYear} provincial GDP contribution`
                  : input.value === "temperature"
                    ? "NASA POWER annual mean temperature · provincial representative points"
                    : "NASA POWER mean daily precipitation · provincial representative points"
              : input.value === "electricity"
                ? `Stats SA Census ${state.censusMapYear} household share reporting electricity as the main lighting source; larger areas are household-weighted municipal aggregates, not connection status or reliability`
                : input.value === "growth"
                  ? "Statistics South Africa Census population change, 2011–2022; larger areas use summed municipal population totals"
                  : `Statistics South Africa Census ${state.censusMapYear} municipal data; district and province values aggregate matched municipalities`;
    label.classList.toggle("unavailable", thematic && !enabled);
    label.classList.toggle("selected", input.value === state.mapLayer);
    const status = label.querySelector(".layer-state");
    if (thematic && profileDataOnly) status.textContent = "NO MAP DATA";
    else if (thematic && !supported) status.textContent = "NO DATA";
    else if (thematic && !available && loading) status.textContent = "LOADING";
    else if (thematic && !available) status.textContent = airQualityLayer
      ? state.airQualityLoading ? "LOADING" : state.airQualityError ? "NEEDS SETUP" : "LOAD STATIONS"
      : ["temperature", "precipitation"].includes(input.value) && !state.climateMapError ? "LOAD IN PROVINCES" : "NO DATA";
    else if (thematic && !levelCompatible) status.textContent = "PROVINCE ONLY";
    else if (thematic && input.value === "unemployment") status.textContent = state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter;
    else if (thematic && input.value === "economy") status.textContent = String(state.economyMapYear);
    else if (thematic && airQualityLayer) status.textContent = `${state.airQualityStations.length} STATIONS`;
    else if (thematic && ["temperature", "precipitation"].includes(input.value)) status.textContent = "NASA POWER";
    else if (thematic && censusLayer) status.textContent = state.boundaryLevel === "ADM3" ? String(state.censusMapYear) : `${state.censusMapYear} · DERIVED`;
    else status.textContent = input.value === state.mapLayer ? "ACTIVE" : "";
  });
  let ready = 0;
  let loadingCount = 0;
  let provinceOnlyCount = 0;
  let unavailable = 3;
  for (const [isAvailable, isLoading] of [
    [unemploymentAvailable, state.labourMapLoading],
    [provincialGdpAvailable, state.economyMapLoading],
    [temperatureAvailable, state.climateMapLoading]
  ]) {
    if (isLoading) loadingCount += 1;
    else if (isAvailable && state.boundaryLevel === "ADM1") ready += 1;
    else if (isAvailable) provinceOnlyCount += 1;
    else unavailable += 1;
  }
  const availability = document.querySelector("#map-more-availability");
  if (availability) {
    const summary = [];
    if (ready) summary.push(`${ready} ready`);
    if (loadingCount) summary.push(`${loadingCount} loading`);
    if (provinceOnlyCount) summary.push(`${provinceOnlyCount} province-only`);
    if (unavailable) summary.push(`${unavailable} unavailable`);
    availability.textContent = summary.join(" · ");
  }
  updateMapLayerSummary();
}

function refreshMapStyles() {
  state.boundaryLayer?.setStyle(styleForFeature);
  renderAirQualityStations();
  ensureNoDataMapPattern();
  refreshSelectionLayer();
  renderMapLegend();
  updateMapLayerControls();
  updateMapRegionAccessibility();
  if (state.mapDataTableOpen) renderMapDataTable();
}

function showMapLayerGuidance(layer) {
  const help = document.querySelector("#map-layer-help");
  if (!help) return;
  help.textContent = layer === "finance"
    ? "Municipal finance and audit records load in municipality profiles. Select a municipality, then open its profile; a complete compatible national finance measure is not available for map shading."
    : "A complete, period-compatible infrastructure indicator is not available for map shading. Use Projects for named project records, or Service delivery for Census household-access measures.";
  help.hidden = false;
  setMobileLayerPickerOpen(true);
}

function setMobileLayerPickerOpen(open) {
  const control = document.querySelector("#layer-control");
  const toggle = document.querySelector("#mobile-layer-toggle");
  if (!control || !toggle) return;
  const compactViewport = window.matchMedia("(max-width: 900px)").matches;
  control.classList.toggle("mobile-layer-open", compactViewport && open);
  control.classList.toggle("layer-control-collapsed", !compactViewport && !open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? (compactViewport ? "Done" : "Hide") : "Change";
  if (!open) document.querySelector("#map-layer-help").hidden = true;
}

async function activateProvinceMapLayer(layer) {
  const help = document.querySelector("#map-layer-help");
  if (help) help.hidden = true;
  state.autoBoundaryDetail = false;
  document.querySelector("#auto-boundary-detail").checked = false;
  const boundarySelect = document.querySelector("#boundary-level");
  if (state.boundaryLevel !== "ADM1") {
    boundarySelect.value = "ADM1";
    try {
      await changeBoundaryLevel("ADM1");
    } catch (error) {
      showToast(`Could not switch to province boundaries: ${error.message}`);
      return;
    }
  }
  state.mapLayer = layer;
  if (layer === "unemployment") void loadProvincialLabourData();
  else if (layer === "economy") void loadProvincialGdpData(state.economyMapYear);
  else void loadProvincialTemperatureData();
  refreshMapStyles();
  if (help) {
    help.hidden = true;
  }
  if (window.matchMedia("(max-width: 900px)").matches) setMobileLayerPickerOpen(false);
  showToast(layer === "unemployment"
    ? "Province boundaries selected. Showing the province-only unemployment layer."
    : layer === "economy"
      ? `Province boundaries selected. Showing province GDP-R for ${state.economyMapYear}.`
      : layer === "temperature"
        ? "Province boundaries selected. Loading NASA POWER annual temperature normals."
        : "Province boundaries selected. Loading NASA POWER precipitation normals.");
}

async function loadCensusMapData(year) {
  const requestId = ++state.censusMapRequestId;
  state.censusMapYear = year;
  state.censusMapRecords = new Map();
  state.censusMapError = null;
  state.censusMapLoading = true;
  refreshMapStyles();
  try {
    const result = await getJson(`/api/census/municipalities?year=${year}`);
    if (requestId !== state.censusMapRequestId) return;
    if (result.year !== year || result.total !== state.municipalities.length ||
      !Array.isArray(result.records) || result.records.length !== state.municipalities.length ||
      result.electricitySource?.publisher !== "Statistics South Africa" ||
      typeof result.electricitySource?.url !== "string" ||
      !result.electricitySource.url.startsWith("https://") ||
      result.records.some((record) =>
        !Number.isFinite(record.electricityLightingSharePercent) ||
        record.electricityLightingSharePercent < 0 ||
        record.electricityLightingSharePercent > 100
      )) {
      throw new Error(`expected ${state.municipalities.length} municipality records for ${year}; received ${result.total ?? "an invalid response"}`);
    }
    const records = new Map(result.records.map((record) => [record.id, record]));
    if (records.size !== state.municipalities.length ||
      state.municipalities.some((municipality) => !records.has(municipality.id))) {
      throw new Error(`Census ${year} data did not match every municipal boundary.`);
    }
    state.censusMapRecords = records;
    state.censusMapAggregates.clear();
    state.populationGrowthLayerAvailable = [...records.values()].every((record) =>
      Number.isFinite(record.population2011) && record.population2011 > 0 &&
      Number.isFinite(record.population2022) && record.population2022 >= 0
    );
    state.censusMapError = null;
    state.censusMapLoading = false;
    refreshMapStyles();
    renderNationalMetrics();
    renderNationalHighlights();
    if (!state.selected) updateNationalProfileSummary();
    else if (state.selected.level === "ADM2") void updateProfileSummary(state.selected);
    if (state.tab === "overview" && !state.selected) renderDetail();
    if (state.view === "municipalities") renderAlternateView();
  } catch (error) {
    if (requestId !== state.censusMapRequestId) return;
    state.censusMapError = error.message;
    state.censusMapLoading = false;
    state.populationGrowthLayerAvailable = false;
    if (["population", "growth", "water", "electricity"].includes(state.mapLayer)) state.mapLayer = "boundaries";
    refreshMapStyles();
    renderNationalMetrics();
    renderNationalHighlights();
    if (!state.selected) updateNationalProfileSummary();
    else if (state.selected.level === "ADM2") void updateProfileSummary(state.selected);
    if (state.tab === "overview" && !state.selected) renderDetail();
    if (state.view === "municipalities") renderAlternateView();
  }
}

function orderedMapLayers() {
  return state.boundaryLayer?.getLayers()
    .filter((layer) => layer.feature?.properties?.shapeID)
    .sort((left, right) => left.feature.properties.shapeName.localeCompare(right.feature.properties.shapeName)) ?? [];
}

function updateMapRegionAccessibility() {
  const layers = orderedMapLayers();
  if (!layers.length) return;
  const activeIdExists = layers.some((layer) => layer.feature.properties.shapeID === state.mapRovingId);
  if (!activeIdExists) {
    const selected = layers.find((layer) => layer.feature.properties.shapeID === state.selected?.id);
    state.mapRovingId = selected?.feature.properties.shapeID ?? layers[0].feature.properties.shapeID;
  }
  layers.forEach((layer) => {
    const feature = layer.feature;
    const properties = feature.properties;
    const path = layer.getElement();
    if (!path) return;
    path.setAttribute("role", "button");
    path.setAttribute("focusable", "true");
    path.setAttribute("tabindex", properties.shapeID === state.mapRovingId ? "0" : "-1");
    path.classList.toggle("map-region-selected", properties.shapeID === state.selected?.id);
    const details = mapTooltipData(feature);
    const action = state.comparisonMode
      ? state.comparisonSelections.includes(properties.shapeID)
        ? "Press Enter or Space to remove this area from comparison."
        : "Press Enter or Space to add this area to comparison."
      : "Click once or press Enter or Space to select this area. Double-click to zoom in.";
    path.setAttribute("aria-label", `${details.place}. ${details.indicator}: ${details.value}. Period: ${details.period}. Source: ${details.source}.${details.note ? ` ${details.note}` : ""} ${action} Use arrow keys to move by area name; Home and End jump to the first and last area.`);
    if (state.comparisonMode) {
      path.setAttribute("aria-pressed", String(state.comparisonSelections.includes(properties.shapeID)));
      path.removeAttribute("aria-current");
    } else {
      path.removeAttribute("aria-pressed");
      if (properties.shapeID === state.selected?.id) path.setAttribute("aria-current", "true");
      else path.removeAttribute("aria-current");
    }
    if (path.dataset.keyboardNavigationReady) return;
    path.dataset.keyboardNavigationReady = "true";
    path.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.detail > 1) return;
      activateMapRegion(feature, { focus: false });
    });
    path.addEventListener("keydown", (event) => handleMapRegionKeydown(layer, event));
    path.addEventListener("focus", () => {
      state.mapRovingId = properties.shapeID;
      updateMapRegionAccessibility();
      layer.setTooltipContent(mapTooltip(feature));
      layer.openTooltip();
      layer.bringToFront();
    });
    path.addEventListener("blur", () => layer.closeTooltip());
  });
}

function activateMapRegion(feature, { focus = true } = {}) {
  if (state.comparisonMode) {
    if (feature.properties.shapeType !== "ADM3") {
      showToast("Map comparison currently supports municipalities only. Switch to Municipalities to select places.");
      return;
    }
    toggleMapComparison(feature.properties.shapeID);
    return;
  }
  pinMapIndicatorDetail(feature);
  const item = state.geographies.find((geography) => geography.id === feature.properties.shapeID);
  if (item) void selectGeography(item, { focus });
}

function handleMapRegionKeydown(layer, event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateMapRegion(layer.feature);
    return;
  }
  const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const layers = orderedMapLayers();
  const currentIndex = layers.findIndex((item) => item.feature.properties.shapeID === layer.feature.properties.shapeID);
  let nextIndex = null;
  if (event.key in directions) nextIndex = (currentIndex + directions[event.key] + layers.length) % layers.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = layers.length - 1;
  if (nextIndex === null || !layers[nextIndex]) return;
  event.preventDefault();
  state.mapRovingId = layers[nextIndex].feature.properties.shapeID;
  updateMapRegionAccessibility();
  layers[nextIndex].getElement()?.focus();
}

function setMapLayer(collection, { fitBounds = true } = {}) {
  document.querySelector("#map-hover-compare").hidden = true;
  state.hoveredMapGeographyId = null;
  if (state.boundaryLayer) state.map.removeLayer(state.boundaryLayer);
  state.boundaryLayer = L.geoJSON(collection, {
    style: styleForFeature,
    onEachFeature: (feature, layer) => {
      if (state.mapHoverPreviews) layer.bindTooltip(mapTooltip(feature, { compact: !state.mapDetailMode }), { sticky: true, direction: "top" });
      layer.on({
        mouseover: (event) => {
          if (state.mapHoverPreviews) {
            layer.setTooltipContent(mapTooltip(feature, { compact: !state.mapDetailMode }));
            showMapHoverComparison(feature, event);
          }
          if (feature.properties.shapeID !== state.selected?.id && !isComparisonSelection(feature)) {
            layer.setStyle({
              ...mapStyle(feature),
              color: "#b7c5bc",
              weight: 1.25,
              fillOpacity: state.mapLayer === "boundaries" ? 0.42 : 0.86
            });
          }
        },
        mouseout: () => {
          layer.setStyle(styleForFeature(feature));
        }
      });
    }
  }).addTo(state.map);
  ensureNoDataMapPattern();
  document.querySelector("#boundary-count").textContent =
    `${collection.features.length} ${state.boundaryLevel === "ADM1" ? "provinces" : state.boundaryLevel === "ADM2" ? "districts & metros" : "municipal boundaries"}`;
  updateMapLayerControls();
  updateMapZoomPath();
  renderMapLegend();
  updateMapRegionAccessibility();
  if (state.mapDataTableOpen) renderMapDataTable();
  const bounds = state.boundaryLayer.getBounds();
  if (state.boundaryLevel === "ADM3" && bounds.isValid()) state.nationalBounds = bounds;
  if (fitBounds && bounds.isValid()) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
  refreshSelectionLayer();
}

async function ensureBoundaryCollection(level) {
  if (!state.collections.has(level)) {
    const collection = await getJson(`/api/geo/${level}`);
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) ||
      collection.features.some((feature) =>
        !feature.properties?.shapeID || feature.properties.shapeType !== level
      )) {
      throw new Error(`The ${level} boundary response is invalid or missing unique feature IDs.`);
    }
    state.collections.set(level, collection);
  }
  return state.collections.get(level);
}

async function changeBoundaryLevel(level, { preserveView = false } = {}) {
  const collection = await ensureBoundaryCollection(level);
  state.boundaryLevel = level;
  const provinceLayer = ["unemployment", "economy", "temperature", "precipitation"].includes(state.mapLayer);
  if (level !== "ADM1" && provinceLayer) state.mapLayer = "boundaries";
  if (level === "ADM1") {
    void loadProvincialGdpData(state.economyMapYear);
    void loadProvincialLabourData();
  }
  setMapLayer(collection, { fitBounds: !preserveView });
}

function boundaryLevelForZoom() {
  if (["unemployment", "economy", "temperature", "precipitation"].includes(state.mapLayer)) return "ADM1";
  const zoom = state.map?.getZoom() ?? 5;
  if (zoom < 5.8) return "ADM1";
  if (zoom < 7.4) return "ADM2";
  return "ADM3";
}

function syncBoundaryLevelToZoom() {
  if (!state.autoBoundaryDetail || !state.autoBoundaryReady || !state.map) return;
  const target = boundaryLevelForZoom();
  if (target === state.boundaryLevel || state.autoBoundaryRequest) return;
  state.autoBoundaryRequest = changeBoundaryLevel(target, { preserveView: true })
    .then(() => {
      if (state.autoBoundaryDetail) {
        document.querySelector("#boundary-level").value = state.boundaryLevel;
      }
    })
    .catch(() => {
      state.autoBoundaryDetail = false;
      document.querySelector("#auto-boundary-detail").checked = false;
      showToast("Automatic boundary detail could not load. Choose a boundary level manually.");
    })
    .finally(() => {
      state.autoBoundaryRequest = null;
      if (state.autoBoundaryDetail && boundaryLevelForZoom() !== state.boundaryLevel) {
        requestAnimationFrame(syncBoundaryLevelToZoom);
      }
    });
}

async function selectGeography(item, { focus = true } = {}) {
  if (!item?.id || !["ADM1", "ADM2", "ADM3"].includes(item.level)) {
    showToast("This search result does not have a supported geographic boundary.");
    return;
  }
  let selected = state.geographies.find((geography) => geography.id === item.id) ?? item;
  try {
    const collection = await ensureBoundaryCollection(selected.level);
    const feature = collection.features.find((candidate) =>
      candidate.properties.shapeID === selected.id
    );
    if (!feature) throw new Error("The selected geographic ID is not in its boundary layer.");
    if (selected.areaKm2 == null) {
      selected = {
        ...selected,
        areaKm2: geometryAreaKm2(feature.geometry),
        areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon."
      };
    }
    if (state.boundaryLevel !== selected.level) {
      document.querySelector("#boundary-level").value = selected.level;
      await changeBoundaryLevel(selected.level);
    }
    updateProfile(selected);
    document.querySelector("#map-location").textContent =
      `SELECTED · ${formatBoundaryLevel(selected.level).toUpperCase()} · ${selected.name.toLocaleUpperCase()}`;
    if (state.view !== "dashboard") setView("dashboard");
    if (focus && state.map) {
      const bounds = L.geoJSON(feature).getBounds();
      if (bounds.isValid()) {
        const maxZoom = selected.level === "ADM1" ? 6 : selected.level === "ADM2" ? 7 : 9;
        state.map.flyToBounds(bounds, { padding: [35, 35], maxZoom, duration: 0.6 });
      }
    }
  } catch (error) {
    showToast(`Could not open ${selected.name}: ${error.message}`);
    return;
  }
  if (state.view !== "dashboard") setView("dashboard");
  document.querySelector("#mobile-scrim").hidden = true;
  document.body.classList.remove("mobile-nav-open");
  setMobileProfileOpen(window.matchMedia("(max-width: 640px)").matches);
  closeSearchResults();
}

function setMobileProfileOpen(open) {
  const toggle = document.querySelector("#mobile-profile-toggle");
  document.body.classList.toggle("mobile-profile-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Hide municipality information" : "Show municipality information");
  toggle.title = open ? "Hide municipality information" : "Municipality information";
}

async function selectMunicipality(item) {
  return selectGeography(item);
}

function renderMapComparisonSelection() {
  const panel = document.querySelector("#map-compare-panel");
  const toggle = document.querySelector("#compare-map-toggle");
  const status = document.querySelector("#map-compare-status");
  const list = document.querySelector("#map-compare-list");
  const compareButton = document.querySelector("#compare-map-action");
  if (!panel || !toggle || !status || !list || !compareButton) return;
  panel.hidden = !state.comparisonMode && state.comparisonSelections.length === 0;
  toggle.setAttribute("aria-pressed", String(state.comparisonMode));
  toggle.textContent = state.comparisonMode ? "Done selecting" : "Select to compare";
  status.textContent = state.comparisonMode
    ? `Select up to three municipalities (${state.comparisonSelections.length}/3 selected).`
    : state.comparisonSelections.length
      ? `${state.comparisonSelections.length} municipality${state.comparisonSelections.length === 1 ? "" : "ies"} selected.`
      : "Select two or three municipalities on the map.";
  list.replaceChildren();
  state.comparisonSelections.forEach((id) => {
    const item = state.geographies.find((geography) => geography.id === id);
    if (!item) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "map-compare-chip";
    chip.dataset.removeComparisonId = id;
    chip.setAttribute("aria-label", `Remove ${item.name} from comparison`);
    chip.textContent = `${item.name} ×`;
    list.append(chip);
  });
  compareButton.disabled = state.comparisonSelections.length < 2;
  const keyboardHint = document.querySelector("#map-keyboard-hint");
  if (keyboardHint) keyboardHint.textContent = state.comparisonMode
    ? "Keyboard: Tab to an area · arrows move by name · Enter or Space adds or removes it from comparison."
    : "Keyboard: Tab to an area · arrows move by name · Enter or Space opens it.";
  updateMapRegionAccessibility();
}

function toggleMapComparison(id) {
  const index = state.comparisonSelections.indexOf(id);
  if (index >= 0) {
    state.comparisonSelections.splice(index, 1);
  } else if (state.comparisonSelections.length >= 3) {
    showToast("Map comparison supports up to three municipalities.");
    return;
  } else {
    state.comparisonSelections.push(id);
  }
  refreshMapStyles();
  renderMapComparisonSelection();
}

function openComparisonWithMunicipality(id) {
  const municipality = state.municipalities.find((item) => item.id === id);
  if (!municipality) {
    showToast("This place is not available in the municipality comparison directory.");
    return;
  }
  state.comparisonMode = false;
  state.comparisonSelections = [id];
  state.comparisonReferenceId = id;
  setView("comparisons");
  renderMapComparisonSelection();
}

function resetMapToNational() {
  state.overviewLevel = "national";
  syncOverviewLevelSwitcher();
  closeMapPinnedDetail();
  if (state.view !== "dashboard") setView("dashboard");
  state.autoBoundaryDetail = true;
  document.querySelector("#auto-boundary-detail").checked = true;
  searchInput.value = "";
  renderSearchResults("");
  state.comparisonMode = false;
  state.comparisonSelections = [];
  state.comparisonReferenceId = null;
  renderMapComparisonSelection();
  if (state.boundaryLevel !== "ADM3") {
    document.querySelector("#boundary-level").value = "ADM3";
    void changeBoundaryLevel("ADM3").then(() => {
      clearGeographySelection();
      if (state.map && state.nationalBounds?.isValid()) {
        state.map.fitBounds(state.nationalBounds, { padding: [30, 30], maxZoom: 6 });
      }
    }).catch((error) => showToast(`Could not reset the map: ${error.message}`));
    return;
  }
  clearGeographySelection();
  if (state.map && state.nationalBounds?.isValid()) {
    state.map.fitBounds(state.nationalBounds, { padding: [30, 30], maxZoom: 6 });
  }
}

function renderNationalHighlights() {
  const grid = document.querySelector("#focus-grid");
  if (!grid) return;
  const unemploymentRecords = [...state.labourMapRecords.values()];
  const censusRecords = [];
  if (state.censusMapRecords.size === state.municipalities.length && state.municipalities.length > 0) {
    const byProvince = new Map();
    state.municipalities.forEach((municipality) => {
      const record = state.censusMapRecords.get(municipality.id);
      if (!record || !Number.isFinite(record.households) || record.households <= 0 ||
        !Number.isFinite(record.waterSchemeHouseholds) ||
        !Number.isFinite(record.electricityLightingSharePercent)) return;
      const group = byProvince.get(municipality.provinceId) ?? {
        province: municipality.province,
        households: 0,
        waterSchemeHouseholds: 0,
        electricityLightingHouseholds: 0
      };
      group.households += record.households;
      group.waterSchemeHouseholds += record.waterSchemeHouseholds;
      group.electricityLightingHouseholds += record.electricityLightingSharePercent * record.households / 100;
      byProvince.set(municipality.provinceId, group);
    });
    for (const group of byProvince.values()) {
      if (group.households <= 0) continue;
      censusRecords.push({
        province: group.province,
        waterSchemeSharePercent: group.waterSchemeHouseholds / group.households * 100,
        electricityLightingSharePercent: group.electricityLightingHouseholds / group.households * 100
      });
    }
    const expectedProvinceCount = state.geographies.filter((geography) => geography.level === "ADM1").length;
    if (!expectedProvinceCount || censusRecords.length !== expectedProvinceCount) censusRecords.length = 0;
  }
  const highlights = [
    {
      label: "Highest official unemployment",
      record: unemploymentRecords.length ? [...unemploymentRecords].sort((a, b) => b.officialRate - a.officialRate)[0] : null,
      value: (record) => `${formatCensusNumber(record.officialRate, 1)}%`,
      note: state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? "Stats SA QLFS · loading"
    },
    {
      label: "Highest water-scheme access",
      record: censusRecords.length ? [...censusRecords].sort((a, b) => b.waterSchemeSharePercent - a.waterSchemeSharePercent)[0] : null,
      value: (record) => `${formatCensusNumber(record.waterSchemeSharePercent, 1)}% of households`,
      note: `Stats SA Census ${state.censusMapYear} · municipal household reports`
    },
    {
      label: "Highest share using electricity as main lighting",
      record: censusRecords.length ? [...censusRecords].sort((a, b) => b.electricityLightingSharePercent - a.electricityLightingSharePercent)[0] : null,
      value: (record) => `${formatCensusNumber(record.electricityLightingSharePercent, 1)}% of households`,
      note: `Stats SA Census ${state.censusMapYear} · municipal household reports`
    }
  ];
  grid.innerHTML = highlights.map((highlight) => {
    const record = highlight.record;
    const name = record?.province ?? (highlight.label === "Highest official unemployment"
      ? state.labourMapLoading ? "Loading…" : "Unavailable"
      : state.censusMapLoading ? "Loading…" : "Unavailable");
    return `<button class="focus-card" type="button" data-highlight-province="${escapeHtml(record?.province ?? "")}" ${record ? "" : "disabled"}>
      <span class="ops-label">${escapeHtml(highlight.label)}</span>
      <h3>${escapeHtml(name)}</h3>
      <p>${record ? escapeHtml(highlight.value(record)) : "No verified provincial value is available."}</p>
      <span class="focus-meta"><span class="focus-status">${escapeHtml(highlight.note)}</span><span>${record ? "View on map ↗" : ""}</span></span>
    </button>`;
  }).join("");
  grid.querySelectorAll("[data-highlight-province]").forEach((button) => {
    button.addEventListener("click", () => {
      const province = state.geographies.find((item) =>
        item.level === "ADM1" && item.name === button.dataset.highlightProvince
      );
      if (province) void selectGeography(province);
    });
  });
}

function renderNationalMetrics() {
  const container = document.querySelector("#national-metrics");
  if (!container) return;
  const censusLoaded = state.municipalities.length > 0 &&
    state.censusMapRecords.size === state.municipalities.length;
  const nationalPopulation = censusLoaded
    ? [...state.censusMapRecords.values()].reduce((total, record) => total + record.population, 0)
    : null;
  const gdpDataset = state.provincialEconomyData;
  const usdGdp = state.nationalEconomyData?.indicators?.find((indicator) => indicator.key === "gdpCurrentUsd");
  const latestUsdGdp = usdGdp?.values?.at(-1);
  const metrics = [
    {
      label: "Nominal GDP",
      period: gdpDataset?.year ?? "Year pending",
      value: gdpDataset?.national?.gdpCurrentPricesRandMillions != null
        ? `R${formatCensusNumber(gdpDataset.national.gdpCurrentPricesRandMillions / 1000, 1)} bn`
        : state.economyMapLoading ? "Loading…" : "Unavailable",
      note: "Current prices · Stats SA GDP-R"
    },
    {
      label: "Real GDP growth",
      period: gdpDataset?.year ?? "Year pending",
      value: Number.isFinite(gdpDataset?.national?.realGdpGrowthPercent)
        ? `${formatCensusNumber(gdpDataset.national.realGdpGrowthPercent, 1)}%`
        : state.economyMapLoading ? "Loading…" : "Unavailable",
      note: "Inflation-adjusted · Stats SA GDP-R"
    },
    {
      label: "GDP · current US$",
      period: latestUsdGdp?.year ?? "Year pending",
      value: Number.isFinite(latestUsdGdp?.value)
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(latestUsdGdp.value)
        : state.nationalEconomyLoading ? "Loading…" : "Unavailable",
      note: "Nominal · World Bank WDI"
    },
    {
      label: "Population",
      period: 2022,
      value: Number.isFinite(nationalPopulation) ? formatCensusNumber(nationalPopulation) : "Loading…",
      note: censusLoaded ? "Stats SA · sum of 213 municipal Census records" : "Statistics South Africa · Census"
    }
  ];
  container.innerHTML = metrics.map((metric) => `
    <article class="summary-card">
      <div class="summary-card-heading"><span class="label">${escapeHtml(metric.label)}</span><span class="summary-period">${escapeHtml(metric.period)}</span></div>
      <strong>${escapeHtml(metric.value)}</strong>
      <span class="summary-source">${escapeHtml(metric.note)}</span>
    </article>
  `).join("");
}

function renderNationalGdpHistory() {
  const container = document.querySelector("#national-trends");
  if (!container) return;
  container.replaceChildren();
  const records = state.nationalGdpHistory;
  if (!records?.length) {
    const message = document.createElement("p");
    message.className = "national-trend-state";
    message.textContent = state.nationalGdpHistoryLoading
      ? "Loading Stats SA national GDP history…"
      : state.nationalGdpHistoryError
        ? "National GDP history is temporarily unavailable."
        : "Stats SA national GDP history will appear here.";
    container.append(message);
    return;
  }

  const charts = [
    {
      title: "Nominal GDP",
      subtitle: "Current prices · R billion · not adjusted for inflation",
      explanation: "A rise can reflect higher prices as well as more production, so this is not inflation-adjusted growth.",
      key: "gdpCurrentPricesRandBillions",
      color: "#58c8c1",
      format: (value) => `R${formatCensusNumber(value, 1)} bn`
    },
    {
      title: "Real GDP growth",
      subtitle: "Annual change · inflation-adjusted · percent",
      explanation: "Shows year-over-year output change after adjusting for prices; a value below 0% means output contracted.",
      key: "realGdpGrowthPercent",
      color: "#a8bf77",
      format: (value) => `${formatCensusNumber(value, 1)}%`
    }
  ];
  charts.forEach((chartSpec) => {
    const chartRecords = records.map((record) => ({
      year: record.year,
      value: record[chartSpec.key]
    }));
    const article = document.createElement("article");
    article.className = "national-trend-card";
    const heading = document.createElement("div");
    heading.className = "national-trend-card-heading";
    const title = document.createElement("h3");
    title.textContent = chartSpec.title;
    const range = document.createElement("span");
    range.className = "summary-period";
    range.textContent = `${chartRecords[0].year}–${chartRecords.at(-1).year}`;
    heading.append(title, range);
    const subtitle = document.createElement("p");
    subtitle.textContent = chartSpec.subtitle;
    const explanation = document.createElement("p");
    explanation.className = "national-trend-context";
    explanation.textContent = chartSpec.explanation;
    const source = document.createElement("p");
    source.className = "national-trend-source";
    source.textContent = "Source: Statistics South Africa · GDP-R P0441.2";

    const minimum = Math.min(...chartRecords.map((record) => record.value));
    const maximum = Math.max(...chartRecords.map((record) => record.value));
    const span = maximum - minimum || 1;
    const points = chartRecords.map((record, index) => ({
      ...record,
      x: 8 + index * 304 / Math.max(1, chartRecords.length - 1),
      y: 8 + (maximum - record.value) / span * 64
    }));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 320 94");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${chartSpec.title}, ${points.map((point) => `${point.year}: ${chartSpec.format(point.value)}`).join("; ")}`);
    const baseline = document.createElementNS(svg.namespaceURI, "line");
    baseline.setAttribute("x1", "8");
    baseline.setAttribute("x2", "312");
    baseline.setAttribute("y1", "78");
    baseline.setAttribute("y2", "78");
    baseline.setAttribute("class", "national-trend-baseline");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", chartSpec.color);
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    const firstPoint = document.createElementNS(svg.namespaceURI, "circle");
    firstPoint.setAttribute("cx", points[0].x.toFixed(1));
    firstPoint.setAttribute("cy", points[0].y.toFixed(1));
    firstPoint.setAttribute("r", "3");
    firstPoint.setAttribute("fill", chartSpec.color);
    const lastPoint = document.createElementNS(svg.namespaceURI, "circle");
    lastPoint.setAttribute("cx", points.at(-1).x.toFixed(1));
    lastPoint.setAttribute("cy", points.at(-1).y.toFixed(1));
    lastPoint.setAttribute("r", "3.5");
    lastPoint.setAttribute("fill", chartSpec.color);
    svg.append(baseline, path, firstPoint, lastPoint);

    const footer = document.createElement("div");
    footer.className = "national-trend-footer";
    const first = document.createElement("span");
    first.textContent = `${points[0].year} · ${chartSpec.format(points[0].value)}`;
    const last = document.createElement("strong");
    last.textContent = `${points.at(-1).year} · ${chartSpec.format(points.at(-1).value)}`;
    footer.append(first, last);
    article.append(heading, subtitle, explanation, source, svg, footer);
    container.append(article);
  });
}

async function loadNationalGdpHistory() {
  if (state.nationalGdpHistory || state.nationalGdpHistoryLoading) return;
  state.nationalGdpHistoryLoading = true;
  state.nationalGdpHistoryError = null;
  renderNationalGdpHistory();
  try {
    const current = state.provincialEconomyData ?? await loadProvincialGdpData(state.economyMapYear);
    const years = current?.availableYears;
    if (!Array.isArray(years) || years.length < 2) {
      throw new Error("Stats SA national GDP history years are unavailable.");
    }
    const datasets = await Promise.all(years.map((year) => getJson(`/api/economy/provinces?year=${year}`)));
    const records = datasets.map((dataset) => ({
      year: dataset.year,
      gdpCurrentPricesRandBillions: dataset.national?.gdpCurrentPricesRandMillions / 1000,
      realGdpGrowthPercent: dataset.national?.realGdpGrowthPercent
    }));
    const sourceValid = datasets.every((dataset, index) =>
      dataset.year === years[index] &&
      dataset.source?.publisher === "Statistics South Africa" &&
      dataset.source?.reportNumber === "P0441.2" &&
      dataset.source?.geographyLevel === "Province" &&
      dataset.source?.url?.startsWith("https://") &&
      Number.isFinite(dataset.national?.gdpCurrentPricesRandMillions) &&
      Number.isFinite(dataset.national?.realGdpGrowthPercent)
    );
    if (!sourceValid) throw new Error("Stats SA GDP-R history was incomplete or failed source validation.");
    state.nationalGdpHistory = records;
  } catch (error) {
    state.nationalGdpHistoryError = error.message;
  } finally {
    state.nationalGdpHistoryLoading = false;
    renderNationalGdpHistory();
  }
}

function loadNationalDashboardEconomy() {
  if (state.nationalEconomyData || state.nationalEconomyLoading) return;
  state.nationalEconomyLoading = true;
  state.nationalEconomyError = null;
  renderNationalMetrics();
  void getJson("/api/economy/national").then((result) => {
    const gdp = result.indicators?.find((indicator) => indicator.key === "gdpCurrentUsd");
    if (result.geographyLevel !== "National" || result.country !== "South Africa" ||
      result.source?.publisher !== "World Bank" || !Array.isArray(gdp?.values)) {
      throw new Error("The national GDP series did not include valid World Bank source metadata.");
    }
    state.nationalEconomyData = result;
  }).catch((error) => {
    state.nationalEconomyError = error.message;
  }).finally(() => {
    state.nationalEconomyLoading = false;
    renderNationalMetrics();
  });
}

function renderMunicipalityTable() {
  const rows = state.municipalities.map((item) => {
    const hasCensus = state.censusMapRecords.has(item.id);
    const status = hasCensus
      ? `CENSUS ${state.censusMapYear} LOADED`
      : state.censusMapLoading
        ? "CENSUS LOADING"
        : state.censusMapError
          ? "CENSUS UNAVAILABLE"
          : "NO CENSUS RECORD";
    const statusClass = hasCensus ? "loaded" : state.censusMapError ? "unavailable" : "";
    return `
    <tr>
      <td><button data-select-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button></td>
      <td>${escapeHtml(item.province || "—")}</td>
      <td>${escapeHtml(item.district || "—")}</td>
      <td class="mono">${escapeHtml(item.level)}</td>
      <td class="mono">${escapeHtml(formatArea(item.areaKm2))}</td>
      <td><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td>
    </tr>`;
  }).join("");
  return `<div class="data-table-wrap"><table class="data-table">
    <thead><tr><th>Municipality</th><th>Province</th><th>District / metro</th><th>Boundary</th><th>Calculated area</th><th>Data status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderSourceCards() {
  const statuses = new Map(state.integrations.map((integration) => [integration.id, integration]));
  const statusLabels = {
    loaded: "BUNDLED DATA",
    connected: "LIVE API",
    "connected-via-treasury": "LIVE VIA TREASURY",
    "portal-only": "PORTAL ONLY",
    unavailable: "UNAVAILABLE"
  };
  return `<div class="source-grid">${state.sources.map((source) => `
    ${(() => {
      const current = statuses.get(source.id);
      const status = current?.status ?? source.status;
      const detail = current?.detail ?? source.detail;
      const statusLabel = statusLabels[status] ?? status.toUpperCase();
      const portalUrl = source.portalUrl ?? source.url;
      return `<article class="source-card">
      <header><h3>${escapeHtml(source.name)}</h3><span class="status-pill ${status === "loaded" || status.startsWith("connected") ? "loaded" : status === "unavailable" ? "unavailable" : ""}">${escapeHtml(statusLabel)}</span></header>
      <p>${escapeHtml(detail)}</p>
      <p><span class="mono">${escapeHtml(source.publisher)} · ${escapeHtml(source.license)}</span></p>
      <a href="${escapeHtml(portalUrl)}" target="_blank" rel="noopener noreferrer">Visit official source ↗</a>
      ${source.dataPeriod ? `<p class="source-checked-at">Data period: ${escapeHtml(source.dataPeriod)}.</p>` : ""}
      ${source.publishedAt ? `<p class="source-checked-at">Source released: ${escapeHtml(new Date(`${source.publishedAt}T00:00:00Z`).toLocaleDateString("en-ZA", { timeZone: "UTC" }))}.</p>` : ""}
      ${source.dataUrl ? `<a href="${escapeHtml(source.dataUrl)}" target="_blank" rel="noopener noreferrer">Open original data ↗</a>` : ""}
      ${source.datasetUrl ? `<a href="${escapeHtml(source.datasetUrl)}" target="_blank" rel="noopener noreferrer">Open dataset extract ↗</a>` : ""}
      ${source.apiUrl ? `<a href="${escapeHtml(source.apiUrl)}" target="_blank" rel="noopener noreferrer">Open API ↗</a>` : ""}
      ${current?.checkedAt ? `<p class="source-checked-at">Status checked ${escapeHtml(new Date(current.checkedAt).toLocaleString("en-ZA"))}.</p>` : ""}</article>`;
    })()}`).join("")}</div>`;
}

function renderCitiesNetworkPublications() {
  if (state.publicationError) {
    return `<section class="publication-section"><h3>South African Cities Network publications</h3><p class="finance-source-note">Live publication feed unavailable: ${escapeHtml(state.publicationError)}</p><button class="action-button retry-button" type="button" data-retry-publications>Try again</button><a href="https://sacities.net/" target="_blank" rel="noopener noreferrer">Open South African Cities Network ↗</a></section>`;
  }
  if (!state.publications.length) {
    const message = state.publicationsLoaded
      ? "The live feed responded, but no publications were returned. Open the official site to browse its catalogue."
      : "Loading the official public publications feed…";
    return `<section class="publication-section"><h3>South African Cities Network publications</h3><p class="finance-source-note">${message}</p>${state.publicationsLoaded ? '<a href="https://sacities.net/" target="_blank" rel="noopener noreferrer">Open South African Cities Network ↗</a>' : ""}</section>`;
  }
  const items = state.publications.map((publication) => `
    <article class="publication-item">
      <time datetime="${escapeHtml(publication.date)}">${escapeHtml(new Date(publication.date).toLocaleDateString("en-ZA"))}</time>
      <div><h4><a href="${escapeHtml(publication.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(publication.title || "Untitled publication")}</a></h4>
      <p>${escapeHtml(publication.summary || "Open the original South African Cities Network publication.")}</p></div>
    </article>`).join("");
  return `<section class="publication-section"><h3>South African Cities Network publications</h3><p class="finance-source-note">Live public feed · titles, dates and links point to the original publisher.</p><div class="publication-list">${items}</div></section>`;
}

async function loadLiveSourceData() {
  const [integrationResult, publicationResult] = await Promise.allSettled([
    getJson("/api/integrations"),
    getJson("/api/publications/sacn?limit=8")
  ]);
  if (integrationResult.status === "fulfilled") {
    state.integrations = integrationResult.value.integrations;
    state.integrationError = null;
    const censusSource = state.integrations.find((source) => source.id === "stats-sa");
    document.querySelector("#data-status-label").textContent =
      censusSource?.status === "loaded" ? "213 CENSUS PROFILES" : "BOUNDARIES LOADED";
  } else {
    state.integrationError = integrationResult.reason.message;
    document.querySelector("#data-status-label").textContent = "BOUNDARIES LOADED";
  }
  if (publicationResult.status === "fulfilled") {
    state.publications = publicationResult.value.publications;
    state.publicationError = null;
    state.publicationsLoaded = true;
  } else {
    state.publicationError = publicationResult.reason.message;
    state.publicationsLoaded = true;
  }
  if (state.view === "sources") renderAlternateView();
}

function renderComparison() {
  const selectedIds = state.comparisonSelections.length
    ? [...state.comparisonSelections.slice(0, 3), "", "", ""].slice(0, 3)
    : [state.selected?.id ?? "", "", ""];
  const selectFields = selectedIds.map((id, index) => `
    <label>GEOGRAPHY ${index + 1}
      <select class="compare-select" data-index="${index}" aria-label="Comparison municipality ${index + 1}">
        <option value="">Select municipality…</option>
        ${state.municipalities
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
          .join("")}
      </select>
    </label>`).join("");
  const referenceField = `<label class="compare-reference-control">DIFFERENCE REFERENCE
    <select id="compare-reference" aria-label="Municipality used as the difference reference" disabled><option value="">Add two places to compare</option></select>
  </label>`;
  const metadataRows = [
    ["Province", "province"],
    ["District / metro", "district"],
    ["Boundary level", "level"],
    ["Boundary reference", "id"],
    ["Calculated area", "area"]
  ].map(([label, key]) => `<tr><td>${label}</td>${selectedIds.map((_, index) =>
    `<td data-comparison-field="${key}" data-index="${index}">—</td>`
  ).join("")}</tr>`).join("");
  const indicators = [
    ["Population · 2011 (people)", "total_pop_2011"],
    ["Population · 2022 (people)", "total_pop_2022"],
    ["Reported population change · 2011–2022 (%)", "growth_rate_2011_to_2022"],
    ["Households · 2011 (households)", "households_2011"],
    ["Households · 2022 (households)", "households_2022"],
    ["Average household size · 2022 (people per household)", "avg_household_size_2022"],
    ["Households using a water scheme · 2022 (%)", "water_scheme_share_2022"],
    ["Households with a flush toilet · 2022 (%)", "flush_toilet_share_2022"],
    ["Households using electricity for cooking · 2022 (%)", "electricity_cooking_share_2022"],
    ["Households using electricity for lighting · 2022 (%)", "electricity_lighting_share_2022"],
    ["People aged 5–24 attending school · 2022 (people)", "school_attendance_ages_5_to_24_2022"]
  ];
  const indicatorRows = indicators.map(([label, key]) =>
    `<tr><td>${label}</td>${selectedIds.map((_, index) =>
      `<td data-census-indicator="${key}" data-index="${index}">—</td>`
    ).join("")}</tr>`
  ).join("");
  return `<div class="compare-controls">${selectFields}${referenceField}<div class="view-actions"><button class="action-button" id="compare-export" disabled title="Export source-linked Census indicators for the selected municipalities">Export comparison data</button><button class="action-button" id="compare-share" disabled title="Copy a link that opens this municipality comparison">Copy comparison link</button></div></div>
    <section class="compare-results" aria-labelledby="compare-results-title">
      <header class="compare-results-heading"><div><span class="panel-kicker">SIDE-BY-SIDE RESULTS</span><h3 id="compare-results-title">Census population &amp; household indicators</h3></div><span class="compare-results-period">CENSUS · 2011 / 2022</span></header>
      <p class="source-check-note" id="compare-census-note">Bars compare selected municipalities within each indicator. Household shares use a 0–100 scale, population change uses a centre line for gains or losses, and other measures scale to the highest selected value. Labels retain their units and Census periods.</p>
      <div class="labour-series-list compare-series-list" id="compare-series-list" aria-live="polite"></div>
      <div class="visually-hidden"><table class="data-table compare-table" id="compare-census-table"><thead><tr><th>Indicator</th><th data-indicator-heading="0">Geography 1</th><th data-indicator-heading="1">Geography 2</th><th data-indicator-heading="2">Geography 3</th></tr></thead><tbody>${indicatorRows}</tbody></table></div>
    </section>
    <details class="compare-metadata-details"><summary>Geographic details</summary><p class="compare-scroll-note">Boundary metadata for the selected places.</p><div class="data-table-wrap compare-metadata-wrap"><table class="data-table compare-table"><thead><tr><th>Property</th><th data-compare-heading="0">Geography 1</th><th data-compare-heading="1">Geography 2</th><th data-compare-heading="2">Geography 3</th></tr></thead><tbody>${metadataRows}</tbody></table></div></details>`;
}

function renderAlternateView() {
  const [title, subtitle] = viewCopy[state.view] ?? viewCopy.dashboard;
  const viewRoot = state.view === "comparisons" ? comparisonWorkspace : alternateView;
  let content = "";
  if (state.view === "municipalities") {
    content = renderMunicipalityTable();
  } else if (state.view === "sources") {
    const connectionNote = state.integrationError
      ? `<div class="compare-empty">Live provider status unavailable: ${escapeHtml(state.integrationError)}.<br><button class="action-button retry-button" type="button" data-retry-integrations>Try again</button></div>`
      : state.integrations.length
        ? `<p class="source-check-note">Provider status checked ${escapeHtml(new Date(state.integrations[0].checkedAt).toLocaleString("en-ZA"))}. A portal-only label means no public structured API has been verified.</p>`
        : `<p class="source-check-note">Checking live provider connections…</p>`;
    content = `${connectionNote}${renderSourceCoverageSummary()}${renderSourceCards()}${renderCitiesNetworkPublications()}`;
  } else if (state.view === "comparisons") {
    content = renderComparison();
  } else if (state.view === "reports") {
    content = `<div class="view-empty"><div class="notice-symbol">i</div><h3>No verified reports published</h3><p>Reports will appear here after official documents are catalogued with their source and publication period.</p></div>`;
  } else if (state.view === "history") {
    content = `<div class="compare-empty">Historical and longitudinal comparisons are not enabled until a verified, date-stamped source archive is connected. The interface is ready to accept period-aligned public datasets without ranking incomplete data.</div>`;
  } else if (state.view === "research") {
    content = `<div class="view-empty"><div class="notice-symbol">i</div><h3>No research entries catalogued</h3><p>Research materials will appear here when their original publications and dates have been reviewed.</p></div>`;
  } else {
    content = `<div class="view-empty"><div class="notice-symbol">!</div><h3>Not available in this prototype</h3><p>${escapeHtml(subtitle)}. No unsupported or unverified content is displayed. Use the map, municipality directory or source catalogue to explore the currently loaded data.</p></div>`;
  }
  viewRoot.innerHTML = `
    <header class="alternate-heading">
      <div><span class="panel-kicker">CIVICSTATS SA · ${escapeHtml(state.view.toUpperCase())}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
      <div class="view-actions">${state.view === "municipalities" ? '<button class="action-button" id="export-municipalities">Download boundary directory</button>' : ""}</div>
    </header>${content}`;

  viewRoot.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.municipalities.find((municipality) => municipality.id === button.dataset.selectId);
      if (item) void selectMunicipality(item);
    });
  });
  const exportButton = viewRoot.querySelector("#export-municipalities");
  if (exportButton) exportButton.addEventListener("click", exportMunicipalityDirectory);
  viewRoot.querySelectorAll("[data-retry-publications], [data-retry-integrations]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      button.textContent = "Retrying…";
      if (button.hasAttribute("data-retry-publications")) state.publicationError = null;
      if (button.hasAttribute("data-retry-integrations")) state.integrationError = null;
      state.publicationsLoaded = false;
      state.publications = [];
      state.integrations = [];
      renderAlternateView();
      void loadLiveSourceData();
    });
  });
  if (state.view === "comparisons") initializeComparison(viewRoot);
}

function renderSourceCoverageSummary() {
  return `<section class="source-coverage-summary" aria-label="Data coverage and interpretation">
    <div><span class="panel-kicker">COVERAGE &amp; LIMITS</span><h3>Know what each dataset can tell you</h3></div>
    <div class="source-coverage-grid">
      <article><strong>Municipal Census</strong><p>Population and selected household indicators cover 213 municipalities for Census 2011 and 2022. Service responses describe reported access at census time.</p></article>
      <article><strong>Province-level estimates</strong><p>Stats SA QLFS unemployment and GDP-R cover all nine provinces. They are not municipality estimates and must not be averaged into a national rate without the right source weights.</p></article>
      <article><strong>Live and dated sources</strong><p>Treasury finance, audit and project records, NASA POWER climate data, World Bank indicators and publication feeds show their own periods and source coverage.</p></article>
      <article><strong>Score limits</strong><p>The basic-services CivicScore is a municipality-only Census 2022 pilot. It is not a complete measure of council performance and has no national score.</p></article>
    </div>
  </section>`;
}

async function loadComparisonScaleDomains() {
  if (state.comparisonScales) return state.comparisonScales;
  if (state.comparisonScalesPromise) return state.comparisonScalesPromise;
  state.comparisonScalesPromise = (async () => {
    const [peopleText, ageText, housingText, electricityText] = await Promise.all([
      getStaticText("assets/data/person-indicators-muni.csv"),
      getStaticText("assets/data/age-distribution-muni.csv"),
      getStaticText("assets/data/housing-info-muni.csv"),
      getStaticText("assets/data/electricity-lighting-muni.csv")
    ]);
    const people = parseBundledCsv(peopleText, "person-indicators-muni.csv");
    const ages = new Map(parseBundledCsv(ageText, "age-distribution-muni.csv").map((record) => [record.muni_code, record]));
    const housing = new Map(parseBundledCsv(housingText, "housing-info-muni.csv").map((record) => [record.muni_code, record]));
    const electricity = new Map(parseBundledCsv(electricityText, "electricity-lighting-muni.csv").map((record) => [record.muni_code, record]));
    if (new Set(people.map((record) => record.muni_code)).size !== 213 ||
      ages.size !== 213 || housing.size !== 213 || electricity.size !== 213) {
      throw new Error("Full-coverage Census scales require complete, unique source rows for all 213 municipalities.");
    }
    const share = (count, households) => Number.isFinite(count) && Number.isFinite(households) && households > 0
      ? count / households * 100
      : null;
    const metrics = people.map((record) => {
      const age = ages.get(record.muni_code);
      const home = housing.get(record.muni_code);
      const light = electricity.get(record.muni_code);
      if (!age || !home || !light || age.name !== record.name || home.name !== record.name || light.name !== record.name) {
        throw new Error(`Census scale source rows do not match for municipality code ${record.muni_code}.`);
      }
      return {
        total_pop_2011: record.total_pop_2011,
        total_pop_2022: record.total_pop_2022,
        growth_rate_2011_to_2022: record.growth_rate_2011_to_2022,
        households_2011: home.households_2011,
        households_2022: home.households_2022,
        avg_household_size_2022: home.avg_household_size_2022,
        water_scheme_share_2022: share(home.water_scheme_2022, home.households_2022),
        flush_toilet_share_2022: share(home.flush_toilet_2022, home.households_2022),
        electricity_cooking_share_2022: share(home.electricity_cooking_2022, home.households_2022),
        electricity_lighting_share_2022: light.electricity_lighting_share_2022,
        school_attendance_ages_5_to_24_2022: record.school_attendance_ages_5_to_24_2022
      };
    });
    const keys = Object.keys(metrics[0] ?? {});
    return Object.fromEntries(keys.map((key) => {
      const values = metrics.map((metric) => metric[key]).filter(Number.isFinite);
      if (!values.length) throw new Error(`Census data is missing the ${key} comparison scale.`);
      const domain = key.includes("_share_")
        ? 100
        : key.includes("growth_rate")
          ? Math.max(...values.map(Math.abs))
          : Math.max(...values);
      return [key, Math.max(1, domain)];
    }));
  })().then((scales) => {
    state.comparisonScales = scales;
    state.comparisonScalesError = false;
    return scales;
  }).catch((error) => {
    state.comparisonScalesPromise = null;
    throw error;
  });
  return state.comparisonScalesPromise;
}

function initializeComparison(root) {
  const selects = [...root.querySelectorAll(".compare-select")];
  if (state.comparisonSelections.length) {
    state.comparisonSelections.slice(0, selects.length).forEach((id, index) => {
      selects[index].value = id;
    });
  } else if (state.selected?.level === "ADM3" && selects[0]) {
    selects[0].value = state.selected.id;
  }
  const exportButton = root.querySelector("#compare-export");
  const shareButton = root.querySelector("#compare-share");
  const update = () => {
    const requestId = ++state.comparisonRequestId;
    const selectedIds = selects.map((select) => select.value).filter(Boolean);
    state.comparisonSelections = selectedIds;
    renderMapComparisonSelection();
    updateComparisonReference(selects, root);
    const pending = [];
    selects.forEach((select, index) => {
      const item = state.municipalities.find((municipality) => municipality.id === select.value);
      const heading = item?.name ?? `Geography ${index + 1}`;
      root.querySelector(`[data-compare-heading="${index}"]`).textContent = heading;
      root.querySelector(`[data-indicator-heading="${index}"]`).textContent = heading;
      const values = {
        province: item?.province,
        district: item?.district,
        level: item ? formatBoundaryLevel(item.level) : null,
        id: item?.id,
        area: item?.areaKm2 == null ? null : formatArea(item.areaKm2)
      };
      root.querySelectorAll(`[data-index="${index}"][data-comparison-field]`).forEach((cell) => {
        cell.textContent = values[cell.dataset.comparisonField] ?? "—";
      });
      [...select.options].forEach((option) => {
        option.disabled = Boolean(option.value && selectedIds.includes(option.value) && option.value !== select.value);
      });
      if (item && !state.censusCache.has(item.id)) {
        state.comparisonErrors.delete(item.id);
        pending.push(getJson(`/api/municipalities/${encodeURIComponent(item.id)}/census`)
          .then((result) => state.censusCache.set(item.id, result))
          .catch((error) => state.comparisonErrors.set(item.id, error.message)));
      }
    });
    updateComparisonIndicators(selects, root);
    if (exportButton) exportButton.disabled = selectedIds.length === 0;
    if (shareButton) shareButton.disabled = selectedIds.length < 2;
    if (pending.length) {
      void Promise.all(pending).then(() => {
        if (requestId === state.comparisonRequestId && state.view === "comparisons") {
          updateComparisonIndicators(selects, root);
        }
      });
    }
  };
  selects.forEach((select) => select.addEventListener("change", update));
  root.querySelector("#compare-reference")?.addEventListener("change", (event) => {
    state.comparisonReferenceId = event.currentTarget.value || null;
    updateComparisonIndicators(selects, root);
  });
  exportButton?.addEventListener("click", () => exportComparison(root));
  shareButton?.addEventListener("click", () => copyComparisonLink(root));
  update();
  void loadComparisonScaleDomains().then(() => {
    if (state.view === "comparisons") updateComparisonIndicators(selects, root);
  }).catch(() => {
    state.comparisonScalesError = true;
    if (state.view === "comparisons") updateComparisonIndicators(selects, root);
  });
}

function updateComparisonReference(selects, root = comparisonWorkspace) {
  const control = root.querySelector("#compare-reference");
  if (!control) return;
  const selected = selects.map((select) => state.municipalities.find((item) => item.id === select.value)).filter(Boolean);
  const reference = selected.find((item) => item.id === state.comparisonReferenceId) ?? selected[0] ?? null;
  state.comparisonReferenceId = reference?.id ?? null;
  control.replaceChildren();
  if (selected.length < 2) {
    const option = document.createElement("option");
    option.value = reference?.id ?? "";
    option.textContent = reference ? `${reference.name} · add another place to compare` : "Add two places to compare";
    option.selected = true;
    control.append(option);
    control.disabled = true;
    return;
  }
  selected.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === reference.id;
    control.append(option);
  });
  control.value = reference.id;
  control.disabled = false;
}

async function copyComparisonLink(root = comparisonWorkspace) {
  const ids = [...root.querySelectorAll(".compare-select")].map((select) => select.value).filter(Boolean);
  if (ids.length < 2) return;
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("compare", ids.join(","));
  if (ids.includes(state.comparisonReferenceId)) url.searchParams.set("reference", state.comparisonReferenceId);
  url.hash = "";
  try {
    await navigator.clipboard.writeText(url.href);
    showToast("Comparison link copied with the selected places and reference.");
  } catch {
    showToast("Could not copy the link. Copy this address from your browser after selecting the municipalities.");
  }
}

function comparisonValue(indicators, key, result) {
  if (!indicators) return null;
  if (key === "electricity_lighting_share_2022") {
    const value = result?.electricity?.indicators?.electricityLightingSharePercent2022;
    return typeof value === "number" && Number.isFinite(value)
      ? `${formatCensusNumber(value, 1)}%`
      : null;
  }
  if (key === "water_scheme_share_2022" || key === "flush_toilet_share_2022" ||
    key === "electricity_cooking_share_2022") {
    const field = {
      water_scheme_share_2022: "water_scheme_2022",
      flush_toilet_share_2022: "flush_toilet_2022",
      electricity_cooking_share_2022: "electricity_cooking_2022"
    }[key];
    const households = indicators.households_2022;
    const count = indicators[field];
    if (typeof households !== "number" || households <= 0 || typeof count !== "number") return null;
    return `${formatCensusNumber((count / households) * 100, 1)}%`;
  }
  const value = indicators[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return key === "growth_rate_2011_to_2022" || key === "avg_household_size_2022"
    ? formatCensusNumber(value, 1)
    : formatCensusNumber(value);
}

function updateComparisonIndicators(selects, root = comparisonWorkspace) {
  const errors = [];
  selects.forEach((select, index) => {
    const id = select.value;
    const result = id ? state.censusCache.get(id) : null;
    const indicators = result?.census?.indicators ?? null;
    if (id && state.comparisonErrors.has(id)) {
      errors.push(`${state.municipalities.find((item) => item.id === id)?.name ?? "Selected municipality"}: ${state.comparisonErrors.get(id)}`);
    }
    root.querySelectorAll(`[data-index="${index}"][data-census-indicator]`).forEach((cell) => {
      const key = cell.dataset.censusIndicator;
      const value = comparisonValue(indicators, key, result);
      cell.textContent = value ??
        (id && !state.censusCache.has(id) && !state.comparisonErrors.has(id)
          ? "Loading…"
          : id && state.comparisonErrors.has(id)
            ? "Unavailable"
            : id && result?.census === null
              ? "No Census record"
            : "—");
    });
  });
  const note = root.querySelector("#compare-census-note");
  if (note) {
    const referenceName = state.municipalities.find((item) => item.id === state.comparisonReferenceId)?.name;
    const differenceNote = ` Differences are measured against ${referenceName ?? "the selected reference place"}; share and growth differences are percentage points.`;
    const scaleNote = state.comparisonScales
      ? " Bar scales are fixed to the full 213-municipality Census dataset."
      : state.comparisonScalesError
        ? " Fixed bars are unavailable; the exact values remain shown without a scaled bar."
        : " Loading fixed scales from the full 213-municipality Census dataset…";
    note.textContent = `${errors.length ? `Census comparison data could not be loaded: ${errors.join(" · ")}` : "Values use their labelled units and Census periods."}${differenceNote}${scaleNote}`;
  }
  renderComparisonSeries(selects, root);
}

function comparisonIndicatorMetadata(key) {
  const entries = {
    total_pop_2011: ["Census 2011 · Stats SA", "People counted by the Census on its reference date."],
    total_pop_2022: ["Census 2022 · Stats SA", "People counted by the Census on its reference date."],
    growth_rate_2011_to_2022: ["Census 2011–2022 · Stats SA", "Change between the two Census population counts; this is not an annual growth rate or forecast."],
    households_2011: ["Census 2011 · Stats SA", "Census count of households, separate from the number of people."],
    households_2022: ["Census 2022 · Stats SA", "Census count of households, separate from the number of people."],
    avg_household_size_2022: ["Census 2022 · Stats SA", "Average number of people per household."],
    water_scheme_share_2022: ["Census 2022 · Stats SA", "Share of households reporting a water-scheme source; this does not measure water quality or supply continuity."],
    flush_toilet_share_2022: ["Census 2022 · Stats SA", "Share of households reporting a flush toilet; this does not establish that facilities are working."],
    electricity_cooking_share_2022: ["Census 2022 · Stats SA", "Share of households reporting electricity as their main cooking energy source."],
    electricity_lighting_share_2022: ["Census 2022 municipal fact sheet · Stats SA", "Share of households reporting electricity as their main lighting source; this does not measure outages or reliability."],
    school_attendance_ages_5_to_24_2022: ["Census 2022 · Stats SA", "People aged 5–24 reported as attending an educational institution; this does not measure attendance quality or attainment."]
  };
  const [periodSource, definition] = entries[key] ?? ["Census · Stats SA", "Source period and definition are shown in the linked Census dataset."];
  return { periodSource, definition };
}

function renderComparisonSeries(selects, root = comparisonWorkspace) {
  const container = root.querySelector("#compare-series-list");
  if (!container) return;
  container.replaceChildren();
  const selected = selects
    .map((select) => ({ id: select.value, municipality: state.municipalities.find((item) => item.id === select.value) }))
    .filter((entry) => entry.id && entry.municipality);
  if (!selected.length) {
    const empty = document.createElement("p");
    empty.className = "compare-empty";
    empty.textContent = "Choose a municipality above to see its figures.";
    container.append(empty);
    return;
  }
  const reference = selected.find((entry) => entry.id === state.comparisonReferenceId) ?? selected[0];
  const groups = [
    { title: "Population & change", keys: ["total_pop_2011", "total_pop_2022", "growth_rate_2011_to_2022"] },
    { title: "Household profile", keys: ["households_2011", "households_2022", "avg_household_size_2022"] },
    { title: "Household services", keys: ["water_scheme_share_2022", "flush_toilet_share_2022", "electricity_cooking_share_2022", "electricity_lighting_share_2022"] },
    { title: "Education", keys: ["school_attendance_ages_5_to_24_2022"] }
  ];
  const rows = new Map([...root.querySelectorAll("#compare-census-table tbody tr")]
    .map((row) => [row.querySelector("[data-census-indicator]")?.dataset.censusIndicator, row]));
  groups.forEach(({ title, keys }) => {
    const groupRows = keys.map((key) => rows.get(key)).filter(Boolean);
    if (!groupRows.length) return;
    const section = document.createElement("section");
    section.className = "compare-series-group";
    const groupHeading = document.createElement("h4");
    groupHeading.textContent = title;
    section.append(groupHeading);
    groupRows.forEach((row) => {
      const label = row.cells[0]?.textContent ?? "Indicator";
      const key = row.querySelector("[data-census-indicator]")?.dataset.censusIndicator;
      const metadata = comparisonIndicatorMetadata(key);
      const article = document.createElement("article");
      article.className = "compare-series-row";
      const heading = document.createElement("h5");
      heading.textContent = label;
      const context = document.createElement("div");
      context.className = "compare-series-context";
      const periodSource = document.createElement("span");
      periodSource.className = "compare-series-period-source";
      periodSource.textContent = metadata.periodSource;
      const definition = document.createElement("details");
      const definitionSummary = document.createElement("summary");
      definitionSummary.textContent = "Definition";
      const definitionText = document.createElement("p");
      definitionText.textContent = metadata.definition;
      definition.append(definitionSummary, definitionText);
      context.append(periodSource, definition);
      article.append(heading, context);
      const values = document.createElement("div");
      values.className = "labour-series-values";
      const mode = key?.includes("growth_rate") ? "signed"
        : key?.includes("_share_") ? "share"
          : "relative";
      const entries = selected.map(({ id, municipality }) => {
        const columnIndex = selects.findIndex((select) => select.value === id);
        const value = row.querySelector(`[data-index="${columnIndex}"][data-census-indicator]`)?.textContent ?? "—";
        const numeric = Number.parseFloat(value.replaceAll(",", ""));
        return { id, municipality, value, numeric };
      });
      const referenceNumeric = entries.find((entry) => entry.id === reference.id)?.numeric;
      const domain = state.comparisonScales?.[key];
      entries.forEach(({ id, municipality, value, numeric }) => {
        const line = document.createElement("div");
        line.className = "labour-series-line compare-series-line";
        const place = document.createElement("span");
        place.className = "compare-series-place";
        place.textContent = municipality.name;
        place.title = municipality.name;
        const track = document.createElement("div");
        track.className = `census-bar-track compare-series-track${mode === "signed" ? " signed" : ""}`;
        track.hidden = !Number.isFinite(domain) || !Number.isFinite(numeric);
        const fill = document.createElement("span");
        fill.className = `compare-series-fill${numeric < 0 ? " negative" : ""}`;
        if (Number.isFinite(numeric) && Number.isFinite(domain) && domain > 0) {
          if (mode === "signed") {
            const width = Math.min(50, Math.abs(numeric) / domain * 50);
            fill.style.width = `${width}%`;
            fill.style.left = numeric < 0 ? `${50 - width}%` : "50%";
          } else {
            fill.style.width = `${Math.max(0, Math.min(100, numeric / domain * 100))}%`;
          }
        }
        track.append(fill);
        const amount = document.createElement("span");
        amount.className = "compare-series-amount";
        const exactValue = document.createElement("strong");
        exactValue.textContent = value;
        amount.append(exactValue);
        let difference = "";
        if (id === reference.id && entries.length > 1) {
          difference = "Reference";
        } else if (Number.isFinite(numeric) && Number.isFinite(referenceNumeric)) {
          const delta = numeric - referenceNumeric;
          const precision = mode === "share" || mode === "signed" || key === "avg_household_size_2022" ? 1 : 0;
          const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
          const units = mode === "share" || mode === "signed"
            ? "pp"
            : key?.startsWith("households_")
              ? "households"
              : key === "avg_household_size_2022"
                ? "people / household"
                : "people";
          difference = `${sign}${formatCensusNumber(Math.abs(delta), precision)} ${units}`;
        } else if (entries.length > 1) {
          difference = "Difference unavailable";
        }
        if (difference) {
          const differenceLabel = document.createElement("small");
          differenceLabel.className = "compare-series-difference";
          differenceLabel.textContent = difference;
          amount.append(differenceLabel);
        }
        const comparisonContext = id === reference.id && entries.length > 1
          ? ", reference place"
          : difference
            ? `, difference from ${reference.municipality.name}: ${difference}`
            : "";
        line.setAttribute("aria-label", `${municipality.name}: ${label}, ${value}${comparisonContext}`);
        line.append(place, track, amount);
        values.append(line);
      });
      article.append(values);
      section.append(article);
    });
    container.append(section);
  });
}

async function exportComparison(root = comparisonWorkspace) {
  const selectedIds = [...root.querySelectorAll(".compare-select")]
    .map((select) => select.value)
    .filter(Boolean);
  const selected = [...new Set(selectedIds)]
    .map((id) => state.municipalities.find((item) => item.id === id))
    .filter(Boolean);
  if (!selected.length) {
    showToast("Select at least one municipality to export comparison data.");
    return;
  }
  const rows = [[
    "municipality",
    "province",
    "district_or_metro",
    "boundary_level",
    "boundary_reference",
    "calculated_area_km2",
    "area_method",
    "boundary_source",
    "population_2011",
    "population_2022",
    "households_2011",
    "households_2022",
    "reported_population_growth_rate_2011_to_2022",
    "water_scheme_household_share_2022_percent",
    "flush_toilet_household_share_2022_percent",
    "electricity_lighting_household_share_2011_percent",
    "electricity_lighting_household_share_2022_percent",
    "census_source",
    "electricity_source"
  ]];
  try {
    const records = await Promise.all(selected.map(async (item) =>
      state.censusCache.get(item.id) ??
      getJson(`/api/municipalities/${encodeURIComponent(item.id)}/census`)
    ));
    selected.forEach((item, index) => {
      const indicators = records[index]?.census?.indicators;
      const householdShare = (count, households) =>
        typeof count === "number" && typeof households === "number" && households > 0
          ? Number(((count / households) * 100).toFixed(2))
          : "";
      rows.push([
        item.name,
        item.province,
        item.district,
        item.level,
        item.id,
        item.areaKm2,
        item.areaMethod,
        "geoBoundaries ADM3 · boundary vintage 2020",
        indicators?.total_pop_2011 ?? "",
        indicators?.total_pop_2022 ?? "",
        indicators?.households_2011 ?? "",
        indicators?.households_2022 ?? "",
        indicators?.growth_rate_2011_to_2022 ?? "",
        householdShare(indicators?.water_scheme_2022, indicators?.households_2022),
        householdShare(indicators?.flush_toilet_2022, indicators?.households_2022),
        records[index]?.electricity?.indicators?.electricityLightingSharePercent2011 ?? "",
        records[index]?.electricity?.indicators?.electricityLightingSharePercent2022 ?? "",
        records[index]?.source?.title ?? "No Census record",
        records[index]?.electricity?.source?.title ?? "No electricity-lighting record"
      ]);
    });
  } catch (error) {
    showToast(`Comparison export failed: ${error.message}`);
    return;
  }
  downloadCsv("civicstats-sa-geography-comparison.csv", rows);
  showToast("Geography and Census comparison data downloaded with source attribution.");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function exportMunicipalityDirectory() {
  const rows = [["municipality", "province", "district_or_metro", "boundary_level", "boundary_reference", "indicator_status", "source"]];
  state.municipalities.forEach((item) => rows.push([
    item.name, item.province, item.district, item.level, item.id,
    "Census 2011/2022 data available", "Statistics South Africa · Census 2022: Provinces at a Glance"
  ]));
  downloadCsv("civicstats-sa-municipality-boundaries.csv", rows);
  showToast("Municipality directory downloaded with Census source coverage.");
}

async function exportSelectedProfile() {
  if (!state.selected) {
    showToast("Select a municipality before downloading profile metadata.");
    return;
  }
  const selected = state.selected;
  let basicServicesPilot = null;
  const rows = [
    ["field", "year", "value", "unit", "source"],
    ["name", "", selected.name, "", "geoBoundaries ADM3"],
    ["boundary_reference", "", selected.id, "", "geoBoundaries"],
    ["province", "", selected.province, "", "Derived from contained administrative boundary"],
    ["district_or_metro", "", selected.district, "", "Derived from contained administrative boundary"],
    ["calculated_area_km2", "", selected.areaKm2, "km² · approximate boundary-derived area", selected.areaMethod]
  ];
  if (selected.level === "ADM3") {
    try {
      const result = state.censusCache.get(selected.id) ??
        await getJson(`/api/municipalities/${encodeURIComponent(selected.id)}/census`);
      state.censusCache.set(selected.id, result);
      basicServicesPilot = result.basicServicesPilot ?? null;
      if (result.census) {
        Object.entries(result.census.indicators).forEach(([key, value]) => {
          if (typeof value !== "number" || !Number.isFinite(value) ||
            ["government_transfers_subsidies_percent"].includes(key)) return;
          const yearMatch = key.match(/_(2011|2022)$/);
          const period = yearMatch?.[1] ?? (key.includes("growth_rate") ? "2011–2022" : "");
          const label = key.replace(/_(2011|2022)$/, "").replaceAll("_", " ");
          rows.push([label, period, value, "", result.source.title]);
        });
      }
      Object.entries(result.electricity?.indicators ?? {}).forEach(([key, value]) => {
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        const period = key.match(/(2011|2022)$/)?.[1] ?? "";
        rows.push([
          "electricity for household lighting",
          period,
          value,
          "% of households",
          result.electricity.source.title
        ]);
      });
    } catch (error) {
      showToast(`Profile export failed: ${error.message}`);
      return;
    }
  }
  if (basicServicesPilot) {
    rows.push(["CivicScore basic-services pilot", "2022", basicServicesPilot.score, "out of 100", basicServicesPilot.method]);
    basicServicesPilot.components.forEach((component) => {
      rows.push([component.label, "2022", component.value, component.unit, component.source]);
    });
    rows.push(["Pilot limitation", "2022", basicServicesPilot.limitation, "", "Interpret with the three source indicators"]);
  } else {
    rows.push(["CivicScore basic-services pilot", "2022", "Not available", "", selected.level === "ADM3" ? "All three verified Census 2022 service indicators are required" : "Municipal profiles only"]);
  }
  downloadCsv(`civicstats-${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, rows);
  showToast("Municipality profile and available Census indicators downloaded with source attribution.");
}

function closeSearchResults() {
  searchResults.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
}

function renderSearchResults(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    closeSearchResults();
    searchResults.replaceChildren();
    if (searchStatus) searchStatus.textContent = "";
    searchClear.hidden = true;
    state.searchMatches = [];
    state.searchActiveIndex = -1;
    return;
  }
  searchClear.hidden = false;
  const score = (item) => {
    const name = item.name.toLocaleLowerCase();
    const code = item.officialCode?.toLocaleLowerCase() ?? "";
    if (name === normalized || code === normalized) return 0;
    if (name.startsWith(normalized) || code.startsWith(normalized)) return 1;
    if (name.includes(normalized)) return 2;
    return 3;
  };
  const matches = state.geographies
    .filter((item) => [item.name, item.province, item.district, item.officialCode]
      .some((value) => value?.toLocaleLowerCase().includes(normalized)))
    .sort((left, right) =>
      score(left) - score(right) ||
      (left.level === "ADM3" ? -1 : right.level === "ADM3" ? 1 : 0) ||
      left.name.localeCompare(right.name)
    )
    .slice(0, 8);
  state.searchMatches = matches;
  state.searchActiveIndex = matches.length ? 0 : -1;
  searchResults.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No province, district or municipality matches that search.";
    searchResults.append(empty);
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    searchInput.removeAttribute("aria-activedescendant");
    if (searchStatus) searchStatus.textContent = `No places found for ${query}.`;
    return;
  }
  matches.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.setAttribute("role", "option");
    button.id = `search-result-${index}`;
    button.setAttribute("aria-selected", String(index === state.searchActiveIndex));
    const name = document.createElement("strong");
    name.textContent = item.name;
    const place = document.createElement("small");
    const code = item.officialCode ? ` · ${item.officialCode}` : "";
    place.textContent = `${formatBoundaryLevel(item.level)}${item.category ? ` · ${item.category}` : ""} · ${[item.province, item.district].filter(Boolean).join(" · ") || "South Africa"}${code}`;
    button.append(name, place);
    button.addEventListener("click", () => {
      searchInput.value = item.name;
      closeSearchResults();
      void selectGeography(item);
    });
    searchResults.append(button);
  });
  searchResults.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchInput.setAttribute("aria-activedescendant", `search-result-${state.searchActiveIndex}`);
  if (searchStatus) searchStatus.textContent = `${matches.length} place${matches.length === 1 ? "" : "s"} found. Use the arrow keys to review results and Enter to open one.`;
}

function updateActiveSearchResult(index) {
  if (!state.searchMatches.length) return;
  state.searchActiveIndex = (index + state.searchMatches.length) % state.searchMatches.length;
  searchResults.querySelectorAll(".search-result").forEach((result, resultIndex) => {
    const active = resultIndex === state.searchActiveIndex;
    result.setAttribute("aria-selected", String(active));
    if (active) result.scrollIntoView({ block: "nearest" });
  });
  searchInput.setAttribute("aria-activedescendant", `search-result-${state.searchActiveIndex}`);
}

function bindEvents() {
  document.querySelectorAll("[data-overview-level]").forEach((button) => {
    button.addEventListener("click", async () => {
      const level = button.dataset.overviewLevel;
      if (level === "national") {
        resetMapToNational();
        return;
      }
      state.overviewLevel = level;
      state.autoBoundaryDetail = false;
      document.querySelector("#auto-boundary-detail").checked = false;
      document.querySelector("#boundary-level").value = level;
      syncOverviewLevelSwitcher();
      closeMapPinnedDetail();
      try {
        if (state.view !== "dashboard") setView("dashboard");
        if (state.boundaryLevel !== level) await changeBoundaryLevel(level);
        clearGeographySelection();
        if (state.map) state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [30, 30], maxZoom: 6 });
      } catch (error) {
        state.overviewLevel = "national";
        syncOverviewLevelSwitcher();
        showToast(`Could not load that overview level: ${error.message}`);
      }
    });
  });
  const compactMapViewport = window.matchMedia("(max-width: 900px)");
  setMobileLayerPickerOpen(!compactMapViewport.matches);
  compactMapViewport.addEventListener("change", (event) => setMobileLayerPickerOpen(!event.matches));
  const mapLegend = document.querySelector("#map-legend");
  const updateLegendToggle = () => {
    const toggle = mapLegend.querySelector(".map-legend-toggle");
    if (toggle) toggle.textContent = mapLegend.open ? "HIDE" : "SHOW";
  };
  mapLegend.addEventListener("toggle", updateLegendToggle);
  updateLegendToggle();
  document.querySelectorAll("[data-map-detail-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mapDetailMode = button.dataset.mapDetailMode === "detailed";
      document.querySelectorAll("[data-map-detail-mode]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
      });
      state.boundaryLayer?.getLayers().forEach((layer) => {
        if (layer.isTooltipOpen?.()) layer.setTooltipContent(mapTooltip(layer.feature, { compact: !state.mapDetailMode }));
      });
    });
  });
  document.querySelector("#map-hover-preview-toggle").addEventListener("change", (event) => {
    state.mapHoverPreviews = event.currentTarget.checked;
    document.querySelector("#map-hover-compare").hidden = true;
    state.hoveredMapGeographyId = null;
    state.boundaryLayer?.getLayers().forEach((layer) => {
      if (state.mapHoverPreviews) layer.bindTooltip(mapTooltip(layer.feature, { compact: !state.mapDetailMode }), { sticky: true, direction: "top" });
      else layer.unbindTooltip();
    });
  });
  document.querySelector(".map-wrap").addEventListener("pointerleave", () => {
    document.querySelector("#map-hover-compare").hidden = true;
    state.hoveredMapGeographyId = null;
  });
  document.querySelector("#map-hover-compare-button").addEventListener("click", () => {
    if (state.hoveredMapGeographyId) openComparisonWithMunicipality(state.hoveredMapGeographyId);
  });
  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "dashboard") {
        setTab("overview");
        resetMapToNational();
      } else {
        setView(button.dataset.view);
      }
      document.body.classList.remove("mobile-nav-open");
      document.querySelector("#mobile-scrim").hidden = true;
    });
  });
  document.querySelectorAll(".nav-link[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setTab(button.dataset.tab);
      document.body.classList.remove("mobile-nav-open");
      document.querySelector("#mobile-scrim").hidden = true;
    });
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.querySelectorAll(".text-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelector("#boundary-level").addEventListener("change", async (event) => {
    state.autoBoundaryDetail = false;
    document.querySelector("#auto-boundary-detail").checked = false;
    try {
      await changeBoundaryLevel(event.target.value);
    } catch (error) {
      showToast(`Unable to load boundaries: ${error.message}`);
    }
  });
  document.querySelector("#auto-boundary-detail").addEventListener("change", (event) => {
    state.autoBoundaryDetail = event.currentTarget.checked;
    if (state.autoBoundaryDetail) syncBoundaryLevelToZoom();
  });
  document.querySelector("#map-census-year").addEventListener("change", (event) => {
    void loadCensusMapData(Number(event.target.value));
  });
  document.querySelector("#economy-year").addEventListener("change", (event) => {
    const year = Number(event.target.value);
    void loadProvincialGdpData(year).then(() => {
      refreshMapStyles();
      if (state.tab === "economy") renderDetail();
    });
  });
  document.querySelector("#labour-quarter").addEventListener("change", (event) => {
    setLabourQuarter(event.target.value);
    if (state.tab === "economy" && state.selected?.level === "ADM1") renderDetail();
  });
  document.querySelectorAll('input[name="map-layer"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked || input.disabled) return;
      closeMapPinnedDetail();
      document.querySelector("#map-layer-help").hidden = true;
      state.mapLayer = input.value;
      refreshMapStyles();
      if (window.matchMedia("(max-width: 900px)").matches) setMobileLayerPickerOpen(false);
    });
  });
  document.querySelector("#mobile-layer-toggle").addEventListener("click", () => {
    const toggle = document.querySelector("#mobile-layer-toggle");
    setMobileLayerPickerOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  document.querySelectorAll(".layer-coverage-action").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.layerAction === "province") {
        void activateProvinceMapLayer(button.dataset.layer);
      } else if (button.dataset.layerAction === "air-quality") {
        void activateAirQualityLayer();
      } else {
        showMapLayerGuidance(button.dataset.layer);
      }
    });
  });
  document.querySelector("#fit-map").addEventListener("click", () => {
    resetMapToNational();
  });
  document.querySelector("#close-map-pinned-detail").addEventListener("click", closeMapPinnedDetail);
  document.querySelector("#map-compact-toggle").addEventListener("click", (event) => {
    const compact = workspaceGrid.classList.toggle("map-compact");
    event.currentTarget.textContent = compact ? "Expand map" : "Compact map";
    event.currentTarget.setAttribute("aria-expanded", String(!compact));
    requestAnimationFrame(() => state.map?.invalidateSize({ pan: false }));
  });
  document.querySelector("#fullscreen-map").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector(".map-panel").requestFullscreen();
    } catch (error) {
      showToast(`Could not change map full-screen mode: ${error.message}`);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    setTimeout(() => state.map?.invalidateSize(), 100);
    const button = document.querySelector("#fullscreen-map");
    const active = Boolean(document.fullscreenElement);
    button.setAttribute("aria-label", active ? "Exit map full screen" : "Enter map full screen");
    button.title = active ? "Exit full screen" : "Full screen map";
  });
  document.querySelector("#map-data-table-toggle").addEventListener("click", (event) => {
    state.mapDataTableOpen = !state.mapDataTableOpen;
    const panel = document.querySelector("#map-data-table-panel");
    panel.hidden = !state.mapDataTableOpen;
    event.currentTarget.setAttribute("aria-expanded", String(state.mapDataTableOpen));
    event.currentTarget.textContent = state.mapDataTableOpen ? "Hide map data table" : "View map data as a table";
    if (state.mapDataTableOpen) renderMapDataTable();
  });
  document.querySelector("#export-map-table").addEventListener("click", exportMapDataTable);
  document.querySelector("#compare-map-toggle").addEventListener("click", async () => {
    if (state.boundaryLevel !== "ADM3") {
      try {
        document.querySelector("#boundary-level").value = "ADM3";
        await changeBoundaryLevel("ADM3");
      } catch (error) {
        showToast(`Could not load municipality boundaries: ${error.message}`);
        return;
      }
    }
    state.comparisonMode = !state.comparisonMode;
    renderMapComparisonSelection();
  });
  document.querySelector("#map-compare-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-comparison-id]");
    if (!button) return;
    state.comparisonSelections = state.comparisonSelections.filter((id) =>
      id !== button.dataset.removeComparisonId
    );
    refreshMapStyles();
    renderMapComparisonSelection();
  });
  document.querySelector("#compare-map-action").addEventListener("click", () => {
    if (state.comparisonSelections.length < 2) return;
    state.comparisonMode = false;
    setView("comparisons");
    renderMapComparisonSelection();
  });
  document.querySelector("#download-profile").addEventListener("click", exportSelectedProfile);
  document.querySelector("#share-view-button").addEventListener("click", copyShareableViewLink);
  document.querySelector("#about-button").addEventListener("click", () => {
    const guide = document.querySelector("#indicator-guide");
    renderIndicatorGuide(document.querySelector("#indicator-guide-search").value);
    guide.showModal();
    document.querySelector("#indicator-guide-search").focus();
  });
  document.querySelector("#indicator-guide-close").addEventListener("click", () =>
    document.querySelector("#indicator-guide").close()
  );
  document.querySelector("#indicator-guide-search").addEventListener("input", (event) =>
    renderIndicatorGuide(event.target.value)
  );
  document.querySelector("#indicator-guide").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.querySelector("#sidebar-toggle").addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
    setTimeout(() => state.map?.invalidateSize(), 200);
  });
  document.querySelector("#mobile-menu").addEventListener("click", () => {
    document.body.classList.add("mobile-nav-open");
    document.querySelector("#mobile-scrim").hidden = false;
  });
  document.querySelector("#mobile-profile-toggle").addEventListener("click", () => {
    setMobileProfileOpen(!document.body.classList.contains("mobile-profile-open"));
  });
  document.querySelector("#mobile-scrim").addEventListener("click", () => {
    document.body.classList.remove("mobile-nav-open");
    document.querySelector("#mobile-scrim").hidden = true;
  });
  searchInput.addEventListener("input", () => {
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => renderSearchResults(searchInput.value), 120);
  });
  searchInput.addEventListener("focus", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchResults();
      searchInput.blur();
    } else if (event.key === "ArrowDown" && !searchResults.hidden) {
      event.preventDefault();
      updateActiveSearchResult(state.searchActiveIndex + 1);
    } else if (event.key === "ArrowUp" && !searchResults.hidden) {
      event.preventDefault();
      updateActiveSearchResult(state.searchActiveIndex - 1);
    } else if (event.key === "Enter") {
      const active = searchResults.querySelector(`#search-result-${state.searchActiveIndex}`);
      if (active) {
        event.preventDefault();
        active.click();
      }
    }
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    renderSearchResults("");
    searchInput.focus();
  });
  document.querySelector("#open-municipality-profile").addEventListener("click", () => {
    if (state.selected?.level !== "ADM3") return;
    const url = new URL(location.href);
    url.searchParams.set("geography", state.selected.id);
    url.searchParams.set("tab", "overview");
    url.hash = "dashboard";
    location.assign(url.href);
  });
  document.querySelector("#compare-profile-place").addEventListener("click", () => {
    if (state.selected?.level !== "ADM3") return;
    openComparisonWithMunicipality(state.selected.id);
  });
  document.querySelector("#breadcrumbs").addEventListener("click", (event) => {
    const button = event.target.closest(".crumb-button");
    if (!button) return;
    if (button.dataset.geographyRoot) {
      resetMapToNational();
      return;
    }
    const item = state.geographies.find((geography) =>
      geography.id === button.dataset.geographyId
    );
    if (item) void selectGeography(item);
  });
  document.querySelector("#geography-children").addEventListener("click", (event) => {
    const button = event.target.closest("[data-geography-id]");
    if (!button) return;
    const item = state.geographies.find((geography) => geography.id === button.dataset.geographyId);
    if (item) void selectGeography(item);
  });
  document.addEventListener("click", (event) => {
    const pinnedDetail = document.querySelector("#map-pinned-detail");
    const clickedMapArea = event.target instanceof Element && event.target.closest("#map .leaflet-interactive");
    if (pinnedDetail && !pinnedDetail.hidden && !pinnedDetail.contains(event.target) && !clickedMapArea) {
      closeMapPinnedDetail();
    }
    if (!event.target.closest(".global-search")) closeSearchResults();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

async function initialize() {
  const sharedParams = new URLSearchParams(location.search);
  const sharedLayer = sharedParams.get("layer");
  if (["boundaries", "population", "growth", "unemployment", "economy", "water", "electricity", "temperature", "precipitation", "airQuality"].includes(sharedLayer)) {
    state.mapLayer = sharedLayer;
  }
  const sharedCensusYear = Number(sharedParams.get("censusYear"));
  if ([2011, 2022].includes(sharedCensusYear)) state.censusMapYear = sharedCensusYear;
  const sharedBoundaryLevel = sharedParams.get("boundaryLevel");
  if (["ADM1", "ADM2", "ADM3"].includes(sharedBoundaryLevel)) state.boundaryLevel = sharedBoundaryLevel;
  if (["temperature", "precipitation"].includes(state.mapLayer)) {
    state.boundaryLevel = "ADM1";
    state.autoBoundaryDetail = false;
  }
  const sharedAutoDetail = sharedParams.get("autoDetail");
  if (sharedAutoDetail === "0" || sharedAutoDetail === "1") {
    state.autoBoundaryDetail = sharedAutoDetail === "1";
  } else if (["ADM1", "ADM2", "ADM3"].includes(sharedBoundaryLevel)) {
    state.autoBoundaryDetail = false;
  }
  if (["temperature", "precipitation"].includes(state.mapLayer)) state.autoBoundaryDetail = false;
  document.querySelector("#boundary-level").value = state.boundaryLevel;
  document.querySelector("#auto-boundary-detail").checked = state.autoBoundaryDetail;
  const sharedGdpYear = Number(sharedParams.get("gdpYear"));
  if (Number.isInteger(sharedGdpYear) && sharedGdpYear >= 2014 && sharedGdpYear <= 2024) state.economyMapYear = sharedGdpYear;
  const sharedQuarter = sharedParams.get("quarter");
  if (/^\d{4}Q[1-4]$/.test(sharedQuarter ?? "")) state.labourQuarter = sharedQuarter;
  bindEvents();
  updateNationalProfileSummary();
  renderNationalHighlights();
  renderNationalMetrics();
  renderNationalGdpHistory();
  renderDetail();
  updateNavigation();
  if (typeof L === "undefined") {
    document.querySelector("#map-loading").hidden = true;
    const error = document.querySelector("#map-error");
    error.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "The map library did not load. Check your connection and try again.";
    error.append(message);
    addRetryButton(error, () => window.location.reload());
    error.hidden = false;
    return;
  }

  state.map = L.map(mapElement, {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    minZoom: 4,
    maxZoom: 10,
    maxBounds: [[-36, 14], [-21, 34]],
    maxBoundsViscosity: 0.85
  });
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  L.control.scale({ imperial: false, position: "bottomright", maxWidth: 90 }).addTo(state.map);
  state.map.setView([-29, 24], 5);
  if ("ResizeObserver" in window) {
    state.mapResizeObserver = new ResizeObserver(() => state.map?.invalidateSize({ pan: false }));
    state.mapResizeObserver.observe(mapElement);
  }
  state.map.on("zoomend", () => {
    document.querySelector("#map-scale").textContent = state.map.getZoom().toFixed(1);
    syncBoundaryLevelToZoom();
  });

  try {
    const { health, sources, municipalities, geographies, collection } = await loadWorkspaceData();
    state.sources = sources;
    state.municipalities = municipalities;
    state.geographies = geographies;
    updateNationalProfileSummary();
    state.collections.set("ADM3", collection);
    state.autoBoundaryReady = true;
    let startupCollection = collection;
    if (state.boundaryLevel !== "ADM3") {
      try {
        startupCollection = await ensureBoundaryCollection(state.boundaryLevel);
      } catch {
        state.boundaryLevel = "ADM3";
      }
    }
    void loadLiveSourceData();
    void loadCensusMapData(state.censusMapYear);
    void loadProvincialLabourData();
    void loadProvincialGdpData(state.economyMapYear).then(() => {
      renderNationalMetrics();
      void loadNationalGdpHistory();
    });
    loadNationalDashboardEconomy();
    renderNationalHighlights();
    renderNationalMetrics();
    setMapLayer(startupCollection);
    if (["temperature", "precipitation"].includes(state.mapLayer)) void loadProvincialTemperatureData();
    if (state.mapLayer === "airQuality") void loadAirQualityData();
    renderMapComparisonSelection();
    syncBoundaryLevelToZoom();
    document.querySelector("#map-loading").hidden = true;
    document.querySelector("#boundary-count").textContent =
      `${startupCollection.features.length} ${state.boundaryLevel === "ADM1" ? "provinces" : state.boundaryLevel === "ADM2" ? "districts & metros" : "municipal boundaries"}`;
    document.querySelector("#map-location").textContent =
      `SOUTH AFRICA · ${health.boundaryLevels.ADM1} PROVINCES`;
    document.querySelector("#mobile-scrim").hidden = true;
    const params = sharedParams;
    const comparisonIds = [...new Set((params.get("compare") ?? "").split(",").filter(Boolean))]
      .filter((id) => state.municipalities.some((item) => item.id === id))
      .slice(0, 3);
    const requestedGeography = state.geographies.find((item) =>
      item.id === params.get("geography")
    );
    if (comparisonIds.length >= 2) {
      state.comparisonSelections = comparisonIds;
      const requestedReference = params.get("reference");
      state.comparisonReferenceId = comparisonIds.includes(requestedReference)
        ? requestedReference
        : comparisonIds[0];
      renderMapComparisonSelection();
      setView("comparisons");
    } else if (requestedGeography) {
      await selectGeography(requestedGeography, { focus: false });
      const requestedTab = params.get("tab");
      if (requestedTab && tabContent[requestedTab]) setTab(requestedTab);
    }
    const requestedView = params.get("view");
    if (requestedView && Object.hasOwn(viewCopy, requestedView) && requestedView !== "comparisons" && !comparisonIds.length) {
      setView(requestedView);
    }
  } catch (error) {
    document.querySelector("#map-loading").hidden = true;
    const mapError = document.querySelector("#map-error");
    mapError.replaceChildren();
    const message = document.createElement("p");
    message.textContent = `Map data could not be loaded: ${error.message}`;
    mapError.append(message);
    addRetryButton(mapError, () => window.location.reload());
    mapError.hidden = false;
    showToast("Map data could not be loaded. You can try again from the map.");
  }
}

initialize();
