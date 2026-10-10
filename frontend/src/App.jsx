import { useSession } from './context/SessionContext';
import LoginView from './views/LoginView';
import Dashboard from './Dashboard';

export default function App() {
  const { authed } = useSession();

  if (authed === null) return null;
  if (!authed) return <LoginView />;
  return <Dashboard />;
}
