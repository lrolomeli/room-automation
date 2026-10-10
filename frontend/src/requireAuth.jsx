import { cloneElement, useCallback, useEffect, useState } from 'react'
import LoginView from './views/LoginView.jsx'

export default function RequireAuth({ children }) {
  const [authed, setAuthed] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (r) => {
        if (!alive) return
        if (r.ok) {
          const data = await r.json().catch(() => ({}))
          setUser(data.user || null)
          setAuthed(true)
        } else {
          setAuthed(false)
        }
      })
      .catch(() => { if (alive) setAuthed(false) })
    return () => { alive = false }
  }, [])

  const handleLogin = useCallback(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json().catch(() => ({}))
          setUser(data.user || null)
        }
        setAuthed(true)
      })
      .catch(() => setAuthed(true))
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* la sesión local se limpia igual */
    }
    setUser(null)
    setAuthed(false)
  }, [])

  if (authed === null) return null
  if (!authed) return <LoginView onLogin={handleLogin} />

  return cloneElement(children, { user, onLogout: handleLogout })
}
