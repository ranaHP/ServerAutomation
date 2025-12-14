import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import SessionDetail from './SessionDetail';
import { useSession } from '../state/session';

export default function App() {
  const { user, clear } = useSession();
  const navigate = useNavigate();
  if (!user) {
    navigate('/login');
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow">
        <div className="text-lg font-semibold">ReleasePilot</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-slate-200 px-2 py-1">{user?.role}</span>
          <span>{user?.username}</span>
          <button onClick={() => { clear(); navigate('/login'); }} className="text-indigo-600">Logout</button>
        </div>
      </header>
      <nav className="flex gap-4 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-700">
        <Link to="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
      </nav>
      <main className="px-6 py-6">
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
        </Routes>
      </main>
    </div>
  );
}
