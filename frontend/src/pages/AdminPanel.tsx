import { useEffect, useState } from "react";
import type {
  PublicUser,
  GlobalRole,
  CustomContent,
  AdminContentSummary,
  AdminCharacterSummary,
  CustomContentType,
  CustomContentSystem,
  CustomContentStatus,
} from "shared";
import { CUSTOM_CONTENT_TYPES_BY_SYSTEM, SYSTEM_IDS } from "shared";
import * as adminApi from "../api/admin";
import { UserHasDependantsError } from "../api/admin";
import * as customContentApi from "../api/customContent";
import * as charactersApi from "../api/characters";
import { useAuth } from "../context/AuthContext";
import { TYPE_LABELS, SYSTEM_LABELS } from "./CustomContentManager";

const ROLES: GlobalRole[] = ["player", "dm", "admin"];
const CONTENT_TYPES = CUSTOM_CONTENT_TYPES_BY_SYSTEM.dnd5e;

type Tab = "users" | "content" | "characters";

// Loops single-item routes rather than adding bulk endpoints (#130), same reuse #123's importer
// makes of the per-row create/update routes. Partial failure is reported per-row, not all-or-nothing.
async function runBulk(ids: number[], action: (id: number) => Promise<unknown>): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await action(id);
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

export function AdminPanel({
  onBack,
  onOpenCharacter,
  onEditContent,
}: {
  onBack: () => void;
  onOpenCharacter: (characterId: number) => void;
  onEditContent: (contentId: number) => void;
}) {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Users tab
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});
  const [resetMessages, setResetMessages] = useState<Record<number, string>>({});
  const [deleteBlocked, setDeleteBlocked] = useState<Record<number, string>>({});
  const adminCount = users.filter((u) => u.role === "admin").length;

  // Custom content tab
  const [pending, setPending] = useState<CustomContent[]>([]);
  const [content, setContent] = useState<AdminContentSummary[]>([]);
  const [contentSearch, setContentSearch] = useState("");
  const [contentStatusFilter, setContentStatusFilter] = useState<CustomContentStatus | "">("");
  const [contentTypeFilter, setContentTypeFilter] = useState<CustomContentType | "">("");
  const [contentSystemFilter, setContentSystemFilter] = useState<CustomContentSystem | "">("");
  const [contentSelected, setContentSelected] = useState<Set<number>>(new Set());
  const [contentBulkMessage, setContentBulkMessage] = useState<string | null>(null);

  // Characters tab
  const [characters, setCharacters] = useState<AdminCharacterSummary[]>([]);
  const [characterSearch, setCharacterSearch] = useState("");
  const [characterSystemFilter, setCharacterSystemFilter] = useState<CustomContentSystem | "">("");
  const [characterSelected, setCharacterSelected] = useState<Set<number>>(new Set());
  const [characterBulkMessage, setCharacterBulkMessage] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Record<number, string>>({});

  function refreshUsers() {
    return adminApi.listUsers().then(setUsers);
  }
  function refreshPending() {
    return customContentApi.listPendingCustomContent().then(setPending);
  }
  function refreshContent() {
    return adminApi.listAllContent().then(setContent);
  }
  function refreshCharacters() {
    return adminApi.listAllCharacters().then(setCharacters);
  }

  useEffect(() => {
    Promise.all([refreshUsers(), refreshPending(), refreshContent(), refreshCharacters()])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(id: number, role: GlobalRole) {
    setError(null);
    try {
      const updated = await adminApi.updateUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function resetPassword(id: number) {
    setError(null);
    setResetMessages((prev) => ({ ...prev, [id]: "" }));
    const password = newPasswords[id] ?? "";
    try {
      await adminApi.resetUserPassword(id, password);
      setNewPasswords((prev) => ({ ...prev, [id]: "" }));
      setResetMessages((prev) => ({ ...prev, [id]: "Password updated." }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  async function deleteUserRow(id: number) {
    setError(null);
    setDeleteBlocked((prev) => ({ ...prev, [id]: "" }));
    if (!window.confirm("Delete this user? This can't be undone.")) return;
    try {
      await adminApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      if (err instanceof UserHasDependantsError) {
        const d = err.dependants;
        const parts = [
          d.characters > 0 && `${d.characters} character(s)`,
          d.campaignsOwned > 0 && `${d.campaignsOwned} campaign(s)`,
          d.campaignMemberships > 0 && `${d.campaignMemberships} campaign membership(s)`,
          d.customContent > 0 && `${d.customContent} content item(s)`,
          d.diceRolls > 0 && `${d.diceRolls} dice roll(s)`,
          d.notes > 0 && `${d.notes} note(s)`,
          d.apiTokens > 0 && `${d.apiTokens} API token(s)`,
        ].filter(Boolean);
        setDeleteBlocked((prev) => ({ ...prev, [id]: `Still owns: ${parts.join(", ")}. Reassign or delete those first.` }));
      } else {
        setError(err instanceof Error ? err.message : "Failed to delete user");
      }
    }
  }

  async function approve(id: number) {
    setError(null);
    try {
      await customContentApi.approveCustomContent(id);
      refreshPending();
      refreshContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function reject(id: number) {
    setError(null);
    try {
      await customContentApi.deleteCustomContent(id);
      refreshPending();
      refreshContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  async function revoke(id: number) {
    if (
      !window.confirm(
        "Revoking approval means this item stops resolving for anyone but its author -- any character sheet already referencing it (a spell, a granted feat, a race trait's spell) will show it as an unresolved name instead. Use this for \"not public yet\", not for \"this is broken\" (delete that instead). Continue?",
      )
    ) {
      return;
    }
    setError(null);
    try {
      await customContentApi.unapproveCustomContent(id);
      refreshContent();
      refreshPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    }
  }

  async function deleteContentRow(id: number) {
    setError(null);
    try {
      await customContentApi.deleteCustomContent(id);
      refreshContent();
      refreshPending();
      setContentSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function toggleContentSelected(id: number) {
    setContentSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkContent(action: "approve" | "revoke" | "delete") {
    if (contentSelected.size === 0) return;
    if (
      action === "revoke" &&
      !window.confirm(`Revoke approval on ${contentSelected.size} item(s)? Anything already referencing them will stop resolving for non-authors.`)
    ) {
      return;
    }
    if (action === "delete" && !window.confirm(`Delete ${contentSelected.size} item(s)? This can't be undone.`)) return;

    setContentBulkMessage(null);
    const fn =
      action === "approve"
        ? customContentApi.approveCustomContent
        : action === "revoke"
          ? customContentApi.unapproveCustomContent
          : customContentApi.deleteCustomContent;
    const { ok, failed } = await runBulk(Array.from(contentSelected), fn);
    setContentBulkMessage(`${ok} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`);
    setContentSelected(new Set());
    refreshContent();
    refreshPending();
  }

  async function handleReassign(characterId: number) {
    const targetId = Number(reassignTarget[characterId]);
    if (!targetId) return;
    setError(null);
    try {
      await adminApi.reassignCharacterOwner(characterId, targetId);
      setReassignTarget((prev) => {
        const next = { ...prev };
        delete next[characterId];
        return next;
      });
      refreshCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign");
    }
  }

  async function detachCharacterRow(id: number) {
    setError(null);
    try {
      await charactersApi.detachCharacter(id);
      refreshCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detach");
    }
  }

  async function deleteCharacterRow(id: number) {
    setError(null);
    if (!window.confirm("Delete this character? This can't be undone.")) return;
    try {
      await charactersApi.deleteCharacter(id);
      refreshCharacters();
      setCharacterSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function toggleCharacterSelected(id: number) {
    setCharacterSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDeleteCharacters() {
    if (characterSelected.size === 0) return;
    if (!window.confirm(`Delete ${characterSelected.size} character(s)? This can't be undone.`)) return;
    setCharacterBulkMessage(null);
    const { ok, failed } = await runBulk(Array.from(characterSelected), charactersApi.deleteCharacter);
    setCharacterBulkMessage(`${ok} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`);
    setCharacterSelected(new Set());
    refreshCharacters();
  }

  const filteredContent = content.filter((c) => {
    const q = contentSearch.trim().toLowerCase();
    return (
      (q === "" || c.name.toLowerCase().includes(q) || c.createdByUsername.toLowerCase().includes(q)) &&
      (contentStatusFilter === "" || c.status === contentStatusFilter) &&
      (contentTypeFilter === "" || c.type === contentTypeFilter) &&
      (contentSystemFilter === "" || c.system === contentSystemFilter)
    );
  });

  const filteredCharacters = characters.filter((c) => {
    const q = characterSearch.trim().toLowerCase();
    return (
      (q === "" ||
        c.name.toLowerCase().includes(q) ||
        c.ownerUsername.toLowerCase().includes(q) ||
        (c.campaignName ?? "").toLowerCase().includes(q)) &&
      (characterSystemFilter === "" || c.system === characterSystemFilter)
    );
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem" }}>
      <button onClick={onBack}>← Back</button>
      <h2>Admin panel</h2>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {(
          [
            ["users", `Users (${users.length})`],
            ["content", `Custom content (${content.length})`],
            ["characters", `Characters (${characters.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none",
              background: "none",
              padding: "0.5rem 0.75rem",
              borderBottom: tab === t ? "2px solid var(--text)" : "2px solid transparent",
              fontWeight: tab === t ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : tab === "users" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Username</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Created</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Reset password</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isLastAdmin = u.role === "admin" && adminCount <= 1;
              return (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as GlobalRole)}
                      disabled={isSelf}
                      title={isSelf ? "You can't change your own role here" : undefined}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      placeholder="New password"
                      value={newPasswords[u.id] ?? ""}
                      onChange={(e) => setNewPasswords((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      style={{ width: "8rem" }}
                    />{" "}
                    <button
                      type="button"
                      onClick={() => resetPassword(u.id)}
                      disabled={(newPasswords[u.id] ?? "").length < 8}
                      title={(newPasswords[u.id] ?? "").length < 8 ? "At least 8 characters" : undefined}
                    >
                      Set
                    </button>
                    {resetMessages[u.id] && (
                      <div>
                        <small style={{ color: "var(--success)" }}>{resetMessages[u.id]}</small>
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => deleteUserRow(u.id)}
                      disabled={isSelf || isLastAdmin}
                      title={isSelf ? "You can't delete your own account" : isLastAdmin ? "Can't delete the last remaining admin" : undefined}
                    >
                      Delete
                    </button>
                    {deleteBlocked[u.id] && (
                      <div>
                        <small style={{ color: "var(--danger)" }}>{deleteBlocked[u.id]}</small>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : tab === "content" ? (
        <div>
          {pending.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h3>Pending approval ({pending.length})</h3>
              {pending.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span>
                    <strong>{item.name}</strong> ({item.type}) — by {item.createdByUsername}
                  </span>
                  <span>
                    <button type="button" onClick={() => approve(item.id)}>
                      Approve
                    </button>{" "}
                    <button type="button" onClick={() => reject(item.id)}>
                      Reject
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <h3>All custom content</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <input placeholder="Search name or owner…" value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} />
            <select value={contentStatusFilter} onChange={(e) => setContentStatusFilter(e.target.value as CustomContentStatus | "")}>
              <option value="">Any status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
            <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value as CustomContentType | "")}>
              <option value="">Any type</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select value={contentSystemFilter} onChange={(e) => setContentSystemFilter(e.target.value as CustomContentSystem | "")}>
              <option value="">Any system</option>
              {SYSTEM_IDS.map((s) => (
                <option key={s} value={s}>
                  {SYSTEM_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setContentSelected(new Set(filteredContent.map((c) => c.id)))}>
              Select all filtered ({filteredContent.length})
            </button>
            <button type="button" onClick={() => setContentSelected(new Set())}>
              Clear selection
            </button>
          </div>
          {contentSelected.size > 0 && (
            <p>
              {contentSelected.size} selected:{" "}
              <button type="button" onClick={() => bulkContent("approve")}>
                Approve
              </button>{" "}
              <button type="button" onClick={() => bulkContent("revoke")}>
                Revoke approval
              </button>{" "}
              <button type="button" onClick={() => bulkContent("delete")}>
                Delete
              </button>
            </p>
          )}
          {contentBulkMessage && <p>{contentBulkMessage}</p>}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th></th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>System</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Owner</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContent.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" checked={contentSelected.has(item.id)} onChange={() => toggleContentSelected(item.id)} />
                  </td>
                  <td>{item.name}</td>
                  <td>{TYPE_LABELS[item.type]}</td>
                  <td>{SYSTEM_LABELS[item.system]}</td>
                  <td>{item.createdByUsername}</td>
                  <td>{item.status}</td>
                  <td>
                    <button type="button" onClick={() => onEditContent(item.id)}>
                      Edit
                    </button>{" "}
                    {item.status === "pending" ? (
                      <button type="button" onClick={() => approve(item.id)}>
                        Approve
                      </button>
                    ) : (
                      <button type="button" onClick={() => revoke(item.id)}>
                        Revoke
                      </button>
                    )}{" "}
                    <button type="button" onClick={() => deleteContentRow(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredContent.length === 0 && <p>No matching items.</p>}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <input
              placeholder="Search name, owner, or campaign…"
              value={characterSearch}
              onChange={(e) => setCharacterSearch(e.target.value)}
            />
            <select value={characterSystemFilter} onChange={(e) => setCharacterSystemFilter(e.target.value as CustomContentSystem | "")}>
              <option value="">Any system</option>
              {SYSTEM_IDS.map((s) => (
                <option key={s} value={s}>
                  {SYSTEM_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setCharacterSelected(new Set(filteredCharacters.map((c) => c.id)))}>
              Select all filtered ({filteredCharacters.length})
            </button>
            <button type="button" onClick={() => setCharacterSelected(new Set())}>
              Clear selection
            </button>
          </div>
          {characterSelected.size > 0 && (
            <p>
              {characterSelected.size} selected:{" "}
              <button type="button" onClick={bulkDeleteCharacters}>
                Delete
              </button>
            </p>
          )}
          {characterBulkMessage && <p>{characterBulkMessage}</p>}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th></th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Owner</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Campaign</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>System</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Level</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCharacters.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input type="checkbox" checked={characterSelected.has(c.id)} onChange={() => toggleCharacterSelected(c.id)} />
                  </td>
                  <td>{c.name}</td>
                  <td>{c.ownerUsername}</td>
                  <td>{c.campaignName ?? "—"}</td>
                  <td>{SYSTEM_LABELS[c.system]}</td>
                  <td>{c.level ?? "—"}</td>
                  <td>{c.status ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => onOpenCharacter(c.id)}>
                      Open
                    </button>{" "}
                    {c.campaignId !== null && (
                      <button type="button" onClick={() => detachCharacterRow(c.id)}>
                        Detach
                      </button>
                    )}{" "}
                    <button type="button" onClick={() => deleteCharacterRow(c.id)}>
                      Delete
                    </button>{" "}
                    <select
                      value={reassignTarget[c.id] ?? ""}
                      onChange={(e) => setReassignTarget((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      style={{ marginLeft: "0.4rem" }}
                    >
                      <option value="">Reassign to…</option>
                      {users
                        .filter((u) => u.id !== c.ownerUserId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                    </select>{" "}
                    <button type="button" onClick={() => handleReassign(c.id)} disabled={!reassignTarget[c.id]}>
                      Go
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCharacters.length === 0 && <p>No matching characters.</p>}
        </div>
      )}
    </div>
  );
}
