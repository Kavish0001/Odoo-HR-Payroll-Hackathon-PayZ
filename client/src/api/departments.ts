import type { DepartmentInput, DepartmentRow, Paginated } from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface DepartmentListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
}

/**
 * The single-record GET is expected to carry `managerId` alongside the
 * display-only `managerName` from DepartmentRow, so the edit form can
 * preselect the manager. Falls back gracefully if the API omits it.
 */
export interface DepartmentDetail extends DepartmentRow {
  managerId?: string | null;
}

export function useDepartments(params: DepartmentListParams = {}) {
  return useQuery({
    queryKey: ['departments', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<DepartmentRow>>(
        '/departments',
        { params },
      );
      return data;
    },
  });
}

export function useDepartment(id: string | undefined) {
  return useQuery({
    queryKey: ['departments', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<DepartmentDetail>(
        `/departments/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DepartmentInput) => {
      const { data } = await api.post<DepartmentDetail>(
        '/departments',
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DepartmentInput) => {
      const { data } = await api.patch<DepartmentDetail>(
        `/departments/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}
