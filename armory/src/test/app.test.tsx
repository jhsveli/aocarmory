import { describe, expect, it, beforeAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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

  /** Asserts the panel shows exactly these items' cards, in order. */
  function expectPinned(...names: HTMLElement[]) {
    const panel = screen.getByRole("region", { name: "Pinned items" });
    if (names.length === 0) {
      expect(within(panel).getByText("Click an item to see its details.")).toBeInTheDocument();
      return;
    }
    const cards = within(panel).getAllByRole("complementary", { name: "Item details" });
    expect(cards).toHaveLength(names.length);
    names.forEach((n, i) => expect(within(cards[i]).getAllByText(n.textContent!).length).toBeGreaterThan(0));
  }

  it("Shift-click adds items side by side; a plain click replaces them", () => {
    renderWithItems();
    const [first, second, third] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first);
    fireEvent.click(second, { shiftKey: true });
    expectPinned(first, second);

    fireEvent.click(third);
    expectPinned(third);
  });

  it("Shift-clicking an already-pinned item unpins it", () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(first, { shiftKey: true });
    expectPinned(second);
  });

  it("Pin-many mode makes plain clicks additive", () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(screen.getByRole("button", { name: /Pin many/ }));
    fireEvent.click(first);
    fireEvent.click(second);
    expectPinned(first, second);
  });

  it("highlights the Pin many button while Shift is physically held down", () => {
    renderWithItems();
    const btn = screen.getByRole("button", { name: /Pin many/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "Shift" });
    expect(btn).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyUp(window, { key: "Shift" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("shows Compare and Clear all only once 2+ items are pinned, and unpins via ×", () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    expect(screen.queryByRole("link", { name: /Compare \d+ items/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();

    fireEvent.click(second, { shiftKey: true });
    const link = screen.getByRole("link", { name: "Compare 2 items" });
    expect(link.getAttribute("href")).toMatch(/^\/compare\?items=\d+,\d+$/);

    fireEvent.click(screen.getByRole("button", { name: `Unpin ${second.textContent}` }));
    expectPinned(first);
    expect(screen.queryByRole("link", { name: /Compare \d+ items/ })).not.toBeInTheDocument();

    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expectPinned();
  });

  it("Back undoes a plain click that replaced several pinned items", () => {
    function BackButton() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate(-1)}>test back</button>;
    }
    render(
      <MemoryRouter initialEntries={["/s/1"]}>
        <TooltipProvider>
          <BackButton />
          <AppRoutes />
        </TooltipProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    const [first, second, third] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(third); // oops, forgot Shift
    expectPinned(third);

    fireEvent.click(screen.getByRole("button", { name: "test back" }));
    expectPinned(first, second);
  });

  it("keeps pinned items when moving to another section", async () => {
    renderWithItems();
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];
    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });

    fireEvent.click(screen.getAllByRole("link", { name: /./ }).find((a) => a.getAttribute("href") === "/s/2")!);
    expectPinned(first, second);
  });

  it("gives the armor builder its own single pinned item, ignoring Shift", () => {
    renderAt("/builder");
    fireEvent.change(screen.getByPlaceholderText("Find items to equip..."), {
      target: { value: "charred earth" },
    });
    const [first, second] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first);
    fireEvent.click(second, { shiftKey: true });
    const panels = screen.getAllByRole("complementary", { name: "Item details" });
    expect(panels).toHaveLength(1);
    expect(within(panels[0]).getByText(second.textContent!)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pin many/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Add item to compare" })).toBeInTheDocument();
  });

  it("keeps the Add item button on the heading row, unfiltered, when there are no items yet", () => {
    renderAt("/compare");
    const heading = screen.getByRole("heading", { name: "Compare items" });
    const addButton = within(heading.parentElement!).getByRole("button", { name: "Add item to compare" });

    fireEvent.click(addButton);
    expect(screen.getByPlaceholderText("Find an item to compare...")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(1); // unfiltered: candidates from every slot
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
    // the picker closes itself after adding — button reverts, panel is gone
    expect(screen.getByRole("button", { name: "Add item to compare" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Find an item to compare...")).not.toBeInTheDocument();
  });

  it("shows the four Same filters, default-checked, and toggling one updates its state", async () => {
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
    for (const name of ["slot", "armor type", "class", "rarity"]) {
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    }

    fireEvent.click(screen.getByRole("checkbox", { name: "rarity" }));
    expect(screen.getByRole("checkbox", { name: "rarity" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "slot" })).toBeChecked();
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
    expect(screen.getByRole("button", { name: "Add item to compare" })).toBeInTheDocument();
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

  it("Set main makes that item the main, shifting the old main to second", async () => {
    const location = renderWithLocation("/s/1");
    const expandButtons = screen.getAllByRole("button", { expanded: false });
    fireEvent.click(expandButtons[0]);
    fireEvent.click(expandButtons[1]);
    const [first, second, third] = screen.getAllByTestId("item-name") as HTMLElement[];

    fireEvent.click(first, { shiftKey: true });
    fireEvent.click(second, { shiftKey: true });
    fireEvent.click(third, { shiftKey: true });
    fireEvent.click(await screen.findByRole("link", { name: "Compare 3 items" }));
    await screen.findByRole("heading", { name: "Compare items" });
    const [a, b, c] = new URLSearchParams(location.current.split("?")[1]).get("items")!.split(",");

    // the current main has no Set main button
    expect(screen.queryByRole("button", { name: `Make ${first.textContent} the main item` }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Make ${third.textContent} the main item` }));

    expect(location.current).toBe(`/compare?items=${[c, a, b].join("%2C")}`);
    expect(screen.getAllByText(`Diff vs. ${third.textContent}`)).toHaveLength(2);
  });
});
