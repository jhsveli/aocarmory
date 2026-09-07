import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "./components/ItemTooltip";
import { loadArmoryData, useArmoryData } from "./data";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import SectionPage from "./pages/SectionPage";
import ArmorSetsPage from "./pages/ArmorSetsPage";
import FactionsPage from "./pages/FactionsPage";

import SearchPage from "./pages/SearchPage";
import BuilderPage from "./pages/BuilderPage";
import "./styles/global.css";

/** Routes only — used by the app and by tests (which supply their own router). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="s/:id" element={<SectionPage />} />
        <Route path="sets" element={<ArmorSetsPage />} />
        <Route path="factions" element={<FactionsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}

/** Fetches the (lazily loaded) dataset once and only then mounts the routes. */
function AppShell() {
  const data = useArmoryData();
  useEffect(() => {
    void loadArmoryData();
  }, []);
  if (!data.sections.length) {
    return <div className="page-intro" style={{ textAlign: "center", marginTop: "4rem" }}>Loading armory data…</div>;
  }
  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppShell />
      </TooltipProvider>
    </BrowserRouter>
  );
}
