import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { CampaignList } from "./pages/CampaignList";
import { CampaignDashboard } from "./pages/CampaignDashboard";
import { CharacterSheetPage } from "./pages/CharacterSheetPage";
import { CharacterCreationWizard } from "./pages/CharacterCreationWizard";
import { AdminPanel } from "./pages/AdminPanel";
import { CustomContentManager } from "./pages/CustomContentManager";
import { BestiaryPage } from "./pages/BestiaryPage";
import { ArenaPage } from "./pages/ArenaPage";
import { SharedCharacterPage } from "./pages/SharedCharacterPage";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const GIT_SHA = import.meta.env.VITE_GIT_SHA ?? "dev";

export type View =
  | { name: "home" }
  | { name: "campaign"; campaignId: number }
  | { name: "character"; characterId: number; back: View }
  | { name: "create-character"; campaignId: number | null; back: View }
  | { name: "admin" }
  | { name: "custom-content"; editContentId?: number; back?: View }
  | { name: "bestiary" }
  | { name: "arena" };

function App() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<View>({ name: "home" });

  // Public share links (/c/:token) bypass auth entirely -- checked before the loading/auth gates
  // below so an anonymous visitor never sees (or needs) the login page.
  const shareMatch = window.location.pathname.match(/^\/c\/([^/]+)\/?$/);
  if (shareMatch) return <SharedCharacterPage token={shareMatch[1]} />;

  if (loading) return <p>Loading…</p>;
  if (!user) return <AuthPage />;

  return (
    <div>
      <header className="no-print app-header">
        <span className="brand">
          <span className="brand__mark">⚔</span>
          <span className="brand__wordmark">RPG Companion</span>
        </span>
        <span className="app-header__nav">
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginRight: "0.5rem" }}>
            Signed in as <strong style={{ color: "var(--text-heading)" }}>{user.username}</strong>
          </span>
          {view.name !== "bestiary" && (
            <button className="btn" onClick={() => setView({ name: "bestiary" })}>
              Bestiary
            </button>
          )}
          {view.name !== "arena" && (
            <button className="btn" onClick={() => setView({ name: "arena" })}>
              Arena
            </button>
          )}
          {(user.role === "dm" || user.role === "admin") && view.name !== "custom-content" && (
            <button className="btn" onClick={() => setView({ name: "custom-content" })}>
              My custom content
            </button>
          )}
          {user.role === "admin" && view.name !== "admin" && (
            <button className="btn" onClick={() => setView({ name: "admin" })}>
              Admin panel
            </button>
          )}
          <button className="btn" onClick={() => logout()}>
            Log out
          </button>
        </span>
      </header>

      {view.name === "home" && (
        <CampaignList
          onOpenCampaign={(campaignId) => setView({ name: "campaign", campaignId })}
          onOpenCharacter={(characterId) => setView({ name: "character", characterId, back: view })}
          onCreateCharacter={() => setView({ name: "create-character", campaignId: null, back: view })}
        />
      )}
      {view.name === "campaign" && (
        <CampaignDashboard
          campaignId={view.campaignId}
          onBack={() => setView({ name: "home" })}
          onOpenCharacter={(characterId) => setView({ name: "character", characterId, back: view })}
          onCreateCharacter={() =>
            setView({ name: "create-character", campaignId: view.campaignId, back: view })
          }
        />
      )}
      {view.name === "character" && (
        <CharacterSheetPage characterId={view.characterId} onBack={() => setView(view.back)} />
      )}
      {view.name === "create-character" && (
        <CharacterCreationWizard
          campaignId={view.campaignId}
          onDone={(characterId) =>
            characterId === null
              ? setView(view.back)
              : setView({ name: "character", characterId, back: view.back })
          }
        />
      )}
      {view.name === "admin" && (
        <AdminPanel
          onBack={() => setView({ name: "home" })}
          onOpenCharacter={(characterId) => setView({ name: "character", characterId, back: { name: "admin" } })}
          onEditContent={(editContentId) => setView({ name: "custom-content", editContentId, back: { name: "admin" } })}
        />
      )}
      {view.name === "custom-content" && (
        <CustomContentManager
          onBack={() => setView(view.back ?? { name: "home" })}
          editContentId={view.editContentId}
        />
      )}
      {view.name === "bestiary" && <BestiaryPage onBack={() => setView({ name: "home" })} />}
      {view.name === "arena" && <ArenaPage onBack={() => setView({ name: "home" })} />}

      <footer className="no-print" style={{ padding: "0.75rem 2rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-dim)" }}>
        RPG Companion v{APP_VERSION} · {GIT_SHA}
      </footer>
    </div>
  );
}

export default App;
