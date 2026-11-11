# CivicStats SA

**Understand South Africa through data.**

CivicStats SA is a read-only, browser-based public-data workspace for South African municipalities. It includes an interactive Leaflet map, all 213 municipal boundaries, Census population and household profiles, municipal electricity-for-lighting data, province-level GDP-R and unemployment indicators, National Treasury finance and audit data, IEC 2021 councillor seat counts, NASA POWER climate normals at representative boundary points, municipality search, a comparison workspace and a source catalogue. Data without a verified source remains unavailable rather than being replaced with placeholders.

## Run locally

Requirements: Node.js 20 or later. No package installation is required.

```powershell
npm start
```

Open <http://127.0.0.1:3000>. Set `PORT` to change the port. The server binds to loopback by default; set `HOST=0.0.0.0` only when intentionally exposing it on a trusted network.

The map and bundled data work from a static host such as GitHub Pages or VS Code Live Server at `frontend/html/index.html`. Bundled Census 2011/2022 profiles and map layers, provincial unemployment, provincial GDP-R, 2021 IEC seat counts, and all boundary levels load without a Node server. National Treasury finance, documents and capital acquisition, NASA POWER climate, World Bank indicators, and live publication feeds require the Node API; these views report when that API is unavailable instead of inventing or silently omitting data.

## GitHub Pages

The root `index.html` forwards visitors to the browser application at `frontend/html/index.html`. GitHub Pages serves static files only; it does not run `backend/server.js`. The app uses bundled datasets for Census profiles and map layers, provincial unemployment and GDP-R, and 2021 IEC seat counts. Treasury finance and capital-acquisition data, climate normals, World Bank indicators, and live publication feeds need a separately hosted Node API. Never point a public deployment at a developer's `127.0.0.1` address.

Run the API and data checks:

```powershell
npm test
```

## Working in this prototype

- Switch between province, district/metro and municipality boundaries; pan, zoom, hover and select features.
- View Census 2011 or 2022 population density, water-scheme household shares and household electricity-for-lighting shares across all 213 municipalities. Electricity for lighting is not described as grid connection or reliability. The map uses five quantile classes, shows exact values on hover and documents its source and definition.
- Switch to province boundaries for Stats SA GDP-R contribution-to-national-GDP shading and select any reporting year from 2014–2024. The Economy profile also shows nominal GDP, real growth and industry activity for each province; none of these are presented as municipal GDP.
- Search all 213 ADM3 features and open their boundary-based profiles.
- Open 2011/2022 Census population, age-band and household profiles for all 213 municipalities, including population, household and age comparisons.
- Explore Census household counts for dwelling type, water source, toilet type and cooking energy, plus the separate Stats SA municipal electricity-for-lighting indicator for 2011 and 2022. Household shares derived from counts are labelled as calculated; cooking energy is not conflated with lighting source.
- Switch the demographic and service profiles between the Census 2011 and 2022 reporting years, inspect the original source and extraction notes, and download the displayed indicator data as CSV.
- Browse municipality metadata, source provenance and a three-place comparison workspace. Gauteng focus entries open the corresponding municipality profile.
- View a spherical area calculation derived from each municipality's boundary polygon. The interface labels it as approximate and boundary-derived, not as an official published area.
- Compare Census 2011/2022 population and household indicators, including the separately sourced electricity-for-lighting share, for up to three municipalities; export values with source attribution. The comparison does not rank municipalities.
- Download the boundary directory or a selected municipality's available profile indicators as CSV.
- Profile tabs retain the selected geography. Finance includes separate budget/audited revenue, expenditure and surplus/deficit totals, plus source-line records. Economy shows Treasury-reported municipal revenue activity, World Bank national indicators and Stats SA provincial GDP-R, explicitly distinguishing each geography and measure.
- Politics & governance shows 2021 IEC elected-councillor seat counts for all 213 municipalities, separating ward and proportional-representation seats, with a CSV export and the source publication. It also shows Treasury-hosted audit opinions by reporting year and links to the IEC's 2026 results portal and current ward-councillor lookup.
- Documents & projects links the selected municipality's official website from the National Treasury directory, lists available Treasury-hosted Auditor-General report PDFs by financial year, and links to National Treasury and SALGA document libraries.
- The Projects subview retrieves National Treasury Capital Acquisition (v2) records for reporting years 2019 onward, separates budget and actual amount types, shows source categories in ZAR, and exports the filtered records to CSV. These are mSCOA capital-acquisition/asset-expenditure lines—not named infrastructure projects, delivery schedules, locations or contractor records.
- Switch the map boundary level to Provinces to map Stats SA's official quarterly unemployment estimates. Province profiles show the official rate, the broader LU3 rate and the available quarter-to-quarter series; the data are not inferred or downscaled to municipalities.
- Finance profiles also expose Treasury financial-position, capital-acquisition, government-grant, repairs-and-maintenance and UIFW records where the API reports numeric values. Each record type remains separate; missing source amounts are not converted to zero.
- Climate profiles load NASA POWER 25-year monthly temperature and precipitation climatology for a representative point within the selected province, district or municipality. Point-based grid estimates are explicitly not described as municipal area averages or weather-station observations.
- The source catalogue distinguishes the locally loaded boundary dataset, verified live integrations, and official portals that do not expose a verified public structured API.
- Reports and research show explicit empty states until verified publications are catalogued.

The current data boundary is explicit: the unemployment rate is available only at province level from Stats SA's Quarterly Labour Force Survey (QLFS), not for individual municipalities. Stats SA withdrew several Census 2022 themes, including employment, due to data-quality concerns; municipality-level employment counts and industry output are therefore not imported. Stats SA GDP-R provides provincial GDP and industry value added, not municipal GDP. The municipal electricity indicator is the household-reported main source for lighting, not a grid-connection or reliability measure. Census demographics and selected household-service indicators are available, as are live Treasury municipal financial facts, Treasury capital-acquisition categories and NASA POWER representative-point climate normals. The IEC seat counts are a historical 2021 snapshot and are not current officeholder or coalition data; current 2026 reports are linked from the official IEC portal but are not bundled. Named municipal project registers, status, contractor and geolocation data are not included. Documents are linked from official sites and the Treasury audit-report catalogue; IDPs, budgets and annual reports are not individually crawled or asserted where no direct source URL was returned. CivicScore is not calculated. There is no administrator portal, authentication, PostgreSQL connection or import workflow in this prototype.

## Live source integrations

- **National Treasury Municipal Money:** the server fetches municipality directory entries, annual income and expenditure, financial position, capital acquisition, government grants, repairs and maintenance, UIFW expenditure, and municipal audit-opinion records from its public API. Finance and audit records are available in the selected municipality's Finance profile. Documents & Projects links audit report PDFs where the API supplies them and the official municipal website where the Treasury directory lists it. Capital Acquisition (v2) provides Section 71 mSCOA records of capital asset purchase, repair and renewal by category; it is not a named project register. The API documents monetary values as integer South African rand (ZAR), not R'000. Revenue-line items are also summarized in the Economy profile as municipal financial flows, not local GDP or private-sector activity. Source periods, amount types, original report links and missing results are preserved; an empty response is not represented as a zero balance.
- **Auditor-General South Africa:** audit opinions and Treasury-hosted report links are delivered through the Treasury API and attributed to the relevant official source. This is not a separate AGSA API connection.
- **Electoral Commission of South Africa:** the [2021 elected-councillor list](https://www.elections.org.za/pw/Documents/LGE2021_Councillors_20_Nov_2021.pdf), published 20 November 2021, is aggregated by municipality and party into ward and PR seat counts for all 213 local and metropolitan municipalities. Councillor names and identifier fields are not retained. The [2026 election results portal](https://results.elections.org.za/home/Downloads/ME-Results) and [current ward-councillor lookup](https://www.elections.org.za/pw/StatsData/List-Of-Current-Ward-Councillors) are linked as official sources, but the platform does not claim their content as current integrated data. The IEC reported results declared 9 November 2026 and ordered a revote for one Siyancuma voting district on 10 November 2026; check the portal for updates.
- **South African Cities Network:** the Sources view fetches its public WordPress publications feed and links each result to the original publication.
- **Statistics South Africa:** Census population, age, household, dwelling, water, sanitation and cooking-energy tables are bundled for all 213 municipalities, with 2011 and 2022 reporting periods. The data are a cleaned extraction of [Census 2022: Provinces at a Glance](https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf), released 10 October 2023. The extraction and cleaning notes are in the [census-2022-muni-stats repository](https://github.com/afrith/census-2022-muni-stats). Stats SA is the original data source and is credited throughout. Its reuse terms require attribution and prohibit selling the original or reprocessed data without prior permission.
- **Municipal electricity for lighting:** a separate bundled extraction from Stats SA's [Census 2022 Municipal fact sheet (Report 03-01-82)](https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf) provides each municipality's 2011 and 2022 percentage of households reporting electricity as their main source of energy for lighting. This is not a measure of grid connection, electricity availability or service reliability. The values are available in the service-delivery profile, municipal map and comparison export; all 213 source rows are matched to the municipal Census codes and names.
- **Provincial economic activity:** [Stats SA's Provincial gross domestic product, 2024 (P0441.2)](https://www.statssa.gov.za/publications/P04412/P044122024.pdf), released 18 September 2025, provides provincial current-price GDP, contributions, real growth and industry value added for 2014–2024. The local extraction is [`provincial-gdp-r.json`](frontend/assets/data/provincial-gdp-r.json). Nominal current-price values, constant 2015-price GDP and real growth remain distinct. The map is province-only; no municipality GDP is inferred.
- **Employment and unemployment:** province-level official unemployment rates and LU3 estimates for Q3 2025, Q2 2026 and Q3 2026 are bundled from [Stats SA's QLFS Q3 2026 release](https://www.statssa.gov.za/publications/P0211/P02113rdQuarter2026.pdf), Table E, page 7 (released 10 November 2026). The map requires the Provinces boundary level. Rates are survey estimates, not municipality-level values; the Census CSV above does not include employment-status variables. The QLFS release lists the next quarter as forthcoming, so these data are not a live feed and require a verified update when a new release is published.
- **Climate:** monthly mean 2 m temperature and corrected precipitation climatology are requested from [NASA POWER](https://power.larc.nasa.gov/) on demand. The API reports a 25-year climatology period (January 2001–December 2025 in the current response). Coordinates come from a representative point inside the selected boundary; these gridded point values are not area-weighted municipal measurements or station observations.
- **National economy:** [World Bank World Development Indicators](https://data.worldbank.org/country/south-africa) provide South Africa's annual GDP in current US dollars, real GDP growth and agriculture, industry and services value-added shares. The series are retrieved from the public WDI API and are national-only; municipal Treasury revenues are not presented as GDP or private-sector activity.
- **SALGA:** its official publications and knowledge-hub portals are linked. No public structured municipal-indicator API has been verified, so the portal is not presented as an integrated dataset.
- Provider failures are shown explicitly. Provider responses are cached briefly to reduce repeat requests; no substitute statistics are used.

Live provider features require the Node API. In Live Server mode, keep it running on port `3000` (the local API permits the port-`5500` development origin). When using another frontend port or hostname, use the same origin as the API or update the development CORS allowlist in `backend/server.js` deliberately.

## Included boundary data

The three GeoJSON files in `frontend/assets/geojson/` contain South Africa ADM1 (9 provinces), ADM2 (52 districts and metropolitan areas) and ADM3 (213 local municipal / metro features). The release is served directly from the locally bundled files by the API.

- Dataset: [geoBoundaries South Africa](https://www.geoboundaries.org/api/current/gbOpen/ZAF/ADM3/)
- Source attribution: OCHA ROSEA and the South African Municipal Demarcation Board, via geoBoundaries.
- Boundary vintage represented: 2020. The geoBoundaries metadata reports source data updated 19 January 2023 and a build date of 12 December 2023.
- Licence: [Creative Commons Attribution 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).
- Download release used: [geoBoundaries commit `9469f09`](https://github.com/wmgeolab/geoBoundaries/tree/9469f09).

Boundary polygons are real sourced geometries, not hand-drawn shapes. Names and hierarchy in the interface are based on the feature properties and geographic containment. The boundary reference shown in a profile is a geoBoundaries feature identifier, not an official municipal code. Area is calculated with a spherical polygon formula from the boundary coordinates and is approximate; it is not an official municipal statistic.

## Included Census data

The three CSV files in `frontend/assets/data/` bundle municipality-level person indicators, broad age bands and household information for the 213 ADM3 municipalities represented in the Census extraction. The data cover Census 2011 and 2022 and are loaded locally by the Node API; they do not depend on Stats SA portal uptime.

- Original publisher: Statistics South Africa.
- Original publication: [Census 2022: Provinces at a Glance](https://census.statssa.gov.za/assets/documents/2022/Provinces_at_a_Glance.pdf), released 10 October 2023.
- Extraction notes: [afrith/census-2022-muni-stats](https://github.com/afrith/census-2022-muni-stats); the project README documents the manual extraction and Stats SA reuse terms.
- Municipalities are matched by normalized municipality name and province. Ten names that changed between the 2020 boundary vintage and the 2022 Census source use an explicit crosswalk to the Census municipal code.
- The original Stats SA data may not be sold, including as a reprocessed dataset, without prior permission. Obtain permission before selling or commercializing a product that redistributes these figures.

The additional [`electricity-lighting-muni.csv`](frontend/assets/data/electricity-lighting-muni.csv) contains the separate Stats SA Census municipal-fact-sheet indicator. Values are percentages for 2011 and 2022, not household counts. The source definition and limitations are returned by the API and shown alongside the profile and map.

## API

- `GET /api/health` — loaded boundary counts, Census, electricity and election municipality counts, and GDP-R province count.
- `GET /api/census/municipalities?year=2011|2022` — source-linked municipality population density, calculated household water-scheme shares and reported electricity-for-lighting shares.
- `GET /api/economy/provinces?year=2014..2024` — Stats SA GDP-R totals, contribution, real growth and industry activity for all nine provinces.
- `GET /api/municipalities/{id}/census` — municipality Census indicators with separate electricity-for-lighting source metadata.
- `GET /api/geo/ADM1|ADM2|ADM3` — a boundary FeatureCollection.
- `GET /api/municipalities?q=...` — municipality search and boundary-derived hierarchy.
- `GET /api/municipalities/:boundaryId` — geography metadata, an approximate boundary-derived area and explicit indicator availability.
- `GET /api/municipalities/:boundaryId/census` — the source-linked Census record for a municipality.
- `GET /api/sources` — source and licensing catalogue.
- `GET /api/integrations` — live connection checks and explicit portal-only statuses.
- `GET /api/municipalities/:boundaryId/finance?year=2024` — source-reported Treasury finance facts.
- `GET /api/municipalities/:boundaryId/audit?year=2024` — Treasury-published municipal audit opinions and report links.
- `GET /api/municipalities/:boundaryId/documents` — Treasury-listed official municipal website and available Auditor-General report links.
- `GET /api/municipalities/:boundaryId/projects?year=2024` — source-reported Capital Acquisition (v2) category records, not named infrastructure projects.
- `GET /api/municipalities/:boundaryId/politics` — historical 2021 IEC party seat counts, ward/PR split and current election source links.
- `GET /api/geographies/:level/:boundaryId/climate` — NASA POWER monthly temperature and precipitation climatology at a representative point in an ADM1, ADM2 or ADM3 boundary.
- `GET /api/economy/national` — World Bank national GDP, real GDP growth and sector-value-added time series.
- `GET /api/publications/sacn?limit=8` — South African Cities Network publications.

The API is intentionally read-only. Requests other than `GET` are rejected.

## Structure

```text
backend/server.js
frontend/
  assets/geojson/
  assets/data/
  css/app.css
  html/index.html
  js/app.js
tests/server.test.js
```

Leaflet and IBM Plex Sans are loaded from their public CDNs; the map itself uses the bundled GeoJSON and does not depend on third-party map tiles.

## Before a public-data launch

Add reviewed, period-aligned source datasets and their provenance before enabling additional thematic map layers, charts, rankings or CivicScore. A production service also needs a persistent database, authenticated and audited administration, validated imports, operational monitoring and deployment-specific security review. Those capabilities are outside this first runnable prototype.
