import { useState } from 'react';
import Banner from '../components/ui/Banner';
import { useSession } from '../context/SessionContext';

function Icon({ children, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Snowflake = (props) => (
  <Icon {...props}>
    <line x1="2" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="m20 16-4-4 4-4" />
    <path d="m4 8 4 4-4 4" />
    <path d="m16 4-4 4-4-4" />
    <path d="m8 20 4-4 4 4" />
  </Icon>
);

const User = (props) => (
  <Icon {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);

const Lock = (props) => (
  <Icon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);

const Eye = (props) => (
  <Icon {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const EyeOff = (props) => (
  <Icon {...props}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </Icon>
);

const INPUT =
  'w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-white outline-none transition-colors placeholder:text-white/30 focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:opacity-60';

export default function LoginView() {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-hum/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm animate-fade-up rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 grid h-16 w-16 animate-float place-items-center rounded-2xl bg-gradient-to-br from-accent to-hum p-[1.5px] shadow-[0_0_30px_rgba(108,99,255,0.45)]">
          <div className="grid h-full w-full place-items-center rounded-[0.9rem] bg-[#17142e]">
            <Snowflake className="h-8 w-8 text-white" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-light text-white">
          Habitación{' '}
          <span className="bg-gradient-to-r from-accent-soft to-hum bg-clip-text font-semibold text-transparent">
            LuisRLP
          </span>
        </h1>
        <p className="mb-6 mt-1 text-center text-sm text-white/55">Inicia sesión para continuar</p>

        {error && <Banner variant="err" className="mb-4">{error}</Banner>}

        <form className="flex flex-col gap-3.5" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            <span>Usuario</span>
            <span className="relative block">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy}
                placeholder="tu usuario"
                required
                className={INPUT}
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            <span>Contraseña</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="••••••••"
                required
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-soft py-3 font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <a
          href="https://luisrlp.com"
          className="mt-6 block text-center text-xs text-white/40 transition-colors hover:text-white/70"
        >
          ← luisrlp.com
        </a>
      </div>
    </div>
  );
}
