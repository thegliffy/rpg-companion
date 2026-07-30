import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { DiceRollProvider } from './dice/DiceRollContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DiceRollProvider>
        <App />
      </DiceRollProvider>
    </AuthProvider>
  </StrictMode>,
)
