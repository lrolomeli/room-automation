import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RequireAuth from './requireAuth.jsx'
import ClimateApp from './ClimateApp.jsx'
import './style.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireAuth><ClimateApp /></RequireAuth>
  </StrictMode>,
)
