import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  /** true cuando el usuario llega desde el enlace de "recuperar contraseña" */
  recuperandoPassword: boolean;
  errorPerfil: string | null;
  cerrarSesion: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
  terminarRecuperacion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [recuperandoPassword, setRecuperandoPassword] = useState(
    () => typeof window !== 'undefined' && /type=recovery/.test(window.location.hash),
  );

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSession(data.session);
      setSesionLista(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      setSession(nuevaSesion);
      setSesionLista(true);
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoPassword(true);
      if (evento === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const perfilQuery = useQuery({
    queryKey: ['perfil', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data as Perfil | null;
    },
  });

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    setRecuperandoPassword(false);
    queryClient.clear();
  }, [queryClient]);

  const recargarPerfil = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['perfil', userId] });
  }, [queryClient, userId]);

  const valor = useMemo<AuthContextValue>(
    () => ({
      session,
      perfil: perfilQuery.data ?? null,
      cargando: !sesionLista || (Boolean(userId) && perfilQuery.isLoading),
      recuperandoPassword,
      errorPerfil: perfilQuery.error ? (perfilQuery.error as Error).message : null,
      cerrarSesion,
      recargarPerfil,
      terminarRecuperacion: () => setRecuperandoPassword(false),
    }),
    [session, perfilQuery.data, perfilQuery.isLoading, perfilQuery.error, sesionLista, userId, recuperandoPassword, cerrarSesion, recargarPerfil],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Perfil del usuario autenticado (solo dentro de rutas protegidas). */
export function usePerfil(): Perfil {
  const { perfil } = useAuth();
  if (!perfil) throw new Error('No hay perfil cargado');
  return perfil;
}
