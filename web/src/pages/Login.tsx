import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useSession } from '../state/session';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123!');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/auth/login', { username, password });
      setSession(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">ReleasePilot Login</h1>
        {error && <div className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-1">
          <label className="text-sm">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded border p-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border p-2" />
        </div>
        <button type="submit" className="w-full rounded bg-indigo-600 p-2 text-white hover:bg-indigo-700">Sign in</button>
      </form>
    </div>
  );
}
