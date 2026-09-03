import React from "react";
import Dashboard from "./pages/Dashboard";
import { ROIProvider } from "./contexts/ROIContext";

function App() {
  return (
    <ROIProvider>
      <Dashboard />
    </ROIProvider>
  );
}

export default App;