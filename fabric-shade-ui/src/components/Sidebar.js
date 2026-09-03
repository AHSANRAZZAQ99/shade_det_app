import React from "react";

const items = [
  { label: "Dashboard", icon: "▣" },
  { label: "Camera Feed", icon: "◫" },
  { label: "Defect History", icon: "◷" },
  { label: "Daily Dataset", icon: "◴" },
  { label: "Settings", icon: "⚙" }
];

function Sidebar({ activeItem = "Dashboard", onSelect }) {
  return (
    <aside className="w-full bg-gradient-to-b from-steel-700 to-steel-600 p-2 text-white md:w-[210px]">
      <nav className="space-y-1.5 pt-0.5">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => onSelect?.(item.label)}
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-[18px] font-semibold leading-none transition ${
              activeItem === item.label
                ? "border-blue-300/30 bg-gradient-to-b from-blue-500 to-blue-600 shadow"
                : "border-white/10 bg-[#173b66] hover:bg-[#1d487d]"
            }`}
            type="button"
          >
            <span className="text-base opacity-90">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;