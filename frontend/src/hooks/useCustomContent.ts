import { useEffect, useState } from "react";
import type { CustomContent, CustomContentSystem } from "shared";
import { customContentDataSchemaFor } from "shared";
import * as customContentApi from "../api/customContent";

/** A stored row's `data` is never re-validated on GET (the backend does a plain JSON.parse), so a
 * row written before a field existed is missing it at runtime even though the schema defaults it
 * -- every consumer of this hook casts `item.data as SomeData` with no runtime check, so a
 * component that reads a since-added field can crash on `undefined`. Re-parsing each item through
 * its own schema here, the one real choke point every consumer goes through, backfills every
 * missing field's default exactly once instead of teaching each consumer to tolerate partial
 * data. Falls back to the raw item on a genuine parse failure (should not happen -- every field
 * has a default) so content still shows up rather than silently vanishing from every picker. */
function backfillDefaults(items: CustomContent[]): CustomContent[] {
  return items.map((item) => {
    const parsed = customContentDataSchemaFor(item.type).safeParse(item.data);
    return parsed.success ? { ...item, data: parsed.data } : item;
  });
}

/**
 * Custom content visible to the current user (all approved, plus their own pending ones),
 * scoped to a single game system -- a PF2e or generic character never sees 5e homebrew races/
 * feats/etc. in its pickers, and vice versa.
 */
export function useCustomContent(system: CustomContentSystem = "dnd5e") {
  const [items, setItems] = useState<CustomContent[]>([]);

  useEffect(() => {
    customContentApi.listCustomContent().then((fetched) => setItems(backfillDefaults(fetched))).catch(() => {});
  }, []);

  const scoped = items.filter((i) => i.system === system);

  return {
    items: scoped,
    races: scoped.filter((i) => i.type === "race"),
    classes: scoped.filter((i) => i.type === "class"),
    backgrounds: scoped.filter((i) => i.type === "background"),
    subraces: scoped.filter((i) => i.type === "subrace"),
    subclasses: scoped.filter((i) => i.type === "subclass"),
    feats: scoped.filter((i) => i.type === "feat"),
    spells: scoped.filter((i) => i.type === "spell"),
    customItems: scoped.filter((i) => i.type === "item"),
    monsters: scoped.filter((i) => i.type === "monster"),
  };
}
