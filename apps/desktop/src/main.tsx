import { createRoot } from 'react-dom/client'
import { App } from './app'
import { applyResolvedAppearance, resolveAppearance } from './lib/theme'
// oxlint-disable-next-line import/no-unassigned-import
import './app.css'

const root = document.getElementById('root')
if (!root) throw new Error('Desktop root element is missing.')

applyResolvedAppearance(
  resolveAppearance('system', window.matchMedia('(prefers-color-scheme: dark)').matches),
  document.documentElement,
)

createRoot(root).render(<App />)
