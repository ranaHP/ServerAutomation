import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  role: string;
}

interface SessionState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => set({ token, user }),
  clear: () => set({ token: null, user: null })
}));
