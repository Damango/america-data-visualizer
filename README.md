# Income Atlas

An explorable map of U.S. household income. The national view colors each state by its statewide figure; click a state to fly in and see its counties, hover or click a county for detail, and switch between median household, per capita and mean household income.

```bash
bun install
bun run dev
```

- Page: http://localhost:3250 (set `PORT` to change)

## Data

U.S. Census Bureau, American Community Survey 5-year estimates, 2020–2024 (the latest release), statewide for all 50 states and DC, and for every county in California, Florida and Texas, plus 2010–2014 and 2015–2019 for the trend chart.

| Measure | Table |
| --- | --- |
| Median household income (and margin of error) | B19013 |
| Per capita income (and margin of error) | B19301 |
| Mean household income | B19025 aggregate ÷ B19001 households |
| Households by income bracket | B19001 |
| Gini index of income inequality | B19083 |
| Population | B01003 |

Each state is one file in `public/data/states/` and is listed in `public/data/manifest.json`. States without a file are drawn as blank outlines, and a state whose file has no counties shows statewide figures only.

County boundaries are the Census Bureau's 2023 cartographic boundaries (`public/geo/counties-10m.json`, from the `@severo_bo/us-atlas-2023` build of us-atlas), which match the 2024 ACS county list, including Connecticut's nine planning regions.

Sutton County, Texas (48435) has no income-bracket breakdown in this copy of the data; its other figures are present.

## Adding states

```bash
bun run fetch-data NY GA        # any two-letter state codes
CENSUS_API_KEY=... bun run fetch-data NY   # optional key: https://api.census.gov/data/key_signup.html
```

The script pulls the latest ACS 5-year release from the Census API, writes `public/data/states/<CODE>.json` and adds the state to the manifest. Running it for a state that's already there refreshes it in place.
