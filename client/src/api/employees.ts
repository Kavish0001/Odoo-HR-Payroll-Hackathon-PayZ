import type { EmployeeDetail, EmployeeInput, EmployeeRow, Paginated } from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface EmployeeListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  departmentId?: string | undefined;
}

export function useEmployees(params: EmployeeListParams = {}) {
  return useQuery({
    queryKey: ['employees', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<EmployeeRow>>('/employees', {
        params,
      });
      return data;
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<EmployeeDetail>(`/employees/${id ?? ''}`);
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const { data } = await api.post<EmployeeDetail>('/employees', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const { data } = await api.patch<EmployeeDetail>(
        `/employees/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
