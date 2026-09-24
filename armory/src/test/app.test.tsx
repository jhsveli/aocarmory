import { describe, expect, it, beforeAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "../components/ItemTooltip";
import { loadArmoryData } from "../data";
import { AppRoutes } from "../App";

beforeAll(() => loadArmoryData());

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

  it("Shift-clicking an item stages it for comparison instead of touching the right-side panel", async () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first); // plain click still pins to the panel
    fireEvent.click(second, { shiftKey: true });

    const panel = await screen.findByRole("complementary", { name: "Item details" });
    expect(within(panel).getByText(first.textContent!)).toBeInTheDocument();
    expect(within(panel).queryByText(second.textContent!)).not.toBeInTheDocument();

    const bar = screen.getByRole("group", { name: "Items to compare" });
    expect(within(bar).queryByText(first.textContent!)).not.toBeInTheDocument();
    expect(within(bar).getByText(second.textContent!)).toBeInTheDocument();
  });

  it("shows the compare bar only once 2+ items are staged, and removes items via their chip", async () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    expect(screen.queryByRole("group", { name: "Items to compare" })).not.toBeInTheDocument();

    fireEvent.click(first, { shiftKey: true });
    let bar = await screen.findByRole("group", { name: "Items to compare" });
    expect(screen.queryByRole("link", { name: /Compare \d+ items/ })).not.toBeInTheDocument();

    fireEvent.click(second, { shiftKey: true });
    bar = screen.getByRole("group", { name: "Items to compare" });
    const link = screen.getByRole("link", { name: "Compare 2 items" });
    expect(link.getAttribute("href")).toMatch(/^\/compare\?items=\d+,\d+$/);

    fireEvent.click(
      within(bar).getByRole("button", { name: `Remove ${second.textContent} from comparison` }),
    );
    expect(screen.queryByRole("group", { name: "Items to compare" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Compare \d+ items/ })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${first.textContent} from comparison` }),
    );
    expect(screen.queryByRole("group", { name: "Items to compare" })).not.toBeInTheDocument();
  });

  it("Shift-clicking an already-staged item removes it from the compare list", async () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    const bar = await screen.findByRole("group", { name: "Items to compare" });
    expect(within(bar).getByText(first.textContent!)).toBeInTheDocument();

    fireEvent.click(first, { shiftKey: true }); // toggle back off
    expect(within(bar).queryByText(first.textContent!)).not.toBeInTheDocument();
    expect(within(bar).getByText(second.textContent!)).toBeInTheDocument();
  });

  it("ignores Shift on the armor builder page, which has no compare-list UI to show it in", () => {
    renderAt("/builder");
    fireEvent.change(screen.getByPlaceholderText("Find items to equip..."), {
      target: { value: "charred earth" },
    });
    const name = screen.getAllByTestId("item-name")[0] as HTMLElement;

    fireEvent.click(name, { shiftKey: true });
    expect(screen.queryByRole("group", { name: "Items to compare" })).not.toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Item details" });
    expect(within(panel).getByText(name.textContent!)).toBeInTheDocument();
  });
});

describe("Compare page", () => {
  it("navigates from the compare bar to the dedicated compare page with both items", async () => {
    renderAt("/s/1");
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 2 items" }));

    expect(await screen.findByRole("heading", { name: "Compare items" })).toBeInTheDocument();
    expect(screen.getByText(first.textContent!)).toBeInTheDocument();
    expect(screen.getByText(second.textContent!)).toBeInTheDocument();
  });

  it("hides screenshots by default, loading one only once its link is clicked", async () => {
    renderAt("/s/1");
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 2 items" }));
    await screen.findByRole("heading", { name: "Compare items" });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const links = screen.getAllByRole("button", { name: "Original screenshot" });
    expect(links.length).toBeGreaterThan(0);

    fireEvent.click(links[0]);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Original screenshot" })).toHaveLength(links.length - 1);
  });

  it("skips unresolvable ids and prompts for more when fewer than 2 items resolve", () => {
    renderAt("/compare?items=999999999");
    expect(screen.getByRole("heading", { name: "Compare items" })).toBeInTheDocument();
    expect(screen.getByText(/Shift-click items/)).toBeInTheDocument();
  });

  it("removes an item via its own remove button without needing the staging list", async () => {
    renderAt("/s/1");
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 2 items" }));
    await screen.findByRole("heading", { name: "Compare items" });

    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${second.textContent} from comparison` }),
    );
    expect(screen.queryByText(second.textContent!)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item to compare" })).toBeInTheDocument();
  });

  it("offers same-slot items to add when the compare page has a single item, adding one on click", async () => {
    renderAt("/s/1");
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 2 items" }));
    await screen.findByRole("heading", { name: "Compare items" });
    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${second.textContent} from comparison` }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add item to compare" }));
    const input = screen.getByPlaceholderText("Find an item to compare...");
    const panel = input.closest("div") as HTMLElement;
    const candidateButtons = within(panel).getAllByRole("button");
    expect(candidateButtons.length).toBeGreaterThan(0);
    // the candidate never re-offers the item already being compared
    expect(within(panel).queryByText(first.textContent!)).not.toBeInTheDocument();

    const chosenName = candidateButtons[0].querySelector("span")!.textContent!;
    fireEvent.click(candidateButtons[0]);

    await screen.findByText(`Diff vs. ${first.textContent}`);
    expect(screen.getByText(chosenName)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add item to compare" })).not.toBeInTheDocument();
  });

  it("shows a diff box on both items when comparing exactly 2, each against the other", async () => {
    renderAt("/s/1");
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 2 items" }));
    await screen.findByRole("heading", { name: "Compare items" });

    expect(screen.queryByText("Main")).not.toBeInTheDocument();
    expect(screen.getByText(`Diff vs. ${second.textContent}`)).toBeInTheDocument();
    expect(screen.getByText(`Diff vs. ${first.textContent}`)).toBeInTheDocument();
  });

  it("marks item 0 as Main and only diffs the other items when comparing more than 2", async () => {
    renderAt("/s/1");
    const expandButtons = screen.getAllByRole("button", { expanded: false });
    fireEvent.click(expandButtons[0]);
    fireEvent.click(expandButtons[1]);
    const names = screen.getAllByTestId("item-name") as HTMLElement[];
    expect(names.length).toBeGreaterThanOrEqual(3);
    const [first, second, third] = names;

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(third, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 3 items" }));
    await screen.findByRole("heading", { name: "Compare items" });

    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getAllByText(`Diff vs. ${first.textContent}`)).toHaveLength(2);
  });
});
