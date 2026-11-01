import { useSession } from './context/SessionContext';
import LoginView from './views/LoginView';
import Shell from './Shell';

export default function App() {
  const { authed } = useSession();

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
      </div>
    );
  }

  if (!authed) return <LoginView />;
  return <Shell />;
}
