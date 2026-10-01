import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles.css'
import App from './App'

// three.js r18x deprecates THREE.Clock, which @react-three/fiber still uses internally — harmless, silence just that line.
const warn = console.warn
console.warn = (...a: unknown[]) => {
  if (typeof a[0] === 'string' && a[0].includes('THREE.Clock')) return
  warn(...a)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
