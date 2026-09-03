import React, { useMemo, useState } from "react";

const HISTORY_LIMIT = 20;

function frameBackground(seed) {
  const shadeA = 52 + (seed % 20);
  const shadeB = 58 + (seed % 16);
  const shadeC = 64 + (seed % 14);
  return `linear-gradient(180deg, rgb(${shadeA}, ${shadeB}, ${shadeC}), rgb(${shadeA + 10}, ${shadeB + 10}, ${shadeC + 10}))`;
}

function PlaceholderFrame({ item, enlarged = false }) {
  const stripes = useMemo(
    () => Array.from({ length: enlarged ? 8 : 5 }, (_, index) => index),
    [enlarged]
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-sm" style={{ background: frameBackground(item.seed) }}>
      <div className="absolute inset-0 opacity-12">
        {stripes.map((stripe) => (
          <div
            key={stripe}
            className="absolute inset-y-0"
            style={{
              left: `${stripe * (100 / stripes.length)}%`,
              width: `${100 / (stripes.length * 2.1)}%`,
              background: "rgba(255,255,255,0.04)"
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}

function FrameImage({ item, enlarged = false }) {
  const imageSource = enlarged ? item.imageUrl || item.thumbnailUrl : item.thumbnailUrl || item.imageUrl;

  if (!imageSource) {
    return <PlaceholderFrame item={item} enlarged={enlarged} />;
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-sm bg-[#101010] ${
        enlarged ? "flex items-center justify-center" : ""
      }`}
    >
      <img
        src={imageSource}
        alt={`${item.zone} defect frame`}
        className={enlarged ? "max-h-full max-w-full object-contain" : "h-full w-full object-cover"}
        loading={enlarged ? "eager" : "lazy"}
      />
    </div>
  );
}

function ThumbnailCard({ item, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      className={`relative aspect-[3/4] overflow-hidden rounded-sm border text-left transition ${
        active ? "border-red-400" : "border-white/10 hover:border-white/20"
      }`}
      aria-label={`Open ${item.id} defect image`}
    >
      <FrameImage item={item} />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </button>
  );
}

function ExpandedViewer({ item, onClose }) {
  if (!item) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClose}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black px-2 py-2 text-left"
    >
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded border border-white/15 bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white animate-pulse">
        Click to close
      </div>

      <div className="flex h-full w-full min-h-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-2 text-white md:gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Defect Capture</p>
            <h4 className="text-sm font-bold md:text-base">{item.id.toUpperCase()} • {item.zone}</h4>
          </div>
          <div className="rounded border border-white/10 bg-black px-3 py-1 text-xs text-white/75">
            {item.time} | ΔE {item.deltaE.toFixed(2)} | Density {item.density.toFixed(2)}
          </div>
        </div>

        <div className="flex-1 min-h-0 max-h-[65vh] overflow-hidden rounded border border-white/10 bg-[#050505] p-2">
          <FrameImage item={item} enlarged />
        </div>
      </div>
    </button>
  );
}

function DefectHistory({ frames = [], onRefresh, errorMessage = "" }) {
  const [selectedId, setSelectedId] = useState(null);

  const selectedItem = frames.find((item) => item.id === selectedId) ?? null;

  const handleToggle = (id) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#1d2530] bg-black p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 px-1 pb-2">
        <div>
          <h3 className="text-[22px] font-bold uppercase tracking-wide text-white">Defect History</h3>
          <p className="text-xs text-white/45">Showing latest {HISTORY_LIMIT} realtime defect captures from backend.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-100 hover:bg-red-500/20"
          >
            Clear All
          </button>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/60">
            {frames.length} / {HISTORY_LIMIT} Captures
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {errorMessage && (
          <div className="rounded border border-red-300/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200">
            {errorMessage}
          </div>
        )}

        {selectedItem ? (
          <ExpandedViewer item={selectedItem} onClose={() => setSelectedId(null)} />
        ) : (
          <>
            {frames.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-white/10 bg-white/5 text-sm font-semibold text-white/50">
                Waiting for realtime defect captures from backend...
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-auto pr-1 sm:grid-cols-5 xl:grid-cols-8">
                {frames.map((item) => (
                  <ThumbnailCard
                    key={item.id}
                    item={item}
                    active={selectedId === item.id}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!selectedItem && (
          <p className="border-t border-white/10 pt-2 text-center text-xs uppercase tracking-[0.16em] text-white/35">
            Latest 20 remain here; older captures are moved by backend to daily timestamp folders.
          </p>
        )}
      </div>
    </section>
  );
}

export default DefectHistory;
