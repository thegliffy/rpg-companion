import type { ReactNode } from "react";
import type { RollDetailTerm } from "shared";
import { naturalD20 } from "shared";
import type { RollGroupResult } from "./DiceRollContext";
import "./dice.css";
import { modalOverlay as overlayStyle, modalDialog } from "../styles";
const dialogStyle = { ...modalDialog, width: "min(360px, 92vw)" };

// Above this many dice in one term, faces give way to a compact numbered grid (#137) -- a
// Meteor Swarm rolling 20d6 as twenty full polygons would overflow the box.
const COMPACT_THRESHOLD = 4;

function regularPolygonPoints(n: number, cx: number, cy: number, r: number, rotationDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = ((rotationDeg + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// One silhouette per common die size, sharing the same 0-100 viewBox; anything unusual (a
// homebrew percentile-style formula) falls back to a plain decagon rather than a special case.
function diePolygonPoints(sides: number): string {
  switch (sides) {
    case 4:
      return regularPolygonPoints(3, 50, 56, 48);
    case 6:
      return regularPolygonPoints(4, 50, 50, 46, -45);
    case 8:
      return regularPolygonPoints(8, 50, 50, 46);
    case 10:
      return regularPolygonPoints(10, 50, 50, 46);
    case 12:
      return regularPolygonPoints(12, 50, 50, 46);
    case 20:
      return "50,4 92,28 92,72 50,96 8,72 8,28";
    default:
      return regularPolygonPoints(10, 50, 50, 46);
  }
}

function DieFace({
  sides,
  value,
  kept = true,
  size = 84,
  animate,
}: {
  sides: number;
  value: number;
  // A die a modifier discarded (e.g. the dropped die in 4d6kh3) renders greyed-out with a strike
  // through the value rather than being omitted -- seeing what got dropped is the point.
  kept?: boolean;
  size?: number;
  animate: boolean;
}) {
  // Nat 20 / nat 1 highlighting (#141) -- applies to any d20, not just attack rolls: an ability
  // check, a save, a death save all get the same colour treatment now that the natural die is
  // addressable for any formula, not only a bare "1d20". A dropped die never counts as a nat 20/1
  // for highlighting purposes -- it wasn't the die that decided anything.
  const isNat20 = kept && sides === 20 && value === 20;
  const isNat1 = kept && sides === 20 && value === 1;
  const fill = !kept ? "var(--surface-sunken)" : isNat20 ? "var(--surface-sunken)" : isNat1 ? "var(--surface-sunken)" : "var(--surface-sunken)";
  const stroke = !kept ? "var(--border)" : isNat20 ? "var(--success)" : isNat1 ? "var(--danger)" : "var(--text-dim)";
  const textColor = !kept ? "var(--text-dim)" : isNat20 ? "var(--success)" : isNat1 ? "var(--danger)" : "var(--text)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`d${sides} showing ${value}${kept ? "" : ", dropped"}`}
      className={animate ? "dice-die-tumble" : undefined}
      opacity={kept ? 1 : 0.6}
    >
      <polygon points={diePolygonPoints(sides)} fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="600" fill={textColor}>
        {value}
      </text>
      {!kept && <line x1="14" y1="50" x2="86" y2="50" stroke={stroke} strokeWidth={4} />}
    </svg>
  );
}

function CompactDiceGrid({ term, animate }: { term: Extract<RollDetailTerm, { kind: "dice" }>; animate: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {term.dice.map((d, i) => (
        <span
          key={i}
          className={animate ? "dice-die-tumble" : undefined}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            borderRadius: 4,
            background: d.kept ? "var(--surface-sunken)" : "var(--surface-sunken)",
            color: d.kept ? "var(--accent)" : "var(--text-dim)",
            textDecoration: d.kept ? "none" : "line-through",
          }}
        >
          {d.value}
        </span>
      ))}
    </div>
  );
}

function termLabel(term: RollDetailTerm): string {
  if (term.kind === "dice") return `${term.dice.length}d${term.sides}`;
  if (term.kind === "constant") return "Bonus";
  return term.op;
}

function RollGroupCard({ group, onReroll, busy }: { group: RollGroupResult; onReroll: () => void; busy: boolean }) {
  const { roll } = group;
  const detail = roll.detail;

  return (
    <div style={{ borderTop: "1px solid var(--border-faint)", paddingTop: "0.6rem", marginTop: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{group.label}</p>
        <button
          type="button"
          onClick={onReroll}
          disabled={busy}
          title="Reroll"
          aria-label="Reroll"
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", padding: "0 0.2rem" }}
        >
          ↻
        </button>
      </div>

      {!detail ? (
        // Pre-#136 rolls (or anything the backend couldn't structure) fall back to the plain
        // breakdown text -- no face, no bonus lines, but never a broken-looking blank card.
        <p style={{ margin: "0.4rem 0 0" }}>{roll.breakdown}</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, padding: "0.5rem 0" }}>
            {detail.terms
              .filter((t): t is Extract<RollDetailTerm, { kind: "dice" }> => t.kind === "dice")
              .map((term, i) =>
                term.dice.length > COMPACT_THRESHOLD ? (
                  <CompactDiceGrid key={i} term={term} animate />
                ) : term.dice.length === 1 ? (
                  <DieFace key={i} sides={term.sides} value={term.dice[0].value} kept={term.dice[0].kept} animate />
                ) : (
                  <div key={i} style={{ display: "flex", gap: 4 }}>
                    {term.dice.map((d, j) => (
                      <DieFace key={j} sides={term.sides} value={d.value} kept={d.kept} size={48} animate />
                    ))}
                  </div>
                ),
              )}
          </div>

          <div style={{ fontSize: 14 }}>
            {detail.terms
              .filter((t) => t.kind !== "operator")
              .map((term, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span style={{ color: "var(--text-muted)" }}>{termLabel(term)}</span>
                  <span>{term.kind === "dice" ? term.subtotal : term.value}</span>
                </div>
              ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border-faint)",
                marginTop: 4,
                paddingTop: 4,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              <span>Total</span>
              <span>{roll.total}</span>
            </div>
          </div>
        </>
      )}

      {detail && naturalD20(detail) === 20 && <p style={{ margin: "0.3rem 0 0", color: "var(--success)", fontSize: 13 }}>Natural 20!</p>}
      {detail && naturalD20(detail) === 1 && <p style={{ margin: "0.3rem 0 0", color: "var(--danger)", fontSize: 13 }}>Natural 1.</p>}
    </div>
  );
}

export function DiceRollModal({
  title,
  groups,
  actions,
  onClose,
  onReroll,
}: {
  title: string;
  groups: RollGroupResult[];
  actions: ReactNode | null;
  onClose: () => void;
  onReroll: (group: RollGroupResult) => void;
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>

        {groups.length === 0 && <p style={{ color: "var(--text-dim)" }}>Rolling…</p>}

        {groups.map((g) => (
          <RollGroupCard key={g.id} group={g} onReroll={() => onReroll(g)} busy={false} />
        ))}

        {actions && <div style={{ marginTop: "0.75rem" }}>{actions}</div>}
      </div>
    </div>
  );
}
