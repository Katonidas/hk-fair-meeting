import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { VersionGate } from '@/components/VersionGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VersionGate>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </VersionGate>
  </StrictMode>,
)
