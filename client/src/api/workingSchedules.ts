import type {
  Paginated,
  WorkingScheduleInput,
  WorkingScheduleRow,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface WorkingScheduleListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
}

export function useWorkingSchedules(params: WorkingScheduleListParams = {}) {
  return useQuery({
    queryKey: ['working-schedules', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<WorkingScheduleRow>>(
        '/working-schedules',
        { params },
      );
      return data;
    },
  });
}

export function useWorkingSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ['working-schedules', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<WorkingScheduleRow>(
        `/working-schedules/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateWorkingSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkingScheduleInput) => {
      const { data } = await api.post<WorkingScheduleRow>(
        '/working-schedules',
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['working-schedules'] });
    },
  });
}

export function useUpdateWorkingSchedule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkingScheduleInput) => {
      const { data } = await api.patch<WorkingScheduleRow>(
        `/working-schedules/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['working-schedules'] });
    },
  });
}
