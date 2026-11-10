import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import './ui.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { DiceRollProvider } from './dice/DiceRollContext.tsx'
import { ThemeProvider, applyTheme, cachedTheme } from './theme/ThemeProvider.tsx'
import { DiceModelProvider, applyDiceModel, cachedDiceModel } from './theme/DiceModelProvider.tsx'

// Applied before React mounts (#154). The account value is authoritative, but it only arrives once
// the session request resolves -- without this the page paints Default first and visibly snaps.
applyTheme(cachedTheme())
// Same first-paint trick for dice models (#162).
applyDiceModel(cachedDiceModel())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <DiceModelProvider>
          <DiceRollProvider>
            <App />
          </DiceRollProvider>
        </DiceModelProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
