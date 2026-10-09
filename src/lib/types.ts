export interface Area {
  name: string;
  population: number | null;
  medianHH: number | null;
  medianHH_moe: number | null;
  perCapita: number | null;
  perCapita_moe: number | null;
  meanHH: number | null;
  households: number | null;
  gini: number | null;
  brackets: (number | null)[];
}

export interface County extends Area {
  fips: string;
}

export interface StateData {
  abbr: string;
  fips: string;
  name: string;
  source: {
    survey: string;
    vintage: number;
    tables: string[];
    api: string;
    fetchedAt: string;
    note: string;
  };
  brackets: string[];
  state: Area;
  counties: County[];
  trend: { years: number[]; state: (number | null)[]; counties: Record<string, (number | null)[]> };
}

export interface Manifest {
  states: Record<string, { fips: string; name: string; vintage: number; counties: number }>;
  updatedAt?: string;
}

export type MetricKey = "medianHH" | "perCapita" | "meanHH";

export const METRICS: Record<MetricKey, { label: string; short: string; table: string }> = {
  medianHH: { label: "Median household income", short: "Median household", table: "B19013" },
  perCapita: { label: "Per capita income", short: "Per capita", table: "B19301" },
  meanHH: { label: "Mean household income", short: "Mean household", table: "B19025 ÷ B19001" },
};
