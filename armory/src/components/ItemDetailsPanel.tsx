import { useItemDetails } from "./item-details.ts";
import ItemTooltipBox from "./ItemTooltipBox";

/**
 * The docked item-detail panel, rendered in-flow where a page places it
 * (typically the right column). Shows the click-pinned item's stats; a
 * placeholder while nothing is pinned. The floating hover tooltip is rendered
 * separately by TooltipProvider.
 */
export default function ItemDetailsPanel() {
  const { panelItem, clear } = useItemDetails();

  return (
    <aside className="itemPanel" aria-label="Item details">
      <div className="panelHeader">
        <span className="panelTitle">Item details</span>
        {panelItem && (
          <button
            type="button"
            className="panelClose"
            onClick={clear}
            aria-label="Close item details"
          >
            ✕
          </button>
        )}
      </div>
      {panelItem ? (
        <>
          <ItemTooltipBox item={panelItem} />
          {panelItem.image && (
            <div className="panelImage">
              <div className="panelImageLabel">Original screenshot</div>
              <img
                src={panelItem.image}
                alt={`Original screenshot: ${panelItem.name}`}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
        </>
      ) : (
        <div className="panelEmpty">Click an item to view its details.</div>
      )}
    </aside>
  );
}
