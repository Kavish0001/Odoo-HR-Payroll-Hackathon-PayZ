import {
  type CreateUserInput,
  type Paginated,
  type Role,
  type UpdateUserInput,
  type UserStatus,
} from '@payz/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from './client.js';

export interface UserRow {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  employeeId: string | null;
  employeeName: string | null;
  departmentName: string | null;
  lastLoginAt: string | null;
}

export interface UserQueryParams {
  search?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
}

export function useUsers(
  params: UserQueryParams = {},
): UseQueryResult<Paginated<UserRow>> {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const response = await api.get<Paginated<UserRow>>('/users', { params });
      return response.data;
    },
  });
}

export function useUser(id: string | undefined): UseQueryResult<UserRow> {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const response = await api.get<UserRow>(`/users/${id ?? ''}`);
      return response.data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateUser(): UseMutationResult<
  UserRow,
  unknown,
  CreateUserInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await api.post<UserRow>('/users', input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser(
  id: string,
): UseMutationResult<UserRow, unknown, UpdateUserInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const response = await api.patch<UserRow>(`/users/${id}`, input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeactivateUser(): UseMutationResult<
  UserRow,
  unknown,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<UserRow>(`/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
