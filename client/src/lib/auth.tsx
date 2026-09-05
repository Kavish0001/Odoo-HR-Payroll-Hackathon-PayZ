import {
  type SessionUser,
  type Action,
  type Resource,
  can,
} from '@payz/shared';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { api, isUnauthorized } from '../api/client.js';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Mirrors the server's permission table, for hiding what cannot be used. */
  allowed: (action: Action, resource: Resource) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        const response = await api.get<{ user: SessionUser }>('/auth/me');
        return response.data.user;
      } catch (error) {
        // Not signed in is an expected state, not an error to surface.
        if (isUnauthorized(error)) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const signInMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const response = await api.post<{ user: SessionUser }>(
        '/auth/login',
        input,
      );
      return response.data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['session'], user);
    },
  });

  const signIn = useCallback(
    async (email: string, password: string) => {
      await signInMutation.mutateAsync({ email, password });
    },
    [signInMutation],
  );

  const signOut = useCallback(async () => {
    await api.post('/auth/logout');
    queryClient.setQueryData(['session'], null);
    // Drop every cached record: the next user must not see the last one's data.
    queryClient.clear();
  }, [queryClient]);

  const user = data ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signIn,
      signOut,
      allowed: (action, resource) =>
        user !== null && can(user.roles, action, resource),
    }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
