import { DICE_MODEL_IDS, DICE_MODEL_LABELS, DICE_MODEL_DESCRIPTIONS, DICE_MODEL_SWATCHES } from "shared";
import { useDiceModel } from "../theme/DiceModelProvider";
import { cardRaised } from "../styles";

// Dice-shaped swatches, same reason as ThemePicker's literal colours: the picker has to render
// every model's look while a different model is applied, so it can't read the live --dice-*
// tokens. Colours are mirrored from dice.css -- keep the two in step.
function DieSwatch({ face, pip, edge }: { face: string; pip: string; edge: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill={face} stroke={edge} strokeWidth="6" strokeLinejoin="round" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="42" fontWeight="700" fill={pip}>
        20
      </text>
    </svg>
  );
}

export function DiceModelPicker() {
  const { diceModel, setDiceModel, saving } = useDiceModel();

  return (
    <div style={cardRaised}>
      <h2 style={{ marginTop: 0 }}>Dice model</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 0.6rem" }}>
        The set your dice are painted with in the roll modal. Follows your account, like the theme.
        {saving && " Saving…"}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {DICE_MODEL_IDS.map((id) => {
          const s = DICE_MODEL_SWATCHES[id];
          const selected = diceModel === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setDiceModel(id)}
              aria-pressed={selected}
              title={DICE_MODEL_DESCRIPTIONS[id]}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.35rem 0.6rem",
                borderWidth: selected ? 2 : 1,
                borderStyle: "solid",
                borderColor: selected ? "var(--accent)" : "var(--border)",
                background: "var(--surface-raised)",
                color: "var(--text)",
              }}
            >
              <DieSwatch face={s.face} pip={s.pip} edge={s.edge} />
              {DICE_MODEL_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
