import type {
  AllocationInput,
  AllocationRow,
  LeaveBalanceRow,
  Paginated,
  TimeOffRequestInput,
  TimeOffRequestRow,
  TimeOffTypeInput,
  TimeOffTypeRow,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

// ---------------------------------------------------------------------------
// Time off types
// ---------------------------------------------------------------------------

export interface TimeOffTypeListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  active?: string | undefined;
}

export function useTimeOffTypes(params: TimeOffTypeListParams = {}) {
  return useQuery({
    queryKey: ['time-off-types', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<TimeOffTypeRow>>(
        '/time-off/types',
        { params },
      );
      return data;
    },
  });
}

export function useTimeOffType(id: string | undefined) {
  return useQuery({
    queryKey: ['time-off-types', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<TimeOffTypeRow>(
        `/time-off/types/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateTimeOffType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeOffTypeInput) => {
      const { data } = await api.post<TimeOffTypeRow>('/time-off/types', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-types'] });
    },
  });
}

export function useUpdateTimeOffType(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeOffTypeInput) => {
      const { data } = await api.patch<TimeOffTypeRow>(
        `/time-off/types/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-types'] });
    },
  });
}

export function useDeleteTimeOffType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/time-off/types/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-types'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

export interface AllocationListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  employeeId?: string | undefined;
  typeId?: string | undefined;
  status?: string | undefined;
}

export function useAllocations(params: AllocationListParams = {}) {
  return useQuery({
    queryKey: ['time-off-allocations', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AllocationRow>>(
        '/time-off/allocations',
        { params },
      );
      return data;
    },
  });
}

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: ['time-off-allocations', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<AllocationRow>(
        `/time-off/allocations/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AllocationInput) => {
      const { data } = await api.post<AllocationRow>(
        '/time-off/allocations',
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
    },
  });
}

export function useUpdateAllocation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AllocationInput) => {
      const { data } = await api.patch<AllocationRow>(
        `/time-off/allocations/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
    },
  });
}

export function useDeleteAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/time-off/allocations/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
    },
  });
}

export function useApproveAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AllocationRow>(
        `/time-off/allocations/${id}/approve`,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
    },
  });
}

export function useRefuseAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AllocationRow>(
        `/time-off/allocations/${id}/refuse`,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface TimeOffRequestListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  employeeId?: string | undefined;
  typeId?: string | undefined;
  status?: string | undefined;
}

export function useTimeOffRequests(params: TimeOffRequestListParams = {}) {
  return useQuery({
    queryKey: ['time-off-requests', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<TimeOffRequestRow>>(
        '/time-off/requests',
        { params },
      );
      return data;
    },
  });
}

export function useTimeOffRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['time-off-requests', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<TimeOffRequestRow>(
        `/time-off/requests/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeOffRequestInput) => {
      const { data } = await api.post<TimeOffRequestRow>(
        '/time-off/requests',
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

export function useUpdateTimeOffRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeOffRequestInput) => {
      const { data } = await api.patch<TimeOffRequestRow>(
        `/time-off/requests/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

export function useDeleteTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/time-off/requests/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
      await queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

export function useApproveTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<TimeOffRequestRow>(
        `/time-off/requests/${id}/approve`,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
      await queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

export function useRefuseTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<TimeOffRequestRow>(
        `/time-off/requests/${id}/refuse`,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      await queryClient.invalidateQueries({
        queryKey: ['time-off-allocations'],
      });
      await queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export function useLeaveBalances(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['time-off-balances', employeeId],
    queryFn: async () => {
      const { data } = await api.get<LeaveBalanceRow[]>('/time-off/balances', {
        params: employeeId !== undefined ? { employeeId } : undefined,
      });
      return data;
    },
    enabled: employeeId !== undefined,
  });
}
