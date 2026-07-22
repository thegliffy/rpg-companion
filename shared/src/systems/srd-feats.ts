// SRD 5.1 feats (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// The free SRD only publishes one feat (Grappler). Custom feats fill the rest via the
// custom-content system. Name only here -- mechanical bonuses are entered per-feat.
export interface SrdFeat {
  id: string;
  name: string;
}

export const SRD_FEATS: SrdFeat[] = [
  { id: "grappler", name: "Grappler" },
];
