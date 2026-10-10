import { useState } from 'react';

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Credenciales inválidas');
      }
      onLogin();
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cl-login">
      <div className="cl-login-card">
        <h1 className="cl-login-title">Aire</h1>
        <p className="cl-login-sub">Inicia sesión para continuar</p>

        {error && <div className="ir-banner ir-banner-err">{error}</div>}

        <form className="cl-login-form" onSubmit={submit}>
          <label className="cl-login-field">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="cl-login-field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="cl-login-submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
