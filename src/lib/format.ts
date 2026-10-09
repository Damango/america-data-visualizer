export const usd = (v: number | null | undefined) =>
  v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US");

export const usdShort = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
};

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));

export const compact = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export const shortCounty = (name: string) => name.replace(/ (County|Parish|Borough|Census Area|Municipality|City and Borough|Planning Region)$/, "");
