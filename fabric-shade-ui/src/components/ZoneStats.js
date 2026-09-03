import React from "react";

function ZoneStats({ rows = [] }) {
  const defaultRows = [
    { zone: "LEFT", variation: 0 },
    { zone: "CENTER", variation: 0 },
    { zone: "RIGHT", variation: 0 },
    { zone: "OVERALL", variation: 0 }
  ];

  const safeRows = rows.length > 0
    ? rows
    : defaultRows;

  const getVariation = (zone) => {
    const row = safeRows.find((entry) => String(entry.zone).toUpperCase() === zone);
    return Number(row?.variation ?? row?.density ?? 0);
  };

  const metrics = [
    { label: "Left Zone Variation", zone: "LEFT", accent: "from-sky-50 to-sky-100" },
    { label: "Center Zone Variation", zone: "CENTER", accent: "from-emerald-50 to-emerald-100" },
    { label: "Right Zone Variation", zone: "RIGHT", accent: "from-amber-50 to-amber-100" },
    { label: "Overall Variation", zone: "OVERALL", accent: "from-rose-50 to-rose-100", wide: true }
  ];

  const getSeverityClasses = (value) => {
    if (value >= 4) {
      return "border-red-300 bg-red-50 text-red-700";
    }
    if (value >= 2) {
      return "border-amber-300 bg-amber-50 text-amber-700";
    }
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  };

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[#d9dde3] p-1 shadow-sm">
      <div className="mb-1 rounded border border-[#9ba9bc] bg-[#edf1f6] px-2 py-1 text-[18px] font-bold text-steel-700">
        Defect Analysis
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[#2c3f59] md:grid-cols-2">
        {metrics.map((metric) => {
          const variation = getVariation(metric.zone);
          const severity = getSeverityClasses(variation);
          return (
            <div
              key={metric.zone}
              className={`rounded border px-2 py-1.5 shadow-sm ${severity} ${metric.wide ? "md:col-span-2" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/55">{metric.label}</p>
                  <p className="mt-0.5 text-[20px] font-extrabold leading-none">{variation.toFixed(1)}%</p>
                </div>
                <div className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${severity}`}>
                  {variation >= 4 ? "High" : variation >= 2 ? "Moderate" : "Low"}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className={`h-full rounded-full ${variation >= 4 ? "bg-red-500" : variation >= 2 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, variation * 10)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ZoneStats;