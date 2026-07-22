import { useEffect, useState } from "react";
import type { CustomContent, CustomContentSystem } from "shared";
import * as customContentApi from "../api/customContent";

/**
 * Custom content visible to the current user (all approved, plus their own pending ones),
 * scoped to a single game system -- a PF2e or generic character never sees 5e homebrew races/
 * feats/etc. in its pickers, and vice versa.
 */
export function useCustomContent(system: CustomContentSystem = "dnd5e") {
  const [items, setItems] = useState<CustomContent[]>([]);

  useEffect(() => {
    customContentApi.listCustomContent().then(setItems).catch(() => {});
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
