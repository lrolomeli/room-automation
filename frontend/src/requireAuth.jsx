import { useEffect, useState } from 'react'

export default function RequireAuth({ children }) {
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => { if (r.ok) setAuthed(true); else window.location.href = '/' })
      .catch(() => { window.location.href = '/' })
  }, [])

  if (!authed) return null

  return children
}
