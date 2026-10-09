#!/usr/bin/env node
// Pulls county income data from the US Census Bureau API (ACS 5-year) and
// writes one JSON file per state into public/data/states/, plus a manifest.
//
//   node scripts/fetch-acs.mjs            # default states: CA FL TX
//   node scripts/fetch-acs.mjs NY GA      # add more states (merged into manifest)
//   CENSUS_API_KEY=... node scripts/fetch-acs.mjs
//
// A key is optional for light use; get one free at https://api.census.gov/data/key_signup.html

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data", "states");
const KEY = process.env.CENSUS_API_KEY?.trim();

const FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11",
  FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21",
  LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30",
  NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49",
  VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56",
};

// Household income brackets (table B19001, variables 002-017).
const BRACKETS = [
  "<$10k", "$10–15k", "$15–20k", "$20–25k", "$25–30k", "$30–35k", "$35–40k", "$40–45k",
  "$45–50k", "$50–60k", "$60–75k", "$75–100k", "$100–125k", "$125–150k", "$150–200k", "$200k+",
];
const bracketVars = BRACKETS.map((_, i) => `B19001_${String(i + 2).padStart(3, "0")}E`);

const CORE = {
  population: "B01003_001E",
  medianHH: "B19013_001E",
  medianHH_moe: "B19013_001M",
  perCapita: "B19301_001E",
  perCapita_moe: "B19301_001M",
  aggregateHH: "B19025_001E",
  households: "B19001_001E",
  gini: "B19083_001E",
};

// Three non-overlapping 5-year periods (e.g. 2010–14, 2015–19, 2020–24) for the trend chart.
const TREND_STEP = 5;
const TREND_POINTS = 3;

async function census(year, vars, geo) {
  const url = new URL(`https://api.census.gov/data/${year}/acs/acs5`);
  url.searchParams.set("get", ["NAME", ...vars].join(","));
  for (const [k, v] of Object.entries(geo)) url.searchParams.set(k, v);
  if (KEY) url.searchParams.set("key", KEY);
  const shown = url.toString().replace(KEY || "\0", "YOUR_KEY");
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Could not reach api.census.gov (${e.cause?.code ?? e.message}). Check your internet connection, VPN or firewall.\n  ${shown}`);
  }
  const text = await res.text();
  if (!res.ok || !text.trim().startsWith("[")) {
    // The API answers bad keys with an HTML page, so strip tags to show the actual message.
    const msg = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    const hint = /invalid key|key.*not.*activ/i.test(msg)
      ? "\n  Your key isn't working yet. Click the activation link in the email from the Census Bureau, then try again."
      : "";
    throw new Error(`Census API ${res.status}: ${msg || "(empty response)"}${hint}\n  ${shown}`);
  }
  const [header, ...rows] = JSON.parse(text);
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// ACS sentinel values (e.g. -666666666) mean "not available".
const num = (v) => {
  const n = Number(v);
  return v == null || !Number.isFinite(n) || n < -1e8 ? null : n;
};

async function latestVintage() {
  let lastError;
  for (let y = new Date().getFullYear(); y >= 2019; y--) {
    try {
      await census(y, ["B01003_001E"], { for: "state:06" });
      return y;
    } catch (e) {
      // A year that isn't released yet answers 404; anything else (bad key, network) is a real problem.
      if (!/Census API 404/.test(e.message)) throw e;
      lastError = e;
    }
  }
  throw new Error(`Could not find an ACS 5-year release.\n${lastError?.message ?? ""}`);
}

function shape(row) {
  const out = { name: row.NAME };
  for (const [k, v] of Object.entries(CORE)) out[k] = num(row[v]);
  out.meanHH = out.aggregateHH && out.households ? Math.round(out.aggregateHH / out.households) : null;
  out.brackets = bracketVars.map((v) => num(row[v]));
  delete out.aggregateHH;
  return out;
}

async function fetchState(abbr, year) {
  const st = FIPS[abbr];
  if (!st) throw new Error(`Unknown state ${abbr}`);
  const vars = [...Object.values(CORE), ...bracketVars];
  // The API caps each request at 50 variables; we use 24.
  const [stateRow] = await census(year, vars, { for: `state:${st}` });
  const countyRows = await census(year, vars, { for: "county:*", in: `state:${st}` });

  // Median household income over prior vintages (nominal dollars).
  const trend = { years: [], state: [], counties: {} };
  const byYear = [];
  for (let y = year - TREND_STEP * (TREND_POINTS - 1); y <= year; y += TREND_STEP) {
    try {
      const [s] = await census(y, ["B19013_001E"], { for: `state:${st}` });
      const cs = await census(y, ["B19013_001E"], { for: "county:*", in: `state:${st}` });
      trend.years.push(y);
      trend.state.push(num(s.B19013_001E));
      byYear.push(new Map(cs.map((c) => [st + c.county, num(c.B19013_001E)])));
    } catch (e) {
      console.warn(`  skip ${y}: ${e.message.split("\n")[0]}`);
    }
  }

  const counties = countyRows
    .map((r) => ({ fips: st + r.county, ...shape(r), name: r.NAME.split(",")[0] }))
    .sort((a, b) => a.fips.localeCompare(b.fips));
  for (const c of counties) trend.counties[c.fips] = byYear.map((m) => m.get(c.fips) ?? null);

  return {
    abbr,
    fips: st,
    name: stateRow.NAME,
    source: {
      survey: `American Community Survey 5-year estimates, ${year - 4}–${year}`,
      vintage: year,
      tables: ["B19013", "B19301", "B19025", "B19001", "B19083", "B01003"],
      api: `https://api.census.gov/data/${year}/acs/acs5`,
      fetchedAt: new Date().toISOString(),
      note: `Dollar values are in ${year} inflation-adjusted dollars; trend values are in each release's own dollars.`,
    },
    brackets: BRACKETS,
    state: shape(stateRow),
    counties,
    trend,
  };
}

async function main() {
  const states = process.argv.slice(2).map((s) => s.toUpperCase());
  if (!states.length) states.push("CA", "FL", "TX");
  await mkdir(OUT, { recursive: true });

  const year = await latestVintage();
  console.log(`Latest ACS 5-year release: ${year - 4}–${year}`);

  const manifestPath = join(OUT, "..", "manifest.json");
  let manifest = { states: {} };
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {}

  for (const abbr of states) {
    console.log(`Fetching ${abbr}…`);
    const data = await fetchState(abbr, year);
    await writeFile(join(OUT, `${abbr}.json`), JSON.stringify(data));
    manifest.states[abbr] = { fips: data.fips, name: data.name, vintage: year, counties: data.counties.length };
    console.log(`  ${data.counties.length} counties, median HH income $${data.state.medianHH?.toLocaleString()}`);
  }
  manifest.updatedAt = new Date().toISOString();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifestPath}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
