import { useState } from 'react';
import Banner from '../components/ui/Banner';
import { useSession } from '../context/SessionContext';

const INPUT =
  'rounded-lg border border-white/20 bg-white/5 px-3.5 py-2.5 text-white outline-none transition-colors focus:border-accent';

export default function LoginView() {
  const { login } = useSession();
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
      await login(username, password);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-accent/35 bg-white/5 p-6">
        <h1 className="text-center text-2xl font-light text-white">Aire</h1>
        <p className="mb-5 mt-1 text-center text-sm text-white/55">Inicia sesión para continuar</p>

        {error && <Banner variant="err" className="mb-4">{error}</Banner>}

        <form className="flex flex-col gap-3.5" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              className={INPUT}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-lg bg-accent/80 py-3 font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
