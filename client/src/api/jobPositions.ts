import type { JobPositionInput, Paginated } from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from './client.js';

export interface JobPositionOption {
  id: string;
  title: string;
}

/**
 * No JobPositionRow lives in shared — the server declares this shape locally —
 * so the catalogue screen restates it here rather than inventing a shared type
 * this lane does not own.
 */
export interface JobPositionRow {
  id: string;
  title: string;
  employeeCount: number;
  contractCount: number;
  active: boolean;
}

export interface JobPositionListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  active?: string | undefined;
}

/**
 * Lightweight lookup for the job-position selects on the employee and
 * contract forms. Those forms load before anyone has necessarily visited the
 * catalogue, so a missing endpoint (404) degrades to an empty list rather
 * than failing the whole form.
 */
export function useJobPositionOptions() {
  return useQuery({
    queryKey: ['job-positions', 'options'],
    queryFn: async (): Promise<JobPositionOption[]> => {
      try {
        const { data } = await api.get<{ rows: JobPositionOption[] }>(
          '/job-positions',
          { params: { pageSize: 200 } },
        );
        return data.rows;
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useJobPositions(params: JobPositionListParams = {}) {
  return useQuery({
    queryKey: ['job-positions', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<JobPositionRow>>(
        '/job-positions',
        { params },
      );
      return data;
    },
  });
}

export function useJobPosition(id: string | undefined) {
  return useQuery({
    queryKey: ['job-positions', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<JobPositionRow>(
        `/job-positions/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateJobPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: JobPositionInput) => {
      const { data } = await api.post<JobPositionRow>('/job-positions', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-positions'] });
    },
  });
}

export function useUpdateJobPosition(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: JobPositionInput) => {
      const { data } = await api.patch<JobPositionRow>(
        `/job-positions/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-positions'] });
    },
  });
}

/**
 * A soft delete server-side: employees and contracts keep pointing at the
 * position for their history, it just stops being offered. Invalidates the
 * option lookup too, so the employee and contract forms drop it immediately.
 */
export function useDeleteJobPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/job-positions/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-positions'] });
    },
  });
}
