import type {
  AttendanceInput,
  AttendanceRow,
  AttendanceSession,
  Paginated,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

export interface AttendanceListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  employeeId?: string | undefined;
  status?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export function useAttendanceRecords(params: AttendanceListParams = {}) {
  return useQuery({
    queryKey: ['attendance', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AttendanceRow>>('/attendance', {
        params,
      });
      return data;
    },
  });
}

export function useAttendanceRecord(id: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<AttendanceRow>(`/attendance/${id ?? ''}`);
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttendanceInput) => {
      const { data } = await api.post<AttendanceRow>('/attendance', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useUpdateAttendance(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttendanceInput) => {
      const { data } = await api.patch<AttendanceRow>(
        `/attendance/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

const SESSION_KEY = ['attendance', 'session'];

/** Backs the navbar check-in widget: the caller's own open session, if any. */
export function useAttendanceSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data } = await api.get<AttendanceSession>('/attendance/session');
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } =
        await api.post<AttendanceSession>('/attendance/check-in');
      return data;
    },
    onSuccess: async (session) => {
      queryClient.setQueryData(SESSION_KEY, session);
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'list'] });
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } =
        await api.post<AttendanceSession>('/attendance/check-out');
      return data;
    },
    onSuccess: async (session) => {
      queryClient.setQueryData(SESSION_KEY, session);
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'list'] });
    },
  });
}
