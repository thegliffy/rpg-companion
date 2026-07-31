import { useEffect, useState } from "react";
import type { ApiTokenSummary } from "shared";
import * as tokensApi from "../api/tokens";

/** Ready-to-run import call with the real token already in it (#149). The whole point of tokens
 * here is scripted uploads, so handing over the exact request costs nothing and saves
 * reconstructing it from scratch -- and it doubles as the "copy this now" moment, since the token
 * is unrecoverable once this box is dismissed. */
function curlExample(token: string): string {
  const origin = window.location.origin;
  return `curl -X POST ${origin}/api/custom-content/import \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "system": "dnd5e",
    "items": [
      { "type": "feat", "name": "My Feat", "data": { "description": "..." } }
    ]
  }'`;
}

export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The plaintext token, held only until the user dismisses it -- never re-fetchable.
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function refresh() {
    tokensApi.listTokens().then(setTokens).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const days = expiresInDays.trim() === "" ? undefined : Number(expiresInDays);
      const created = await tokensApi.createToken(name.trim(), days);
      setNewToken(created.token);
      setName("");
      setExpiresInDays("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!window.confirm("Revoke this token? Anything using it stops working immediately.")) return;
    setError(null);
    try {
      await tokensApi.deleteToken(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  return (
    <div>
      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        API tokens
        <button type="button" onClick={() => setExpanded((v) => !v)} style={{ fontSize: "0.8rem" }}>
          {expanded ? "Hide" : tokens.length > 0 ? `Show (${tokens.length})` : "Show"}
        </button>
      </h2>

      {expanded && (
        <>
          <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.5rem" }}>
            For scripts and automation — a token authenticates as you, without your password, and can be revoked on
            its own. It can do anything you can, so treat it like a password.
          </p>

          {error && <p style={{ color: "crimson" }}>{error}</p>}

          {newToken && (
            <div style={{ border: "2px solid #2a8a2a", borderRadius: 6, padding: "0.6rem", marginBottom: "0.75rem" }}>
              <p style={{ margin: "0 0 0.3rem", fontWeight: 600 }}>Copy this now — it can't be shown again.</p>
              <code
                style={{
                  display: "block",
                  background: "#f4f4f4",
                  padding: "0.4rem",
                  borderRadius: 4,
                  wordBreak: "break-all",
                  fontSize: "0.85rem",
                }}
              >
                {newToken}
              </code>
              <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(newToken);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied!" : "Copy token"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(curlExample(newToken));
                  }}
                >
                  Copy example upload command
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewToken(null);
                    setCopied(false);
                  }}
                >
                  Done
                </button>
              </div>
              <details style={{ marginTop: "0.5rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>Show example upload command</summary>
                <pre
                  style={{
                    background: "#f4f4f4",
                    padding: "0.5rem",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    overflowX: "auto",
                  }}
                >
                  {curlExample(newToken)}
                </pre>
              </details>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.6rem" }}>
            <input
              placeholder="What's it for? e.g. upload script"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: "1 1 12rem" }}
            />
            <label style={{ fontSize: "0.85rem" }}>
              Expires in{" "}
              <input
                type="number"
                min={1}
                max={730}
                placeholder="never"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                style={{ width: "5rem" }}
              />{" "}
              days
            </label>
            <button type="button" onClick={create} disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create token"}
            </button>
          </div>

          {tokens.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>No tokens yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Token</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Last used</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Expires</th>
                  <th style={{ borderBottom: "1px solid #ccc" }}></th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <code>{t.prefix}…</code>
                    </td>
                    <td>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "never"}</td>
                    <td>{t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "never"}</td>
                    <td>
                      <button type="button" onClick={() => revoke(t.id)}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
