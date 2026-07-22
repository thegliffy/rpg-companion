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

export type View =
  | { name: "home" }
  | { name: "campaign"; campaignId: number }
  | { name: "character"; characterId: number; back: View }
  | { name: "create-character"; campaignId: number | null; back: View }
  | { name: "admin" }
  | { name: "custom-content" }
  | { name: "bestiary" }
  | { name: "arena" };

function App() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<View>({ name: "home" });

  if (loading) return <p>Loading…</p>;
  if (!user) return <AuthPage />;

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", padding: "1rem 2rem" }}>
        <span>Signed in as {user.username}</span>
        <span>
          {view.name !== "bestiary" && (
            <button onClick={() => setView({ name: "bestiary" })} style={{ marginRight: "0.5rem" }}>
              Bestiary
            </button>
          )}
          {view.name !== "arena" && (
            <button onClick={() => setView({ name: "arena" })} style={{ marginRight: "0.5rem" }}>
              Arena
            </button>
          )}
          {(user.role === "dm" || user.role === "admin") && view.name !== "custom-content" && (
            <button onClick={() => setView({ name: "custom-content" })} style={{ marginRight: "0.5rem" }}>
              My custom content
            </button>
          )}
          {user.role === "admin" && view.name !== "admin" && (
            <button onClick={() => setView({ name: "admin" })} style={{ marginRight: "0.5rem" }}>
              Admin panel
            </button>
          )}
          <button onClick={() => logout()}>Log out</button>
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
      {view.name === "admin" && <AdminPanel onBack={() => setView({ name: "home" })} />}
      {view.name === "custom-content" && <CustomContentManager onBack={() => setView({ name: "home" })} />}
      {view.name === "bestiary" && <BestiaryPage onBack={() => setView({ name: "home" })} />}
      {view.name === "arena" && <ArenaPage onBack={() => setView({ name: "home" })} />}
    </div>
  );
}

export default App;
