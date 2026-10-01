import { useState, type FormEvent } from "react";
import * as authApi from "../api/auth";
import { cardRaised } from "../styles";

/** Self-service password change. The only recovery path that doesn't depend on another admin
 * existing (first-user-is-admin means a forgotten password on a solo install was otherwise a
 * permanent lockout). The server requires the current password, so a stolen session cookie
 * alone can't rotate it. */
export function PasswordChangePanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={cardRaised}>
      <h2 style={{ marginTop: 0 }}>Change password</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {done && <p style={{ color: "var(--success, var(--accent))" }}>Password changed.</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
