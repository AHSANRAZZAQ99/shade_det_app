import React from "react";

function BatchSummary() {
  return (
    <section className="mt-3 rounded-lg border border-[var(--panel-border)] bg-[#d9dde3] p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-[#b9c2ce] pb-2">
        <h3 className="text-[30px] font-bold text-steel-700">Batch Summary</h3>
        <div className="flex gap-2 text-[#8694aa]">
          <span className="h-3 w-3 rounded-full bg-current" />
          <span className="h-3 w-3 rounded-full bg-current" />
          <span className="h-3 w-3 rounded-full bg-current" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-[26px] text-[#2f4561] sm:grid-cols-3">
        <div>
          Total Images: <span className="font-bold">50</span>
        </div>
        <div>
          Defects Found: <span className="font-bold">12</span>
        </div>
        <div>
          No Defects: <span className="font-bold">38</span>
        </div>
      </div>

      <div className="mt-3 h-8 overflow-hidden rounded border border-[#a9b8cb] bg-[#c0c9d6]">
        <div className="h-full w-4/5 bg-gradient-to-r from-[#79ca45] via-[#65be38] to-[#5caf30]" />
      </div>
    </section>
  );
}

export default BatchSummary;
