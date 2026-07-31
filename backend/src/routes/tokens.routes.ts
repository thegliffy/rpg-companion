import { Router } from "express";
import { createApiTokenSchema } from "shared";
import { requireAuth, requireSessionAuth } from "../middleware/auth.js";
import { createApiToken, listApiTokens, deleteApiToken } from "../services/apiTokens.service.js";

export const tokensRouter = Router();

// requireSessionAuth on the whole router (#148): a token authenticates as its owner and inherits
// their role everywhere else in the app, but this is the one place that's deliberately not
// honoured. A leaked token must not be able to mint itself successors or enumerate the owner's
// other tokens -- otherwise revoking the one you know about achieves nothing.
tokensRouter.use(requireAuth, requireSessionAuth);

tokensRouter.get("/", (req, res) => {
  res.json({ tokens: listApiTokens(req.authUserId!) });
});

tokensRouter.post("/", async (req, res) => {
  const parsed = createApiTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const created = await createApiToken(req.authUserId!, parsed.data.name, parsed.data.expiresInDays);
  // The plaintext token is in this response and nowhere else, ever again.
  res.status(201).json(created);
});

tokensRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid token id" });
    return;
  }

  // deleteApiToken scopes to the caller's own tokens, so a mismatched id is a 404 rather than a
  // way to probe or revoke someone else's.
  const deleted = await deleteApiToken(req.authUserId!, id);
  if (!deleted) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  res.status(204).send();
});
