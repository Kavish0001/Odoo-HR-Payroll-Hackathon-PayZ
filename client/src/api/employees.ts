import type {
  EmployeeDetail,
  EmployeeInput,
  EmployeeSelfInput,
  EmployeeRow,
  Paginated,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface EmployeeListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  departmentId?: string | undefined;
}

/**
 * `enabled` is here so a form can decline to fetch a list it only needs in
 * order to offer a choice. A role that cannot change the field has no use for
 * the options, and in several cases no permission to read them either.
 */
export function useEmployees(params: EmployeeListParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['employees', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<EmployeeRow>>('/employees', {
        params,
      });
      return data;
    },
    enabled,
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

/**
 * Accepts either payload the API accepts: the whole record from HR, or the
 * contact-and-bank subset an employee may change on their own record.
 */
export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeeInput | EmployeeSelfInput) => {
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
