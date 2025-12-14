import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { z } from 'zod';

const sessionSchema = z.object({
  type: z.enum(['deploy', 'rollback']),
  mode: z.enum(['dry-run', 'execute']),
  serverGroup: z.string(),
  serverName: z.string(),
  releaseDir: z.string().optional(),
  serverDir: z.string(),
  backupBase: z.string(),
  rollbackBackupTs: z.string().optional()
});

export default function Dashboard() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: 'deploy',
    mode: 'dry-run',
    serverGroup: 'UAT',
    serverName: 'DFN-WebServer-1-dvh-fd1',
    releaseDir: '/home/directfn/app/ntp_releases/ntp_lwapi/new/custom-plugins',
    serverDir: '/home/directfn/app/ntp_lwapi_gw/custom-plugins',
    backupBase: '/home/directfn/app/ntp_releases/ntp_lwapi/backups',
    rollbackBackupTs: ''
  });

  const { data: inventory } = useQuery({ queryKey: ['inventory'], queryFn: async () => (await api.get('/api/inventory')).data });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: async () => (await api.get('/api/sessions')).data });

  const createSession = useMutation({
    mutationFn: async () => sessionSchema.parse(form) && (await api.post('/api/sessions', form)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] })
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 text-lg font-semibold">Sessions</div>
          <div className="space-y-2">
            {sessions?.map((s: any) => (
              <Link key={s.id} to={`/sessions/${s.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-slate-50">
                <div>
                  <div className="font-medium">{s.type} / {s.mode}</div>
                  <div className="text-xs text-slate-500">{s.server_group} • {s.server_name}</div>
                </div>
                <span className="rounded bg-slate-200 px-2 py-1 text-xs">{s.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 text-lg font-semibold">New Session</div>
          <div className="space-y-3 text-sm">
            <label className="block">Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded border p-2">
                <option value="deploy">Deploy</option>
                <option value="rollback">Rollback</option>
              </select>
            </label>
            <label className="block">Mode
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="mt-1 w-full rounded border p-2">
                <option value="dry-run">Dry run</option>
                <option value="execute">Execute</option>
              </select>
            </label>
            <label className="block">Group
              <select value={form.serverGroup} onChange={(e) => setForm({ ...form, serverGroup: e.target.value })} className="mt-1 w-full rounded border p-2">
                {inventory?.groups && Object.keys(inventory.groups).map((g: string) => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label className="block">Server name
              <input value={form.serverName} onChange={(e) => setForm({ ...form, serverName: e.target.value })} className="mt-1 w-full rounded border p-2" />
            </label>
            {form.type === 'deploy' && (
              <label className="block">Release directory
                <input value={form.releaseDir} onChange={(e) => setForm({ ...form, releaseDir: e.target.value })} className="mt-1 w-full rounded border p-2" />
              </label>
            )}
            <label className="block">Server directory
              <input value={form.serverDir} onChange={(e) => setForm({ ...form, serverDir: e.target.value })} className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="block">Backup base
              <input value={form.backupBase} onChange={(e) => setForm({ ...form, backupBase: e.target.value })} className="mt-1 w-full rounded border p-2" />
            </label>
            {form.type === 'rollback' && (
              <label className="block">Backup timestamp
                <input value={form.rollbackBackupTs} onChange={(e) => setForm({ ...form, rollbackBackupTs: e.target.value })} className="mt-1 w-full rounded border p-2" />
              </label>
            )}
            <button onClick={() => createSession.mutate()} className="w-full rounded bg-indigo-600 p-2 text-white">
              Create session
            </button>
            {createSession.error && <div className="text-sm text-red-600">Error creating session</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
