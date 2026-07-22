import { Router } from "express";
import { createRollSchema } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { createRoll, listPersonalRolls } from "../services/dice.service.js";
import { InvalidDiceFormulaError } from "../lib/dice.js";

export const rollsRouter = Router();

rollsRouter.use(requireAuth);

rollsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rolls = listPersonalRolls(req.session.userId!, limit);
  res.json({ rolls });
});

rollsRouter.post("/", async (req, res) => {
  const parsed = createRollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  try {
    const roll = await createRoll(null, req.session.userId!, parsed.data.formula, parsed.data.label);
    res.status(201).json({ roll });
  } catch (err) {
    if (err instanceof InvalidDiceFormulaError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
