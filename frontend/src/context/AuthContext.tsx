import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api.ts';

interface Nurse {
  id: number;
  ward_id: number;
  name: string;
  email: string;
  grade: string;  // HN | CN | RN | AN
  sort_order: number;
  is_night_dedicated: boolean;
  monthly_annual_leave: number;
}

interface AuthContextValue {
  nurse: Nurse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [nurse, setNurse] = useState<Nurse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      auth.me()
        .then(setNurse)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    localStorage.setItem('token', res.access_token);
    setNurse(res.nurse);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setNurse(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      nurse,
      loading,
      login,
      logout,
      isAdmin: nurse?.grade === 'HN',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
