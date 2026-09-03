import React, { createContext, useContext, useState, useCallback } from "react";

const ROIContext = createContext(null);

export function ROIProvider({ children }) {
  const [roi, setRoi] = useState(() => {
    try {
      const stored = window.localStorage.getItem("roi");
      return stored ? JSON.parse(stored) : { x: 100, y: 60, w: 300, h: 200 };
    } catch {
      return { x: 100, y: 60, w: 300, h: 200 };
    }
  });

  const updateRoi = useCallback((newRoi) => {
    setRoi(newRoi);
    try {
      window.localStorage.setItem("roi", JSON.stringify(newRoi));
    } catch (err) {
      console.warn("Failed to persist ROI to localStorage:", err);
    }
  }, []);

  const value = { roi, updateRoi };

  return <ROIContext.Provider value={value}>{children}</ROIContext.Provider>;
}

export function useROI() {
  const context = useContext(ROIContext);
  if (!context) {
    throw new Error("useROI must be used within ROIProvider");
  }
  return context;
}
