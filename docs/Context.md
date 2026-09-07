# AoC Armory

A web catalogue of Age of Conan items, restored from the archived AoC Armory site. Players browse items by game area and search them; each listing can be opened in an armor builder.

## Language

### Catalogue structure

**Section**:
A top-level bucket of item listings grouped by its reward source or game area (e.g. a faction, a zone, a PvE tier, PvP, Onslaught). Sections are what the site menu lists.
_Avoid_: Zone (a Section can span many zones), category

**Location**:
A concrete vendor, dungeon or raid within a Section that offers item listings (e.g. "Kara Korum :: Fengdu"). A location has a kind: merchant, dungeon or raid.
_Avoid_: Place, zone

**Category**:
A named group of sets sold or dropped together at a Location (e.g. "Dungeon Cloth Armor").

**Set**:
A named collection of Items that share a naming pattern and are usable by the classes in its class tag (e.g. the "Malice" set, tagged for Barbarians).
_Avoid_: Armor set (only when you specifically mean the all-class set pages)

**Item**:
A single purchasable or droppable piece of equipment/consumable in the catalogue, with a name and a rarity.
_Avoid_: Piece, gear

**Rarity**:
The item-quality colour tier (Mundane … Legendary) shown next to an Item name.

**Class tag**:
An abbreviated usability marker on a Set, e.g. `[HoX]` or `[Demo/Necro]`; slashes mean multiple classes can use it.

### Costs & currencies

**Purchase price**:
The cost to buy an Item from a vendor, expressed as one or more coin amounts.
_Avoid_: Price on its own (see flagged ambiguity), cost when you mean Vendor price

**Coin**:
A single currency denomination of a Purchase price, shown as its icon followed by an amount (e.g. "72 Simple Trophy I, 1 Gold"). The catalogue tracks coins beyond gold/silver: trophies (Rare Trophy; Simple Trophy I–III), relics (Rare Relic, Mythical Relic, Simple Relic I–VI), faction currencies (Mark of Acclaim, Campaign Badges, Conquest Trophies), zone shards/essences (Atlantean Shards, Dragon Tear, Emerald Essence, Shard of Pure Ice), and the metal coins Gold, Copper and Tin.

**Drop**:
Where an Item is obtained from combat/dungeons rather than bought. In the item listings a Drop is prefixed by a silver coin icon.
_Avoid_: Silver price, "priced in silver"

**Vendor price**:
The metal-denomination amount shown in an Item's tooltip, in Gold/Silver/Copper/Tin.
_Avoid_: Selling price, Purchase price

### Item information

**Tooltip**:
The structured in-game description of an Item, extracted from its screenshot, containing type, level/requirements, stats and flavour lines.

**Stat value**:
A numeric stat paired with its label in the Tooltip (e.g. Armor 512, Critigation Amount 277).

**Attribute**:
A bonus stat with a sign, e.g. "+42 Strength" or "+10% Out of Combat Movement Speed".

**Gem slot**:
A socket in an Item that accepts a gem, either a colour (Red, Blue, …) or a named slot (e.g. Kuthcheman, Onslaught, White Hand).

## Flagged ambiguities

- **"silver"**: In the section/item listings the silver coin icon marks a **Drop**, never a price in silver — the site does not price items in silver. Silver *is* a real denomination, but only inside **Vendor price** tooltip amounts. Disambiguate by context.
- **"price"**: Means two different things — **Purchase price** (what the vendor charges, may be faction coins/trophies/relics) vs **Vendor price** (the tooltip's Gold/Silver/Copper/Tin value). Prefer the qualified terms.
