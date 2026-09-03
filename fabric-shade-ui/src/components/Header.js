import React, { useEffect, useState } from "react";
import axios from "axios";

const STATUS_URL = `${process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"}/api/status`;

function Header({ operatorName = "John" }) {
  const [backendStatus, setBackendStatus] = useState({
    label: "Checking backend...",
    online: false,
    recentDefects: 0,
    operatorName
  });
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      try {
        const response = await axios.get(STATUS_URL, { timeout: 3000 });
        const data = response.data || {};

        if (!mounted) {
          return;
        }

        setBackendStatus({
          label: data.ok ? "Backend Online" : "Backend Warning",
          online: Boolean(data.ok),
          recentDefects: Number(data.recentDefects || 0),
          operatorName: data.operatorName || operatorName
        });
      } catch {
        if (!mounted) {
          return;
        }

        setBackendStatus({
          label: "Backend Offline",
          online: false,
          recentDefects: 0,
          operatorName
        });
      }
    };

    loadStatus();

    const statusInterval = window.setInterval(loadStatus, 5000);
    const clockInterval = window.setInterval(() => setClock(new Date()), 1000);

    return () => {
      mounted = false;
      window.clearInterval(statusInterval);
      window.clearInterval(clockInterval);
    };
  }, [operatorName]);

  const formattedDate = clock.toLocaleString([], {
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <header className="flex h-14 items-center justify-between rounded-t-2xl bg-gradient-to-r from-steel-800 to-steel-700 px-4 text-white">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚙</span>
        <span className="text-[20px] font-bold leading-none">Factory Inspection System</span>
      </div>

      <div className="hidden items-center gap-3 text-[15px] font-semibold md:flex">
        <span>Batch #0421</span>
        <span className="text-steel-200">|</span>
        <span>
          Status: <span className={backendStatus.online ? "text-emerald-300" : "text-amber-300"}>{backendStatus.online ? "✔ System Ready" : "● Waiting For Backend"}</span>
        </span>
        <span className="text-steel-200">|</span>
        <span>
          API: <span className={backendStatus.online ? "text-emerald-300" : "text-red-300"}>{backendStatus.label}</span>
        </span>
        <span className="text-steel-200">|</span>
        <span>
          Recent Defects: <span className="text-steel-100">{backendStatus.recentDefects}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-[15px] font-semibold">
        <span className="hidden sm:inline">{formattedDate}</span>
        <span className="text-steel-200 hidden sm:inline">|</span>
        <span>Operator: {backendStatus.operatorName || operatorName}</span>
        <span className="text-sm">▼</span>
      </div>
    </header>
  );
}

export default Header;