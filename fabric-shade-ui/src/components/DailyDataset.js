import React, { useEffect, useState } from "react";

function DailyDataset({ dailyDatasets = [], onRefresh, onDeleteImage, onDeleteFolder, errorMessage = "" }) {
  const [selectedDate, setSelectedDate] = useState("");
  const [deletingFolderDate, setDeletingFolderDate] = useState("");
  const [deletingImageKey, setDeletingImageKey] = useState("");

  const activeDate = selectedDate || dailyDatasets[0]?.date || "";
  const selectedFolder = dailyDatasets.find((item) => item.date === activeDate) || null;

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    const exists = dailyDatasets.some((item) => item.date === selectedDate);
    if (!exists) {
      setSelectedDate("");
    }
  }, [dailyDatasets, selectedDate]);

  const handleDeleteFolder = async (folderDate) => {
    if (!folderDate || !onDeleteFolder) {
      return;
    }

    const confirmed = window.confirm(`Delete folder ${folderDate} and all images inside it?`);
    if (!confirmed) {
      return;
    }

    setDeletingFolderDate(folderDate);
    try {
      await onDeleteFolder(folderDate);
    } finally {
      setDeletingFolderDate("");
    }
  };

  const handleDeleteImage = async (folderDate, imageId) => {
    if (!folderDate || !imageId || !onDeleteImage) {
      return;
    }

    const confirmed = window.confirm(`Delete image ${imageId}?`);
    if (!confirmed) {
      return;
    }

    const key = `${folderDate}::${imageId}`;
    setDeletingImageKey(key);
    try {
      await onDeleteImage(folderDate, imageId);
    } finally {
      setDeletingImageKey("");
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#1d2530] bg-black p-2 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-1 pb-2">
        <div>
          <h3 className="text-[22px] font-bold uppercase tracking-wide text-white">Daily Dataset</h3>
          <p className="text-xs text-white/45">Timestamp folder view from backend dataset storage.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10"
        >
          Refresh Folders
        </button>
      </div>

      {errorMessage && (
        <div className="mb-2 rounded border border-red-300/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 flex flex-col overflow-hidden rounded border border-white/10 bg-white/5 p-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55">Folders</p>

          <div className="flex-1 min-h-0 space-y-1 overflow-auto pr-1">
            {dailyDatasets.length === 0 && (
              <div className="rounded border border-white/10 bg-white/5 px-2 py-2 text-sm text-white/50">
                No daily timestamp folders returned by backend.
              </div>
            )}

            {dailyDatasets.map((item) => {
              const active = activeDate === item.date;
              const isDeletingFolder = deletingFolderDate === item.date;

              return (
                <div
                  key={item.date}
                  className={`w-full rounded border p-2 text-xs transition ${
                    active
                      ? "border-blue-300/40 bg-blue-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/75"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDate(item.date)}
                    className="w-full text-left"
                  >
                    <p className="font-semibold">{item.date}</p>
                    <p className="mt-1 text-[11px] text-white/55">{item.count} images</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(item.date)}
                    disabled={isDeletingFolder}
                    className="mt-2 w-full rounded border border-red-300/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingFolder ? "Deleting Folder..." : "Delete Folder"}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-h-0 overflow-hidden rounded border border-white/10 bg-white/5 p-2">
          {!selectedFolder ? (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-white/50">
              Select a daily folder to view saved defect images.
            </div>
          ) : (
            <>
              <div className="mb-2 rounded border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/70">
                <p>Date: <span className="font-semibold text-white">{selectedFolder.date}</span></p>
                <p className="mt-1">Path: <span className="font-semibold text-white/85">{selectedFolder.path || "(from backend storage root)"}</span></p>
                <p className="mt-1">Total Images: <span className="font-semibold text-white">{selectedFolder.count}</span></p>
              </div>

              <div className="grid min-h-0 max-h-full grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
                {(selectedFolder.samples || []).map((sample) => {
                  const imageDeleteKey = `${selectedFolder.date}::${sample.id}`;
                  const isDeletingImage = deletingImageKey === imageDeleteKey;

                  return (
                  <div key={sample.id} className="overflow-hidden rounded border border-white/10 bg-black/40">
                    {sample.thumbnailUrl || sample.imageUrl ? (
                      <img
                        src={sample.thumbnailUrl || sample.imageUrl}
                        alt={`Saved defect ${sample.id}`}
                        className="aspect-[3/4] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-gradient-to-b from-[#394a5e] to-[#2a3748]" />
                    )}
                    <div className="px-2 py-1 text-[11px] text-white/70">
                      <p className="truncate font-semibold text-white">{sample.id}</p>
                      <p>{sample.time || "--:--:--"}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(selectedFolder.date, sample.id)}
                        disabled={isDeletingImage}
                        className="mt-1 w-full rounded border border-red-300/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeletingImage ? "Deleting..." : "Delete Image"}
                      </button>
                    </div>
                  </div>
                );})}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default DailyDataset;
