import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@omega-os/ui/tokens.css'
import './index.css'
import { AppWithBoundary } from './App.tsx'

// DTN defaults to dark; OmegaOS is light-default with `.dark`.
// Keep both systems in sync until App.css legacy tokens are removed.
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithBoundary />
  </StrictMode>,
)
