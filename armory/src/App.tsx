import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "./components/ItemTooltip";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import SectionPage from "./pages/SectionPage";
import ArmorSetsPage from "./pages/ArmorSetsPage";
import FactionsPage from "./pages/FactionsPage";
import LinksPage from "./pages/LinksPage";
import AboutPage from "./pages/AboutPage";
import SearchPage from "./pages/SearchPage";
import BuilderPage from "./pages/BuilderPage";
import "./styles/armory.css";

/** Routes only — used by the app and by tests (which supply their own router). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="s/:id" element={<SectionPage />} />
        <Route path="sets" element={<ArmorSetsPage />} />
        <Route path="factions" element={<FactionsPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  );
}
