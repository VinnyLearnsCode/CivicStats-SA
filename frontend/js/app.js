const state = {
  view: "dashboard",
  tab: "overview",
  boundaryLevel: "ADM3",
  mapLayer: "population",
  censusMapRecords: new Map(),
  censusMapYear: 2022,
  censusMapRequestId: 0,
  censusMapError: null,
  censusMapLoading: false,
  provincialEconomyData: null,
  economyMapYear: 2024,
  economyMapRequestId: 0,
  economyMapError: null,
  economyMapLoading: false,
  economyLoadPromise: null,
  economyLoadYear: null,
  labourData: null,
  labourLoadPromise: null,
  labourMapRecords: new Map(),
  labourQuarter: "2026Q3",
  labourMapError: null,
  labourMapLoading: false,
  labourProfileRequestId: 0,
  selected: null,
  municipalities: [],
  sources: [],
  integrations: [],
  integrationError: null,
  publications: [],
  publicationError: null,
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
  overviewCensusRequestId: 0,
  profileSummaryRequestId: 0,
  comparisonRequestId: 0,
  comparisonErrors: new Map(),
  collections: new Map(),
  map: null,
  boundaryLayer: null,
  toastTimer: null
};

const tabContent = {
  overview: {
    kicker: "OVERVIEW",
    title: "At a glance",
    intro: "Explore this geography alongside the latest source-linked population and provincial labour indicators.",
    fields: [
      ["Province", "province"],
      ["District", "district"],
      ["Boundary level", "level"],
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
    kicker: "ECONOMY",
    title: "Economic activity & employment",
    description: "Stats SA provincial GDP-R and unemployment, alongside municipality-level Treasury financial flows. Provincial values are not downscaled to municipalities.",
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
  imports: ["Data imports", "Public data imports are not enabled in this read-only prototype"],
  profile: ["User profile", "No account data is collected by this prototype"],
  settings: ["Settings", "Workspace settings are not available in this read-only prototype"]
};

const mapElement = document.querySelector("#map");
const appRoot = new URL("../", document.currentScript.src);
const apiOrigin = location.port === "5500"
  ? `${location.protocol}//127.0.0.1:3000`
  : location.origin;
const profileName = document.querySelector("#profile-name");
const profileLocation = document.querySelector("#profile-location");
const detailBody = document.querySelector("#detail-body");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#global-search");
const searchResults = document.querySelector("#search-results");
const sectionTabs = document.querySelector("#section-tabs");
const workspaceGrid = document.querySelector("#workspace-grid");
const alternateView = document.querySelector("#alternate-view");

async function getJson(url) {
  const response = await fetch(new URL(url, apiOrigin), { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.json();
}

async function getStaticJson(path) {
  const response = await fetch(new URL(path, appRoot), { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load bundled data (${response.status}).`);
  return response.json();
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

function buildMunicipalityDirectory(municipalities, districts, provinces) {
  return municipalities.features.map((feature) => {
    const point = representativePoint(feature);
    const findParent = (collection) =>
      collection.features.find((candidate) =>
        point && pointInGeometry(point, candidate.geometry)
      )?.properties.shapeName ?? null;
    return {
      id: feature.properties.shapeID,
      name: feature.properties.shapeName,
      level: feature.properties.shapeType,
      province: findParent(provinces),
      district: findParent(districts),
      areaKm2: geometryAreaKm2(feature.geometry),
      areaMethod: "Approximate spherical area calculated from the geoBoundaries polygon."
    };
  });
}

async function loadStaticWorkspaceData() {
  const [sources, provinces, districts, collection] = await Promise.all([
    getStaticJson("assets/data-sources.json"),
    getStaticJson("assets/geojson/south-africa-adm1.geojson"),
    getStaticJson("assets/geojson/south-africa-adm2.geojson"),
    getStaticJson("assets/geojson/south-africa-adm3.geojson")
  ]);
  for (const [level, boundaries] of [["ADM1", provinces], ["ADM2", districts], ["ADM3", collection]]) {
    state.collections.set(level, boundaries);
  }
  return {
    health: {
      boundaryLevels: {
        ADM1: provinces.features.length,
        ADM2: districts.features.length,
        ADM3: collection.features.length
      }
    },
    sources,
    municipalities: buildMunicipalityDirectory(collection, districts, provinces),
    collection
  };
}

async function loadWorkspaceData() {
  if (appRoot.pathname.replace(/\/$/, "").endsWith("/frontend")) {
    return loadStaticWorkspaceData();
  }
  try {
    const [health, sourceResponse, municipalityResponse, collection] = await Promise.all([
      getJson("/api/health"),
      getJson("/api/sources"),
      getJson("/api/municipalities"),
      getJson("/api/geo/ADM3")
    ]);
    return { health, sources: sourceResponse.sources, municipalities: municipalityResponse.municipalities, collection };
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

function safeText(value) {
  return String(value ?? "—");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
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
  const pieces = ["South Africa"];
  if (state.selected?.province && state.selected.province !== "South Africa") pieces.push(state.selected.province);
  if (state.selected?.district && state.selected.district !== state.selected.name) pieces.push(state.selected.district);
  if (state.selected?.name && state.selected.name !== pieces.at(-1)) pieces.push(state.selected.name);
  if (state.view === "sources") pieces.push("Data sources");
  else if (state.view === "comparisons") pieces.push("Comparisons");
  else if (state.view === "municipalities") pieces.push("Municipalities");
  else if (state.view === "dashboard" && pieces.length === 1) pieces.push("National overview");
  breadcrumb.replaceChildren();
  pieces.forEach((piece, index) => {
    if (index) {
      const separator = document.createElement("span");
      separator.className = "crumb-separator";
      separator.textContent = "/";
      breadcrumb.append(separator);
    }
    const item = document.createElement("span");
    item.textContent = piece;
    if (index === pieces.length - 1) item.className = "crumb-current";
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
  const workspace = ["dashboard", "national", "workspace"].includes(state.view);
  workspaceGrid.hidden = !workspace;
  sectionTabs.hidden = !workspace;
  alternateView.hidden = workspace;
  updatePageHeading();
  updateBreadcrumb();
  updateNavigation();
  if (!workspace) renderAlternateView();
}

function setTab(tab) {
  if (!tabContent[tab]) return;
  state.tab = tab;
  state.view = "dashboard";
  workspaceGrid.hidden = false;
  sectionTabs.hidden = false;
  alternateView.hidden = true;
  renderDetail();
  updatePageHeading();
  updateBreadcrumb();
  updateNavigation();
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
    intro.textContent = content.intro;
    detailBody.append(intro);

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    const values = {
      province: state.selected?.province,
      district: state.selected?.district,
      level: state.selected ? formatBoundaryLevel(state.selected.level) : null,
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

  const civicScore = document.createElement("div");
  civicScore.className = "detail-item";
  civicScore.style.marginTop = "10px";
  civicScore.innerHTML = "<span>CIVICSCORE</span><strong>Not scored · insufficient data</strong>";
  detailBody.append(civicScore);
}

function formatCensusNumber(value, maximumFractionDigits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits }).format(value);
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
    addDetailMessage(detailBody, "Census dataset unavailable", `${error.message} Keep the Node API running with “npm start” and reload the page.`);
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

function renderOverviewCensus(selected) {
  const requestId = ++state.overviewCensusRequestId;
  const section = appendCensusSection(
    detailBody,
    "Verified indicators · Census 2022",
    "Official Stats SA municipal population and household counts. Provincial unemployment is shown separately in the profile."
  );
  addDetailMessage(section, "Loading Census data", `Loading the source-linked profile for ${selected.name}…`, "finance-loading");
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
    section.append(metrics);
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
    addDetailMessage(section, "Census data unavailable", `${error.message} Keep the Node API running with “npm start” and reload.`);
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
    addDetailMessage(detailBody, "Climate data unavailable", `${error.message} No substitute values were used. Keep the Node API running with “npm start” and retry.`);
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
      addDetailMessage(
        detailBody,
        "Treasury finance data unavailable",
        `No finance values were substituted. ${financeResult.reason.message} If using Live Server, start the API with “npm start” and reload.`
      );
    } else {
      renderFinanceRecords(detailBody, financeResult.value, typeSelect);
    }

    if (auditResult.status === "rejected") {
      addDetailMessage(detailBody, "Audit opinion unavailable", auditResult.reason.message);
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
    ? `${result.treasuryMunicipality.name} · reporting year ${result.year} · Treasury amounts are integer South African rand. Raw facts retain the source function, line item and amount type.`
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
        row["amount_type.code"] ?? "—",
        typeof amount === "number" && Number.isFinite(amount)
          ? new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2 }).format(amount)
          : "—"
      ].forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = String(value);
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
      addDetailMessage(section, "Supplemental Treasury data unavailable", `${dataset.error} The income and expenditure records above remain available independently.`);
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
    addDetailMessage(detailBody, "Treasury revenue data unavailable", `${error.message} No figures were substituted. If using Live Server, start the API with “npm start” and reload.`);
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
      addDetailMessage(detailBody, "Provincial unemployment data unavailable", `${state.labourMapError ?? "The local data endpoint did not return the Stats SA dataset."} Keep the Node API running with “npm start” and reload.`);
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
    addDetailMessage(section, "National economic indicators unavailable", `${error.message} No source substitution was used.`);
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
      addDetailMessage(section, "Provincial GDP-R unavailable", `${state.economyMapError ?? "The bundled Stats SA dataset could not be loaded."} No values were substituted.`);
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
      addDetailMessage(
        detailBody,
        "IEC councillor data unavailable",
        `${politicsResult.reason.message} No political representation values were substituted. If using Live Server, start the API with “npm start” and reload.`
      );
    } else {
      renderMunicipalCouncilSeats(detailBody, politicsResult.value);
    }

    if (auditResult.status === "rejected") {
      addDetailMessage(detailBody, `Audit opinion unavailable · FY ${state.politicsAuditYear}`, auditResult.reason.message);
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
    ["projects", "Capital projects & assets"]
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
      addDetailMessage(detailBody, "Municipal documents unavailable", `${error.message} No documents were substituted. If using Live Server, start the API with “npm start” and reload.`);
      addSourceLink(detailBody, "https://municipaldata.treasury.gov.za/", "Open National Treasury Municipal Money ↗");
    });
    return;
  }

  renderMunicipalProjects(selected, requestId, navigation);
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
    addDetailMessage(parent, "Capital acquisition data unavailable", `${error.message} No project or expenditure values were substituted. If using Live Server, start the API with “npm start” and reload.`);
    addSourceLink(parent, "https://municipaldata.treasury.gov.za/docs#cube-capital_v2", "Open National Treasury Capital Acquisition documentation ↗");
  });
}

function renderProjectRecords(parent, result, typeSelect) {
  parent.querySelectorAll(".projects-results").forEach((section) => section.remove());
  const output = document.createElement("section");
  output.className = "projects-results";
  const projectNote = document.createElement("p");
  projectNote.className = "finance-source-note project-scope-note";
  projectNote.textContent = "This is reported municipal capital acquisition and asset expenditure, not a named project register. The source does not identify project names, locations, schedules, contractors or completion status. Do not interpret accounting line items as individual infrastructure projects.";
  output.append(projectNote);

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
  if (!selected) return;
  profileName.textContent = selected.name;
  const location = [selected.province, selected.district]
    .filter((name, index, list) => name && name !== selected.name && list.indexOf(name) === index)
    .join(" · ");
  profileLocation.textContent = location || formatBoundaryLevel(selected.level);
  document.querySelector("#profile-code").textContent = selected.id || "Not published";
  document.querySelector("#profile-type").textContent = formatBoundaryLevel(selected.level).toUpperCase();
  document.querySelector("#profile-area").textContent = formatArea(selected.areaKm2);
  document.querySelector("#profile-area-note").textContent = selected.areaKm2 == null
    ? "Not calculated for this boundary"
    : "Spherical GeoJSON calculation · approximate";
  updateBreadcrumb();
  renderDetail();
  updatePageHeading();
  void updateProfileSummary(selected);

  if (state.boundaryLayer) {
    state.boundaryLayer.eachLayer((layer) => {
      const isSelected = layer.feature.properties.shapeID === selected.id;
      layer.setStyle(isSelected ? selectedStyle() : mapStyle(layer.feature));
      if (isSelected && state.boundaryLevel !== "ADM1") layer.bringToFront();
    });
  }
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
  population.textContent = "Loading…";
  populationNote.textContent = "Stats SA municipal profile";
  unemployment.textContent = "Loading…";
  unemploymentNote.textContent = "Stats SA QLFS · provincial estimate only";
  status.textContent = "LOADING VERIFIED INDICATORS";
  periodLabel.textContent = "—";
  statusDot.classList.add("muted");

  const censusRequest = selected.level === "ADM3"
    ? getMunicipalityCensus(selected.id)
    : Promise.resolve(null);
  const labourRequest = state.labourData
    ? Promise.resolve(state.labourData)
    : loadProvincialLabourData();
  const [censusResult, labourResult] = await Promise.allSettled([censusRequest, labourRequest]);
  if (requestId !== state.profileSummaryRequestId || state.selected?.id !== selected.id) return;

  let verifiedIndicators = 0;
  let censusLoaded = false;
  let censusPeriod = "";
  if (censusResult.status === "fulfilled" && censusResult.value?.census) {
    const indicators = censusResult.value.census.indicators;
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
    population.textContent = "Municipal only";
    populationNote.textContent = "Census profile figures are available at municipality level";
  } else {
    population.textContent = "Unavailable";
    populationNote.textContent = censusResult.status === "rejected"
      ? `Census request failed: ${censusResult.reason.message}`
      : "No Census record was returned for this municipality";
  }

  const labour = labourResult.status === "fulfilled" ? labourResult.value : null;
  const province = selected.level === "ADM1" ? selected.name : selected.province;
  const period = labour?.periods.find((item) => item.code === state.labourQuarter) ?? labour?.periods.at(-1);
  const labourRecord = labour?.records.find((record) =>
    record.province === province && record.quarter === period?.code
  );
  if (labourRecord && period) {
    unemployment.textContent = `${formatCensusNumber(labourRecord.officialRate, 1)}%`;
    unemploymentNote.textContent = `${province} · ${period.label} · province-level, not a municipal rate`;
    verifiedIndicators += 1;
  } else {
    unemployment.textContent = province ? "Unavailable" : "Province required";
    unemploymentNote.textContent = labour
      ? "Stats SA QLFS reports unemployment at province level only"
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
    censusLoaded ? "Stats SA Census 2022 municipal profile loaded." : "",
    labourRecord && period ? `Stats SA QLFS provincial estimate · ${period.label}.` : "",
    "National Treasury finance data loads on demand."
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

function selectedStyle() {
  return { color: "#57c7c1", weight: 2, opacity: 1, fillColor: "#40726c", fillOpacity: 0.43 };
}

function mapIndicatorValue(feature) {
  if (state.mapLayer === "unemployment") {
    if (feature.properties.shapeType !== "ADM1") return null;
    return state.labourMapRecords.get(feature.properties.shapeName)?.officialRate ?? null;
  }
  if (state.mapLayer === "economy") {
    if (feature.properties.shapeType !== "ADM1") return null;
    return state.provincialEconomyData?.records
      .find((record) => record.province === feature.properties.shapeName)?.gdpContributionPercent ?? null;
  }
  if (state.boundaryLevel !== "ADM3" || feature.properties.shapeType !== "ADM3") return null;
  const record = state.censusMapRecords.get(feature.properties.shapeID);
  if (!record) return null;
  return state.mapLayer === "population"
    ? record.populationDensityPerKm2
    : state.mapLayer === "water"
      ? record.waterSchemeSharePercent
      : state.mapLayer === "electricity"
        ? record.electricityLightingSharePercent
        : null;
}

function activeMapRecords() {
  if (state.mapLayer === "unemployment") return [...state.labourMapRecords.values()];
  if (state.mapLayer === "economy") return state.provincialEconomyData?.records ?? [];
  return [...state.censusMapRecords.values()];
}

function mapIndicatorBreaks() {
  const valueKey = state.mapLayer === "unemployment"
    ? "officialRate"
    : state.mapLayer === "economy"
      ? "gdpContributionPercent"
    : state.mapLayer === "population"
      ? "populationDensityPerKm2"
      : state.mapLayer === "electricity"
        ? "electricityLightingSharePercent"
        : "waterSchemeSharePercent";
  const values = activeMapRecords()
    .map((record) => record[valueKey])
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!values.length) return [];
  return Array.from({ length: 4 }, (_, index) =>
    values[Math.ceil(((index + 1) * values.length) / 5) - 1]
  );
}

function mapStyle(feature) {
  const style = baseStyle(feature);
  if (state.mapLayer === "boundaries") return style;
  const value = mapIndicatorValue(feature);
  if (value === null) return { ...style, fillOpacity: 0.05 };
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

function mapTooltip(feature) {
  const name = feature.properties.shapeName;
  if (state.mapLayer === "boundaries") return name;
  if (state.mapLayer === "unemployment") {
    if (feature.properties.shapeType !== "ADM1") return `${name} · select Provinces to show provincial estimates`;
    const record = state.labourMapRecords.get(name);
    if (!record) return `${name} · no provincial estimate for ${state.labourQuarter}`;
    const period = state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter;
    return `${name} · ${period} official unemployment rate: ${record.officialRate.toFixed(1)}%`;
  }
  if (state.mapLayer === "economy") {
    if (feature.properties.shapeType !== "ADM1") return `${name} · provincial GDP-R values only`;
    const record = state.provincialEconomyData?.records
      .find((item) => item.province === name);
    if (!record) return `${name} · no GDP-R data for ${state.economyMapYear}`;
    return `${name} · ${state.economyMapYear} share of national GDP: ${record.gdpContributionPercent.toFixed(1)}% · nominal GDP R${formatCensusNumber(record.gdpCurrentPricesRandMillions)} million`;
  }
  const record = state.censusMapRecords.get(feature.properties.shapeID);
  if (!record || feature.properties.shapeType !== "ADM3") return `${name} · municipality values only`;
  if (state.mapLayer === "population") {
    return `${name} · Census ${record.year} population density: ${formatCensusNumber(record.populationDensityPerKm2, 1)} people/km²`;
  }
  if (state.mapLayer === "electricity") {
    return `${name} · Census ${record.year}: ${formatCensusNumber(record.electricityLightingSharePercent, 1)}% of households reported electricity as their main lighting source`;
  }
  return `${name} · Census ${record.year} households reporting water scheme: ${formatCensusNumber(record.waterSchemeSharePercent, 1)}%`;
}

function renderMapLegend() {
  const heading = document.querySelector("#map-legend-heading");
  const items = document.querySelector("#map-legend-items");
  if (!heading || !items) return;
  items.replaceChildren();
  if (state.mapLayer === "boundaries") {
    heading.textContent = "BOUNDARY KEY";
    items.innerHTML = '<span><i class="legend-line active-line"></i>Selected municipality</span><span><i class="legend-line"></i>Municipal boundary</span><span class="legend-note">Real geoBoundaries polygons · 2020 vintage</span>';
    return;
  }
  if (state.mapLayer === "unemployment") {
    const period = state.labourData?.periods.find((item) => item.code === state.labourQuarter)?.label ?? state.labourQuarter;
    heading.textContent = `OFFICIAL UNEMPLOYMENT · ${period}`;
  } else if (state.mapLayer === "economy") {
    heading.textContent = `GDP CONTRIBUTION · ${state.economyMapYear}`;
  } else {
    heading.textContent = state.mapLayer === "population"
      ? `POPULATION DENSITY · CENSUS ${state.censusMapYear}`
      : state.mapLayer === "electricity"
        ? `ELECTRICITY FOR LIGHTING · CENSUS ${state.censusMapYear}`
        : `WATER SCHEME SHARE · CENSUS ${state.censusMapYear}`;
  }
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
    } else {
      note.textContent = state.censusMapError
        ? `Census layer unavailable: ${state.censusMapError}`
        : state.censusMapLoading
          ? "Loading verified Census municipality values…"
          : "Census map values are unavailable.";
    }
    items.append(note);
    return;
  }
  const values = records
    .map((record) => state.mapLayer === "unemployment"
      ? record.officialRate
      : state.mapLayer === "population"
        ? record.populationDensityPerKm2
        : state.mapLayer === "economy"
          ? record.gdpContributionPercent
          : state.mapLayer === "electricity"
            ? record.electricityLightingSharePercent
            : record.waterSchemeSharePercent)
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  const breaks = mapIndicatorBreaks();
  const colors = ["#29463d", "#3c6252", "#61836a", "#9d9861", "#c1814f"];
  colors.forEach((color, index) => {
    const row = document.createElement("span");
    row.className = "map-legend-range";
    const swatch = document.createElement("i");
    swatch.className = "map-legend-swatch";
    swatch.style.backgroundColor = color;
    const range = document.createElement("span");
    const upper = breaks[index] ?? values.at(-1);
    const precision = 1;
    const suffix = state.mapLayer === "population" ? "" : "%";
    if (index === 0) {
      range.textContent = `≤ ${formatCensusNumber(upper, precision)}${suffix}`;
    } else {
      const lower = breaks[index - 1];
      range.textContent = `${formatCensusNumber(lower, precision)}–${formatCensusNumber(upper, precision)}${suffix}`;
    }
    row.append(swatch, range);
    items.append(row);
  });
  const note = document.createElement("span");
  note.className = "legend-note";
  note.textContent = state.mapLayer === "unemployment"
    ? "Stats SA QLFS · province survey estimate; not municipal data."
    : state.mapLayer === "economy"
      ? "Stats SA GDP-R · provincial share of national nominal GDP; not municipal output."
    : state.mapLayer === "population"
      ? "Stats SA Census · derived population ÷ source area."
      : state.mapLayer === "electricity"
        ? "Stats SA Census · household share reporting electricity as the main lighting source; not connection or reliability."
        : "Stats SA Census · calculated share of households reporting water scheme.";
  items.append(note);
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
      if (state.selected) void updateProfileSummary(state.selected);
    });
  return state.labourLoadPromise;
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
      }
    });
  return state.economyLoadPromise;
}

function updateMapLayerControls() {
  const censusAvailable = state.censusMapRecords.size === state.municipalities.length && state.municipalities.length > 0;
  const unemploymentAvailable = state.labourMapRecords.size === 9;
  const provincialGdpAvailable = state.provincialEconomyData?.year === state.economyMapYear &&
    state.provincialEconomyData.records.length === 9;
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
    const provinceOnly = input.value === "unemployment" || input.value === "economy";
    const municipalOnly = ["population", "water", "electricity"].includes(input.value);
    const supported = provinceOnly || municipalOnly;
    const profileDataOnly = input.value === "finance";
    const available = input.value === "unemployment"
      ? unemploymentAvailable
      : input.value === "economy"
        ? provincialGdpAvailable
        : input.value === "electricity"
          ? electricityAvailable
          : municipalOnly
            ? censusAvailable
            : false;
    const requiredLevel = provinceOnly ? "ADM1" : "ADM3";
    const enabled = thematic && supported && available && state.boundaryLevel === requiredLevel;
    const loading = input.value === "unemployment"
      ? state.labourMapLoading
      : input.value === "economy"
        ? state.economyMapLoading
        : state.censusMapLoading;
    const error = input.value === "unemployment"
      ? state.labourMapError
      : input.value === "economy"
        ? state.economyMapError
        : state.censusMapError;
    input.checked = input.value === state.mapLayer;
    input.disabled = thematic && !enabled;
    const label = input.closest(".layer-option");
    label.title = !thematic
      ? "Official administrative boundary geometry"
      : !supported
        ? "Treasury finance facts load in municipality profiles on demand; no compatible finance map measure is loaded"
        : !available
            ? error
              ? `Verified source data unavailable: ${error}`
              : loading
                ? "Loading verified source data"
                : "Verified source data is unavailable"
            : state.boundaryLevel !== requiredLevel
              ? provinceOnly
                ? "Change the boundary level to Provinces; GDP-R and unemployment values are province-only"
                : "Change the boundary level to Municipalities to show Census indicators"
              : provinceOnly
                ? input.value === "unemployment"
                  ? `Statistics South Africa QLFS ${state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter} provincial data`
                  : `Statistics South Africa GDP-R ${state.economyMapYear} provincial GDP contribution`
                : input.value === "electricity"
                  ? `Stats SA Census ${state.censusMapYear} household share reporting electricity as the main lighting source; not connection status or reliability`
                : `Statistics South Africa Census ${state.censusMapYear} municipal data`;
    label.classList.toggle("unavailable", thematic && !enabled);
    label.classList.toggle("selected", input.value === state.mapLayer);
    const status = label.querySelector(".layer-state");
    if (thematic && profileDataOnly) status.textContent = "NO MAP DATA";
    else if (thematic && !supported) status.textContent = "NO DATA";
    else if (thematic && !available && loading) status.textContent = "LOADING";
    else if (thematic && !available) status.textContent = "NO DATA";
    else if (thematic && state.boundaryLevel !== requiredLevel) status.textContent = provinceOnly ? "PROVINCE ONLY" : "MUNICIPAL ONLY";
    else if (thematic && input.value === "unemployment") status.textContent = state.labourData?.periods.find((period) => period.code === state.labourQuarter)?.label ?? state.labourQuarter;
    else if (thematic && input.value === "economy") status.textContent = String(state.economyMapYear);
    else if (thematic) status.textContent = String(state.censusMapYear);
    else status.textContent = input.value === state.mapLayer ? "ACTIVE" : "";
  });
}

function refreshMapStyles() {
  state.boundaryLayer?.setStyle((feature) =>
    feature.properties.shapeID === state.selected?.id ? selectedStyle() : mapStyle(feature)
  );
  renderMapLegend();
  updateMapLayerControls();
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
    state.censusMapError = null;
    state.censusMapLoading = false;
    refreshMapStyles();
    renderNationalMetrics();
  } catch (error) {
    if (requestId !== state.censusMapRequestId) return;
    state.censusMapError = error.message;
    state.censusMapLoading = false;
    if (["population", "water", "electricity"].includes(state.mapLayer)) state.mapLayer = "boundaries";
    refreshMapStyles();
    renderNationalMetrics();
  }
}

function setMapLayer(collection) {
  if (state.boundaryLayer) state.map.removeLayer(state.boundaryLayer);
  state.boundaryLayer = L.geoJSON(collection, {
    style: (feature) => feature.properties.shapeID === state.selected?.id
      ? selectedStyle()
      : mapStyle(feature),
    onEachFeature: (feature, layer) => {
      const name = feature.properties.shapeName;
      layer.bindTooltip(mapTooltip(feature), { sticky: true, direction: "top" });
      layer.on({
        mouseover: () => {
          layer.setTooltipContent(mapTooltip(feature));
          if (feature.properties.shapeID !== state.selected?.id) {
            layer.setStyle({
              ...mapStyle(feature),
              color: "#b7c5bc",
              weight: 1.25,
              fillOpacity: state.mapLayer === "boundaries" ? 0.42 : 0.86
            });
          }
        },
        mouseout: () => {
          layer.setStyle(feature.properties.shapeID === state.selected?.id
            ? selectedStyle()
            : mapStyle(feature));
        },
        click: () => {
          const item = state.municipalities.find((municipality) =>
            municipality.id === feature.properties.shapeID
          );
          const selected = item ?? {
            id: feature.properties.shapeID,
            name,
            level: feature.properties.shapeType,
            province: feature.properties.shapeType === "ADM1" ? name : null,
            district: feature.properties.shapeType === "ADM2" ? name : null
          };
          updateProfile(selected);
          if (state.view !== "dashboard") setView("dashboard");
        }
      });
    }
  }).addTo(state.map);
  if (state.selected && state.boundaryLevel !== "ADM1") {
    state.boundaryLayer.eachLayer((layer) => {
      if (layer.feature.properties.shapeID === state.selected.id) layer.setStyle(selectedStyle());
    });
  }
  document.querySelector("#boundary-count").textContent =
    `${collection.features.length} ${state.boundaryLevel === "ADM1" ? "provinces" : "boundary features"}`;
  updateMapLayerControls();
  renderMapLegend();
  const bounds = state.boundaryLayer.getBounds();
  if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
}

async function changeBoundaryLevel(level) {
  if (!state.collections.has(level)) {
    const collection = await getJson(`/api/geo/${level}`);
    state.collections.set(level, collection);
  }
  state.boundaryLevel = level;
  const provinceLayer = ["unemployment", "economy"].includes(state.mapLayer);
  const municipalityLayer = ["population", "water", "electricity"].includes(state.mapLayer);
  if ((level !== "ADM1" && provinceLayer) || (level !== "ADM3" && municipalityLayer)) {
    state.mapLayer = "boundaries";
  }
  if (level === "ADM1") void loadProvincialGdpData(state.economyMapYear);
  setMapLayer(state.collections.get(level));
}

async function selectMunicipality(item) {
  let selected = item;
  if (item.areaKm2 === undefined) {
    try {
      const profile = await getJson(`/api/municipalities/${encodeURIComponent(item.id)}`);
      selected = profile.municipality;
    } catch (error) {
      showToast(`Could not load municipality profile: ${error.message}`);
    }
  }
  updateProfile(selected);
  if (state.view !== "dashboard") setView("dashboard");
  document.querySelector("#mobile-scrim").hidden = true;
  document.body.classList.remove("mobile-profile-open", "mobile-nav-open");
  if (state.boundaryLevel !== "ADM3") {
    document.querySelector("#boundary-level").value = "ADM3";
    await changeBoundaryLevel("ADM3");
  }
  if (state.map && state.boundaryLayer) {
    state.boundaryLayer.eachLayer((layer) => {
      if (layer.feature.properties.shapeID === item.id) {
        state.map.flyToBounds(layer.getBounds(), { padding: [55, 55], maxZoom: 8, duration: 0.6 });
      }
    });
  }
}

function renderFocusCards() {
  const focusMunicipalities = [
    { name: "City of Johannesburg", detail: "Metropolitan municipality · Gauteng" },
    { name: "City of Tshwane", detail: "Metropolitan municipality · Gauteng" },
    { name: "Ekurhuleni", detail: "Metropolitan municipality · Gauteng" }
  ];
  const cards = focusMunicipalities.map((focus) => {
    const municipality = state.municipalities.find((item) => item.name === focus.name);
    if (!municipality) {
      return `<article class="focus-card"><h3>${escapeHtml(focus.name)}</h3>
        <p>Boundary record is not available in the loaded dataset.</p></article>`;
    }
    return `<button class="focus-card" type="button" data-focus-id="${escapeHtml(municipality.id)}">
      <h3>${escapeHtml(municipality.name)}</h3>
      <p>${escapeHtml(focus.detail)}</p>
      <span class="focus-meta"><span class="focus-status">Boundary loaded</span><span>Open profile ↗</span></span>
    </button>`;
  }).join("");
  const grid = document.querySelector("#focus-grid");
  if (!grid) return;
  grid.innerHTML = cards;
  grid.querySelectorAll("[data-focus-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const municipality = state.municipalities.find((item) => item.id === button.dataset.focusId);
      if (municipality) void selectMunicipality(municipality);
    });
  });
}

function renderNationalMetrics() {
  const container = document.querySelector("#national-metrics");
  if (!container) return;
  const municipalityCount = state.municipalities.length;
  const censusLoaded = municipalityCount > 0 && state.censusMapRecords.size === municipalityCount;
  const unemploymentLoaded = state.labourMapRecords.size === 9;
  const censusStatus = censusLoaded
    ? `${state.censusMapRecords.size}/${municipalityCount}`
    : state.censusMapLoading
      ? "Loading"
      : state.censusMapError
        ? "Unavailable"
        : "—";
  const labourStatus = unemploymentLoaded
    ? `${state.labourMapRecords.size}/9`
    : state.labourMapLoading
      ? "Loading"
      : state.labourMapError
        ? "Unavailable"
        : "—";
  const metrics = [
    { label: "Provinces", value: "9", note: "Administrative regions" },
    { label: "Municipal boundaries", value: String(municipalityCount), note: "geoBoundaries ADM3 records" },
    { label: `Census ${state.censusMapYear}`, value: censusStatus, note: censusLoaded ? "municipal profiles loaded" : "Stats SA municipal records" },
    { label: "QLFS unemployment", value: labourStatus, note: "Stats SA provincial estimates" }
  ];
  container.innerHTML = metrics.map((metric) => `
    <article class="summary-card">
      <div class="label">${escapeHtml(metric.label)}</div>
      <strong>${escapeHtml(metric.value)}</strong>
      <span>${escapeHtml(metric.note)}</span>
    </article>
  `).join("");
}

function renderMunicipalityTable() {
  const rows = state.municipalities.map((item) => `
    <tr>
      <td><button data-select-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button></td>
      <td>${escapeHtml(item.province || "—")}</td>
      <td>${escapeHtml(item.district || "—")}</td>
      <td class="mono">${escapeHtml(item.level)}</td>
      <td class="mono">${escapeHtml(formatArea(item.areaKm2))}</td>
      <td><span class="status-pill">INDICATORS NOT LOADED</span></td>
    </tr>`).join("");
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
      ${source.dataUrl ? `<a href="${escapeHtml(source.dataUrl)}" target="_blank" rel="noopener noreferrer">Open original data ↗</a>` : ""}
      ${source.datasetUrl ? `<a href="${escapeHtml(source.datasetUrl)}" target="_blank" rel="noopener noreferrer">Open dataset extract ↗</a>` : ""}
      ${source.apiUrl ? `<a href="${escapeHtml(source.apiUrl)}" target="_blank" rel="noopener noreferrer">Open API ↗</a>` : ""}</article>`;
    })()}`).join("")}</div>`;
}

function renderCitiesNetworkPublications() {
  if (state.publicationError) {
    return `<section class="publication-section"><h3>South African Cities Network publications</h3><p class="finance-source-note">Live publication feed unavailable: ${escapeHtml(state.publicationError)}</p><a href="https://sacities.net/" target="_blank" rel="noopener noreferrer">Open South African Cities Network ↗</a></section>`;
  }
  if (!state.publications.length) {
    return `<section class="publication-section"><h3>South African Cities Network publications</h3><p class="finance-source-note">Loading the official public publications feed…</p></section>`;
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
  } else {
    state.publicationError = publicationResult.reason.message;
  }
  if (state.view === "sources") renderAlternateView();
}

function renderComparison() {
  const selectedIds = [state.selected?.id ?? "", "", ""];
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
    ["Population · 2011", "total_pop_2011"],
    ["Population · 2022", "total_pop_2022"],
    ["Reported population growth · 2011–2022", "growth_rate_2011_to_2022"],
    ["Households · 2011", "households_2011"],
    ["Households · 2022", "households_2022"],
    ["Average household size · 2022", "avg_household_size_2022"],
    ["Water scheme · 2022 share of households", "water_scheme_share_2022"],
    ["Flush toilet · 2022 share of households", "flush_toilet_share_2022"],
    ["Electricity used for cooking · 2022 share", "electricity_cooking_share_2022"],
    ["Electricity as main lighting source · 2022 household share", "electricity_lighting_share_2022"],
    ["School attendance · ages 5–24, 2022", "school_attendance_ages_5_to_24_2022"]
  ];
  const indicatorRows = indicators.map(([label, key]) =>
    `<tr><td>${label}</td>${selectedIds.map((_, index) =>
      `<td data-census-indicator="${key}" data-index="${index}">—</td>`
    ).join("")}</tr>`
  ).join("");
  return `<div class="compare-controls">${selectFields}<div class="view-actions"><button class="action-button" id="compare-export" disabled title="Export source-linked Census indicators for the selected municipalities">Export comparison data</button></div></div>
    <h3 class="comparison-subheading">Available geographic metadata</h3>
    <div class="data-table-wrap"><table class="data-table compare-table"><thead><tr><th>Property</th><th data-compare-heading="0">Geography 1</th><th data-compare-heading="1">Geography 2</th><th data-compare-heading="2">Geography 3</th></tr></thead><tbody>${metadataRows}</tbody></table></div>
    <h3 class="comparison-subheading">Census population &amp; households · 2011 and 2022</h3>
    <p class="source-check-note" id="compare-census-note">Population and household counts use the Stats SA Census extract; electricity for lighting uses the separate Stats SA municipal fact sheet. Shares retain their published definitions. Incompatible values are not ranked.</p>
    <div class="data-table-wrap"><table class="data-table compare-table"><thead><tr><th>Indicator</th><th data-indicator-heading="0">Geography 1</th><th data-indicator-heading="1">Geography 2</th><th data-indicator-heading="2">Geography 3</th></tr></thead><tbody>${indicatorRows}</tbody></table></div>`;
}

function renderAlternateView() {
  const [title, subtitle] = viewCopy[state.view] ?? viewCopy.dashboard;
  let content = "";
  if (state.view === "municipalities") {
    content = renderMunicipalityTable();
  } else if (state.view === "sources") {
    const connectionNote = state.integrationError
      ? `<div class="compare-empty">Live provider status unavailable: ${escapeHtml(state.integrationError)}. If this page is open in Live Server, start the API with <code>npm start</code>.</div>`
      : state.integrations.length
        ? `<p class="source-check-note">Provider status checked ${escapeHtml(new Date(state.integrations[0].checkedAt).toLocaleString("en-ZA"))}. A portal-only label means no public structured API has been verified.</p>`
        : `<p class="source-check-note">Checking live provider connections…</p>`;
    content = `${connectionNote}${renderSourceCards()}${renderCitiesNetworkPublications()}`;
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
  alternateView.innerHTML = `
    <header class="alternate-heading">
      <div><span class="panel-kicker">CIVICSTATS SA · ${escapeHtml(state.view.toUpperCase())}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
      <div class="view-actions">${state.view === "municipalities" ? '<button class="action-button" id="export-municipalities">Download boundary directory</button>' : ""}</div>
    </header>${content}`;

  alternateView.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.municipalities.find((municipality) => municipality.id === button.dataset.selectId);
      if (item) void selectMunicipality(item);
    });
  });
  const exportButton = document.querySelector("#export-municipalities");
  if (exportButton) exportButton.addEventListener("click", exportMunicipalityDirectory);
  if (state.view === "comparisons") initializeComparison();
}

function initializeComparison() {
  const selects = [...alternateView.querySelectorAll(".compare-select")];
  if (state.selected?.id && selects[0]) selects[0].value = state.selected.id;
  const exportButton = alternateView.querySelector("#compare-export");
  const update = () => {
    const requestId = ++state.comparisonRequestId;
    const selectedIds = selects.map((select) => select.value).filter(Boolean);
    const pending = [];
    selects.forEach((select, index) => {
      const item = state.municipalities.find((municipality) => municipality.id === select.value);
      const heading = item?.name ?? `Geography ${index + 1}`;
      alternateView.querySelector(`[data-compare-heading="${index}"]`).textContent = heading;
      alternateView.querySelector(`[data-indicator-heading="${index}"]`).textContent = heading;
      const values = {
        province: item?.province,
        district: item?.district,
        level: item ? formatBoundaryLevel(item.level) : null,
        id: item?.id,
        area: item?.areaKm2 == null ? null : formatArea(item.areaKm2)
      };
      alternateView.querySelectorAll(`[data-index="${index}"][data-comparison-field]`).forEach((cell) => {
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
    updateComparisonIndicators(selects);
    if (exportButton) exportButton.disabled = selectedIds.length === 0;
    if (pending.length) {
      void Promise.all(pending).then(() => {
        if (requestId === state.comparisonRequestId && state.view === "comparisons") {
          updateComparisonIndicators(selects);
        }
      });
    }
  };
  selects.forEach((select) => select.addEventListener("change", update));
  exportButton?.addEventListener("click", exportComparison);
  update();
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

function updateComparisonIndicators(selects) {
  const errors = [];
  selects.forEach((select, index) => {
    const id = select.value;
    const result = id ? state.censusCache.get(id) : null;
    const indicators = result?.census?.indicators ?? null;
    if (id && state.comparisonErrors.has(id)) {
      errors.push(`${state.municipalities.find((item) => item.id === id)?.name ?? "Selected municipality"}: ${state.comparisonErrors.get(id)}`);
    }
    alternateView.querySelectorAll(`[data-index="${index}"][data-census-indicator]`).forEach((cell) => {
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
  const note = alternateView.querySelector("#compare-census-note");
  if (note && errors.length) note.textContent = `Census comparison data could not be loaded: ${errors.join(" · ")}`;
}

async function exportComparison() {
  const selectedIds = [...alternateView.querySelectorAll(".compare-select")]
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
  rows.push(["CivicScore", "", "Not scored", "", "Insufficient verified indicators"]);
  downloadCsv(`civicstats-${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, rows);
  showToast("Municipality profile and available Census indicators downloaded with source attribution.");
}

function renderSearchResults(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    searchResults.hidden = true;
    searchResults.replaceChildren();
    return;
  }
  const matches = state.municipalities
    .filter((item) => item.name.toLocaleLowerCase().includes(normalized))
    .slice(0, 7);
  searchResults.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No municipality in the loaded boundaries matches that search.";
    searchResults.append(empty);
    searchResults.hidden = false;
    return;
  }
  matches.forEach((item) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.setAttribute("role", "option");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const place = document.createElement("small");
    place.textContent = [item.province, item.district].filter(Boolean).join(" · ");
    button.append(name, place);
    button.addEventListener("click", () => {
      searchInput.value = item.name;
      searchResults.hidden = true;
      void selectMunicipality(item);
    });
    searchResults.append(button);
  });
  searchResults.hidden = false;
}

function bindEvents() {
  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
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
    try {
      await changeBoundaryLevel(event.target.value);
    } catch (error) {
      showToast(`Unable to load boundaries: ${error.message}`);
    }
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
      state.mapLayer = input.value;
      refreshMapStyles();
    });
  });
  document.querySelector("#fit-map").addEventListener("click", () => {
    if (state.boundaryLayer?.getBounds().isValid()) {
      state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [30, 30], maxZoom: 6 });
    }
  });
  document.querySelector("#download-profile").addEventListener("click", exportSelectedProfile);
  document.querySelector("#about-button").addEventListener("click", () => {
    showToast("Census 2022 figures, provincial Stats SA labour estimates, Treasury financial data, NASA POWER climate normals, and South African Cities Network publications are available with source links.");
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
    document.body.classList.toggle("mobile-profile-open");
    document.querySelector("#mobile-scrim").hidden = !document.body.classList.contains("mobile-profile-open");
  });
  document.querySelector("#mobile-scrim").addEventListener("click", () => {
    document.body.classList.remove("mobile-nav-open", "mobile-profile-open");
    document.querySelector("#mobile-scrim").hidden = true;
  });
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("focus", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchResults.hidden = true;
      searchInput.blur();
    } else if (event.key === "Enter") {
      const first = searchResults.querySelector(".search-result");
      if (first) first.click();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-search")) searchResults.hidden = true;
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
  bindEvents();
  renderFocusCards();
  renderNationalMetrics();
  renderDetail();
  updateNavigation();
  if (typeof L === "undefined") {
    document.querySelector("#map-loading").hidden = true;
    const error = document.querySelector("#map-error");
    error.textContent = "The map library did not load. Check the connection to unpkg.com and reload the page.";
    error.hidden = false;
    return;
  }

  state.map = L.map(mapElement, {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: true,
    minZoom: 4,
    maxZoom: 10,
    maxBounds: [[-36, 14], [-21, 34]],
    maxBoundsViscosity: 0.85
  });
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  L.control.scale({ imperial: false, position: "bottomright", maxWidth: 90 }).addTo(state.map);
  state.map.setView([-29, 24], 5);
  state.map.on("zoomend", () => {
    document.querySelector("#map-scale").textContent = state.map.getZoom().toFixed(1);
  });

  try {
    const { health, sources, municipalities, collection } = await loadWorkspaceData();
    state.sources = sources;
    state.municipalities = municipalities;
    void loadLiveSourceData();
    void loadCensusMapData(state.censusMapYear);
    void loadProvincialLabourData();
    void loadProvincialGdpData(state.economyMapYear);
    state.collections.set("ADM3", collection);
    renderFocusCards();
    renderNationalMetrics();
    setMapLayer(collection);
    document.querySelector("#map-loading").hidden = true;
    document.querySelector("#boundary-count").textContent =
      `${health.boundaryLevels.ADM3} municipal boundaries`;
    document.querySelector("#map-location").textContent =
      `SOUTH AFRICA · ${health.boundaryLevels.ADM1} PROVINCES`;
    document.querySelector("#mobile-scrim").hidden = true;
    const johannesburg = state.municipalities.find((item) => item.name === "City of Johannesburg");
    if (johannesburg) updateProfile(johannesburg);
  } catch (error) {
    document.querySelector("#map-loading").hidden = true;
    const mapError = document.querySelector("#map-error");
    mapError.textContent = `Boundary data could not be loaded: ${error.message}`;
    mapError.hidden = false;
    showToast("Workspace data could not be loaded. Check that the bundled GeoJSON files are available.");
  }
}

initialize();
