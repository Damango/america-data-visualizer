import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  delay = 0,
  className = "",
  children,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  delay?: number;
  className?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="panel-sub">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "line" | "dot" | "bar" }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label} className="legend-item">
          <i className={`swatch ${i.kind ?? "dot"}`} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
