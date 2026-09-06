import type {
  EligibleEmployee,
  EmployeeType,
  Paginated,
  PayrollWarningRow,
  PayrunRow,
  PayrunStatus,
  PayslipDetail,
  PayslipRow,
  PayslipStatus,
  SalaryStructureRow,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from './client.js';

/**
 * True for the 409 a workflow action gets when another user changed the
 * payrun's `version` first (optimistic locking). Callers use this to show a
 * single "reload" message and refetch, rather than the raw server text,
 * which also covers unrelated 409s (illegal transition, unresolved
 * warnings) that deserve their own message instead.
 */
export function isVersionConflict(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 409;
}

/**
 * All data access for the Payrun/Payslip screens.
 *
 * `preview-eligible` is a plain query-shaped POST (rule W1): it never
 * invalidates anything and nothing here ever calls it through a mutation
 * that could be retried by react-query's mutation machinery in a way that
 * looks like a create.
 */

// ---------------------------------------------------------------------------
// Salary structures (for the wizard's step-one dropdown)
// ---------------------------------------------------------------------------

export function useSalaryStructureOptions() {
  return useQuery({
    queryKey: ['salary-structures', 'options'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SalaryStructureRow>>(
        '/salary-structures',
        { params: { pageSize: 200, active: 'true' } },
      );
      return data.rows;
    },
  });
}

// ---------------------------------------------------------------------------
// Wizard: preview-eligible (read-only) and create
// ---------------------------------------------------------------------------

export interface ExcludedEmployee {
  employeeId: string;
  fullName: string;
  reason: string;
}

export interface PreviewEligibleResult {
  eligible: EligibleEmployee[];
  excluded: ExcludedEmployee[];
}

/**
 * The wire shape for the wizard's scope, dates as plain `YYYY-MM-DD` strings
 * from a date input. `PayrunScopeInput`/`CreatePayrunInput` in `@payz/shared`
 * describe the *parsed* (post-`z.coerce.date()`) shape the server produces,
 * not what the browser actually sends, so the request payloads are typed
 * here instead.
 */
export interface PayrunScopePayload {
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
  employeeTypeScope?: EmployeeType | undefined;
}

export interface CreatePayrunPayload extends PayrunScopePayload {
  name: string;
  employeeIds: string[];
}

/** POST /payruns/preview-eligible. Read-only: creates nothing (rule W1). */
export function usePreviewEligible() {
  return useMutation({
    mutationFn: async (scope: PayrunScopePayload) => {
      const { data } = await api.post<PreviewEligibleResult>(
        '/payruns/preview-eligible',
        scope,
      );
      return data;
    },
  });
}

export interface PayrunDetail extends PayrunRow {
  salaryStructureId: string;
  payslips: PayslipRow[];
  warnings: PayrollWarningRow[];
}

export function useCreatePayrun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePayrunPayload) => {
      const { data } = await api.post<PayrunDetail>('/payruns', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payruns'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Payruns
// ---------------------------------------------------------------------------

export interface PayrunListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: PayrunStatus | undefined;
  year?: number | undefined;
}

export function usePayruns(params: PayrunListParams = {}) {
  return useQuery({
    queryKey: ['payruns', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PayrunRow>>('/payruns', {
        params,
      });
      return data;
    },
  });
}

export function usePayrun(id: string | undefined) {
  return useQuery({
    queryKey: ['payruns', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<PayrunDetail>(`/payruns/${id ?? ''}`);
      return data;
    },
    enabled: id !== undefined,
  });
}

interface WorkflowActionInput {
  id: string;
  version: number;
}

function useWorkflowAction(path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: WorkflowActionInput) => {
      const { data } = await api.post<PayrunDetail>(path(id), { version });
      return data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['payruns'] });
      await queryClient.invalidateQueries({ queryKey: ['payslips'] });
      queryClient.setQueryData(['payruns', 'detail', variables.id], _data);
    },
  });
}

export function useComputePayrun() {
  return useWorkflowAction((id) => `/payruns/${id}/compute`);
}

export function useValidatePayrun() {
  return useWorkflowAction((id) => `/payruns/${id}/validate`);
}

export function useMarkPayrunPaid() {
  return useWorkflowAction((id) => `/payruns/${id}/mark-paid`);
}

export function useCancelPayrun() {
  return useWorkflowAction((id) => `/payruns/${id}/cancel`);
}

export interface SendPayslipsResult {
  sent: number;
  failed: number;
  results: {
    payslipId: string;
    employeeId: string;
    success: boolean;
    error?: string;
  }[];
  payrun: PayrunDetail;
}

export function useSendPayslips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: WorkflowActionInput) => {
      const { data } = await api.post<SendPayslipsResult>(
        `/payruns/${id}/send-payslips`,
        { version },
      );
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['payruns'] });
      await queryClient.invalidateQueries({ queryKey: ['payslips'] });
      queryClient.setQueryData(
        ['payruns', 'detail', data.payrun.id],
        data.payrun,
      );
    },
  });
}

export function useAcknowledgeWarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payrunId,
      warningId,
    }: {
      payrunId: string;
      warningId: string;
    }) => {
      const { data } = await api.post<PayrunDetail>(
        `/payruns/${payrunId}/warnings/${warningId}/acknowledge`,
      );
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['payruns', 'detail', data.id], data);
      await queryClient.invalidateQueries({ queryKey: ['payruns'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

export interface PayslipListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  payrunId?: string | undefined;
  employeeId?: string | undefined;
  status?: PayslipStatus | undefined;
}

export function usePayslips(params: PayslipListParams = {}) {
  return useQuery({
    queryKey: ['payslips', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PayslipRow>>('/payslips', {
        params,
      });
      return data;
    },
  });
}

export function usePayslip(id: string | undefined) {
  return useQuery({
    queryKey: ['payslips', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<PayslipDetail>(`/payslips/${id ?? ''}`);
      return data;
    },
    enabled: id !== undefined,
  });
}

/** Relative so it rides the same origin/cookie as the rest of the API in dev and prod. */
export function payslipPdfUrl(id: string): string {
  return `/api/payslips/${id}/pdf`;
}

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

/**
 * Removes a payrun and its payslips. ADMIN only, and the API refuses once the
 * run is VALIDATED or PAID -- that is payroll history, and `cancel` is the
 * non-destructive way to retire it.
 */
export function useDeletePayrun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/payruns/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payruns'] });
      await queryClient.invalidateQueries({ queryKey: ['payslips'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
