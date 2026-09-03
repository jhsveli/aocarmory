import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "../components/ItemTooltip";
import { AppRoutes } from "../App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

/** Renders the app plus a hook that records the current router location. */
function renderWithLocation(path: string) {
  const location: { current: string } = { current: "" };
  function LocationProbe() {
    const loc = useLocation();
    location.current = loc.pathname + loc.search;
    return null;
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <LocationProbe />
        <AppRoutes />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return location;
}

describe("App rendering", () => {
  it("renders the home page with welcome text and stats", () => {
    renderAt("/");
    expect(screen.getByText("Welcome to the Age of Conan Armory")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
  });

  it("renders a section browse page with the section title", () => {
    renderAt("/s/1");
    expect(screen.getByRole("heading", { name: "Brittle Blade" })).toBeInTheDocument();
  });

  it("shows the class-usability view when ?view=class is set", () => {
    renderAt("/s/14?view=class");
    // HoX group with its full-name subtitle
    expect(screen.getByText("HoX")).toBeInTheDocument();
    expect(screen.getByText(/Herald of Xotli/)).toBeInTheDocument();
    // Ardent Fire set with its drop-location context label (several sets share
    // the same raid location, so there may be multiple context labels)
    expect(screen.getByText(/Ardent Fire/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kyllikki\/Yakhmar\/Vistrix/).length).toBeGreaterThan(0);
    // untagged sets are still reachable
    expect(screen.getByText("No class tag")).toBeInTheDocument();
  });

  it("toggles between drop-location and class views and updates the URL", () => {
    const location = renderWithLocation("/s/14");
    expect(screen.queryByText("HoX")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "By class" }));
    expect(screen.getByText("HoX")).toBeInTheDocument();
    expect(location.current).toBe("/s/14?view=class");

    fireEvent.click(screen.getByRole("button", { name: "By drop / location" }));
    expect(screen.queryByText("HoX")).not.toBeInTheDocument();
    expect(location.current).toBe("/s/14");
  });

  it("renders the armor sets page with classes", () => {
    renderAt("/sets");
    expect(screen.getByRole("heading", { name: "Armor Sets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assassin" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Barbarian" })).toBeInTheDocument();
  });

  it("renders the factions page with oppositions", () => {
    renderAt("/factions");
    expect(screen.getByRole("heading", { name: "Rise of the Godslayer Factions" })).toBeInTheDocument();
    expect(screen.getAllByText("vs").length).toBeGreaterThan(0);
  });

  it("renders search results for a query", () => {
    renderAt("/search?q=charred+earth");
    expect(screen.getByText(/match/)).toBeInTheDocument();
  });

  it("renders the armor builder page", () => {
    renderAt("/builder");
    expect(screen.getByRole("heading", { name: "Armor builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeInTheDocument();
  });

  it("loads a set from an ab= link in the armor builder", async () => {
    // Shattered Souls set captured from the archived site
    const ab =
      "eNoVilEKgDAMxa6krgr2nWbapxWGwqp4fedXEkj49RRj1TSjcA%2BVDp5Pa9JjdcatMmBhaUxwZlMRbGTrEW89%2FmH6AESrFvc%3D";
    renderAt(`/builder?ab=${ab}`);
    // the name appears both in the equipped tooltip box and the item link
    expect((await screen.findAllByText("Thug's Armbands of Shattered Souls")).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("Blade's Bracers of Shattered Souls").length)
      .toBeGreaterThan(0);
  });
});

describe("Item hover tooltip and detail panel", () => {
  /** Renders a section page and expands the first set so item names show. */
  function renderWithItems() {
    renderAt("/s/1");
    // set labels start collapsed — expand the first one to render its items
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const name = screen.getAllByTestId("item-name")[0] as HTMLElement;
    return { name, itemLabel: name.textContent! };
  }

  it("shows a floating tooltip on hover and hides it on leave", async () => {
    const { name, itemLabel } = renderWithItems();

    // hover shows the floating near-cursor tooltip
    fireEvent.mouseMove(name, { clientX: 120, clientY: 80 });
    const tip = await screen.findByRole("tooltip");
    expect(within(tip).getByText(itemLabel)).toBeInTheDocument();

    // leaving hides it — and hover never touches the right-side panel
    fireEvent.mouseLeave(name);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Item details" });
    expect(within(panel).queryByText(itemLabel)).not.toBeInTheDocument();
  });

  it("pins an item in the right-side panel on click and closes via the close button", async () => {
    const { name, itemLabel } = renderWithItems();

    fireEvent.click(name);
    const panel = await screen.findByRole("complementary", { name: "Item details" });
    expect(within(panel).getByText(itemLabel)).toBeInTheDocument();

    // the original tooltip screenshot is shown below the stats for comparison
    const img = within(panel).getByRole("img");
    expect(img.getAttribute("src")).toMatch(
      /^https:\/\/static\.is-better-than\.tv\/armory\//,
    );

    // the close button clears the panel
    fireEvent.click(within(panel).getByRole("button", { name: "Close item details" }));
    expect(within(panel).queryByText(itemLabel)).not.toBeInTheDocument();
  });

  it("unpins an item when it is clicked again", async () => {
    const { name, itemLabel } = renderWithItems();

    fireEvent.click(name); // pin
    const panel = await screen.findByRole("complementary", { name: "Item details" });
    expect(within(panel).getByText(itemLabel)).toBeInTheDocument();

    fireEvent.click(name); // unpin
    expect(within(panel).queryByText(itemLabel)).not.toBeInTheDocument();
  });
});
