import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/Auth/AuthContext'
import { BrewProvider } from './contexts/Brew/BrewContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrewProvider>
        <App />
      </BrewProvider>
    </AuthProvider>
  </StrictMode>
)
