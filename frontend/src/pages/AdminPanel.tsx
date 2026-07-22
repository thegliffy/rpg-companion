import { useEffect, useState } from "react";
import type { PublicUser, GlobalRole, CustomContent } from "shared";
import * as adminApi from "../api/admin";
import * as customContentApi from "../api/customContent";
import { useAuth } from "../context/AuthContext";

const ROLES: GlobalRole[] = ["player", "dm", "admin"];

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [pending, setPending] = useState<CustomContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});
  const [resetMessages, setResetMessages] = useState<Record<number, string>>({});

  function refreshPending() {
    customContentApi.listPendingCustomContent().then(setPending).catch((err) => setError(err.message));
  }

  useEffect(() => {
    Promise.all([adminApi.listUsers().then(setUsers), customContentApi.listPendingCustomContent().then(setPending)])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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

  async function approve(id: number) {
    setError(null);
    try {
      await customContentApi.approveCustomContent(id);
      refreshPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function reject(id: number) {
    setError(null);
    try {
      await customContentApi.deleteCustomContent(id);
      refreshPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "1rem" }}>
      <button onClick={onBack}>← Back</button>
      <h2>Admin panel</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Username</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Created</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as GlobalRole)}
                    disabled={u.id === currentUser?.id}
                    title={u.id === currentUser?.id ? "You can't change your own role here" : undefined}
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
                      <small style={{ color: "green" }}>{resetMessages[u.id]}</small>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "2rem" }}>Pending custom content</h2>
      {pending.length === 0 && !loading && <p>Nothing pending.</p>}
      {pending.map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #ccc",
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
  );
}
