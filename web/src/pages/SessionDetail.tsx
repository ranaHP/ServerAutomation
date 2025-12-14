import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Stepper from '../components/Stepper';

export default function SessionDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: session } = useQuery({ queryKey: ['session', id], queryFn: async () => (await api.get(`/api/sessions/${id}`)).data });
  const [logs, setLogs] = useState<{ message: string; level: string; ts: string }[]>([]);

  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_URL}/api/sessions/${id}/logs/stream`, {
      withCredentials: false
    });
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data].slice(-500));
    };
    return () => es.close();
  }, [id]);

  const approveStep = useMutation({
    mutationFn: async (stepKey: string) => api.post(`/api/sessions/${id}/approve-step`, { stepKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', id] })
  });

  const run = useMutation({
    mutationFn: async () => api.post(`/api/sessions/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', id] })
  });

  const steps = useMemo(() => session?.steps || [], [session]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Session {session?.id}</div>
              <div className="text-xs text-slate-500">{session?.server_group} / {session?.server_name}</div>
            </div>
            <button onClick={() => run.mutate()} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white">Start engine</button>
          </div>
          <Stepper steps={steps.map((s: any) => ({ key: s.step_key, name: s.step_name, status: s.status }))} />
          <div className="mt-3 text-sm text-slate-600">Each step requires approval before execution.</div>
          <div className="mt-3 space-x-2">
            {steps.filter((s: any) => s.status === 'pending').map((s: any) => (
              <button key={s.step_key} onClick={() => approveStep.mutate(s.step_key)} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white">
                Approve {s.step_key}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-2 text-sm font-semibold">Live logs</div>
          <div className="h-96 overflow-auto rounded border bg-slate-900 p-3 text-xs text-green-200">
            {logs.map((l, idx) => (
              <div key={idx} className="whitespace-pre-wrap">[{l.ts}] {l.level}: {l.message}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
