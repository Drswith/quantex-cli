import { createRoot } from 'react-dom/client'
import { App } from './app'
// oxlint-disable-next-line import/no-unassigned-import
import './app.css'

const root = document.getElementById('root')
if (!root) throw new Error('Desktop root element is missing.')

createRoot(root).render(<App />)
