// SRD 5.1 backgrounds (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// The free SRD document only publishes one full background -- Acolyte. The rest of the
// PHB backgrounds (Criminal, Folk Hero, Noble, Sage, Soldier, etc.) are not OGL content,
// so custom backgrounds (via the custom-content system) fill that gap.
export interface SrdBackground {
  id: string;
  name: string;
  skillProficiencies: string[];
  feature: string;
}

export const SRD_BACKGROUNDS: SrdBackground[] = [
  { id: "acolyte", name: "Acolyte", skillProficiencies: ["insight", "religion"], feature: "Shelter of the Faithful" },
];
