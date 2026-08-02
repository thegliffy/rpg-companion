import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  characterId: number;
  sectionId: string;
  title: ReactNode;
  /** When true, section defaults to expanded; when false, defaults to collapsed. */
  relevant: boolean;
  /** Shown in the collapsed one-line bar (e.g. "not used"). */
  summary?: string;
  children: ReactNode;
  style?: CSSProperties;
};

function storageKey(characterId: number) {
  return `rpg-companion:sheet-sections:${characterId}`;
}

function readOverride(characterId: number, sectionId: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(storageKey(characterId));
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return typeof map[sectionId] === "boolean" ? map[sectionId] : null;
  } catch {
    return null;
  }
}

function writeOverride(characterId: number, sectionId: string, expanded: boolean) {
  try {
    const key = storageKey(characterId);
    const raw = sessionStorage.getItem(key);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[sectionId] = expanded;
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

function clearOverride(characterId: number, sectionId: string) {
  try {
    const key = storageKey(characterId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, boolean>;
    delete map[sectionId];
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Collapsible sheet block: defaults open when `relevant`, collapsed otherwise.
 * Manual Show/Hide is remembered per character in sessionStorage. When a section
 * becomes newly relevant, a prior collapsed preference is cleared so it auto-expands.
 */
export function CollapsibleSection({
  characterId,
  sectionId,
  title,
  relevant,
  summary,
  children,
  style,
}: Props) {
  const [override, setOverride] = useState<boolean | null>(() => readOverride(characterId, sectionId));
  const [wasRelevant, setWasRelevant] = useState(relevant);

  useEffect(() => {
    setOverride(readOverride(characterId, sectionId));
  }, [characterId, sectionId]);

  useEffect(() => {
    if (relevant && !wasRelevant) {
      setOverride(null);
      clearOverride(characterId, sectionId);
    }
    setWasRelevant(relevant);
  }, [relevant, wasRelevant, characterId, sectionId]);

  const expanded = override ?? relevant;

  function setExpanded(next: boolean) {
    setOverride(next);
    writeOverride(characterId, sectionId, next);
  }

  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: expanded ? "0.5rem" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {!expanded && summary && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: "normal" }}>— {summary}</span>
          )}
        </div>
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      {expanded ? children : null}
    </div>
  );
}
