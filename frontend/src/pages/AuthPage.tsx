import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch {
      // error is surfaced via context state
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto" }}>
      <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
        </div>
        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
        </div>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {mode === "login" ? "Log in" : "Register"}
        </button>
      </form>
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
      </button>
    </div>
  );
}
