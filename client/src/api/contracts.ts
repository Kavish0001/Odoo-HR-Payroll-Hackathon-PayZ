import type { ContractInput, ContractRow, Paginated } from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface ContractListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  employeeId?: string | undefined;
  status?: string | undefined;
}

/**
 * The single-record GET is expected to carry the raw ids the edit form's
 * selects need (ContractRow only carries display names for the list).
 * Reads fall back to null so the form still renders if the API omits one.
 */
export interface ContractDetail extends ContractRow {
  departmentId?: string | null;
  jobPositionId?: string | null;
  workingScheduleId?: string | null;
  salaryStructureId?: string | null;
}

export function useContracts(params: ContractListParams = {}) {
  return useQuery({
    queryKey: ['contracts', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<ContractRow>>('/contracts', {
        params,
      });
      return data;
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<ContractDetail>(`/contracts/${id ?? ''}`);
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContractInput) => {
      const { data } = await api.post<ContractDetail>('/contracts', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useUpdateContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContractInput) => {
      const { data } = await api.patch<ContractDetail>(
        `/contracts/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}
