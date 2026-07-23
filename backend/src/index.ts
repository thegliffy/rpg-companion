import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { db } from "./db/client.js";
import { sql } from "drizzle-orm";
import { createSessionMiddleware } from "./middleware/session.js";
import { authRouter } from "./routes/auth.routes.js";
import { campaignsRouter } from "./routes/campaigns.routes.js";
import { charactersRouter } from "./routes/characters.routes.js";
import { notesRouter } from "./routes/notes.routes.js";
import { encountersRouter } from "./routes/encounters.routes.js";
import { rollsRouter } from "./routes/rolls.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { customContentRouter } from "./routes/customContent.routes.js";
import { sharedCharactersRouter } from "./routes/sharedCharacters.routes.js";
import { createSocketServer } from "./sockets/index.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const sessionMiddleware = createSessionMiddleware();

app.use(express.json());
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
  const version = process.env.APP_VERSION ?? "dev";
  const commit = process.env.GIT_SHA ?? "dev";
  try {
    db.run(sql`select 1`);
    res.json({ status: "ok", db: "ok", version, commit });
  } catch (err) {
    res.status(500).json({ status: "error", error: String(err), version, commit });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/notes", notesRouter);
app.use("/api/encounters", encountersRouter);
app.use("/api/rolls", rollsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/custom-content", customContentRouter);
// Deliberately NOT behind requireAuth -- see sharedCharacters.routes.ts for why this is safe.
app.use("/api/shared/characters", sharedCharactersRouter);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.join(__dirname, "../../frontend-dist");
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

const server = http.createServer(app);
createSocketServer(server, sessionMiddleware);

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
