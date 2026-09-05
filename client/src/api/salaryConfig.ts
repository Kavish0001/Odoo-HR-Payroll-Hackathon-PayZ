import type {
  Paginated,
  RuleCategory,
  SalaryRuleInput,
  SalaryRuleRow,
  SalaryStructureInput,
  SalaryStructureRow,
} from '@payz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client.js';

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

export interface SalaryStructureListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  active?: 'true' | 'false' | undefined;
}

/** The structure plus its rules in sequence order, for the detail screen. */
export interface SalaryStructureDetail extends SalaryStructureRow {
  rules: SalaryRuleRow[];
}

export function useSalaryStructures(params: SalaryStructureListParams = {}) {
  return useQuery({
    queryKey: ['salaryStructures', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SalaryStructureRow>>(
        '/salary-structures',
        { params },
      );
      return data;
    },
  });
}

export function useSalaryStructure(id: string | undefined) {
  return useQuery({
    queryKey: ['salaryStructures', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<SalaryStructureDetail>(
        `/salary-structures/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryStructureInput) => {
      const { data } = await api.post<SalaryStructureDetail>(
        '/salary-structures',
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
    },
  });
}

export function useUpdateSalaryStructure(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryStructureInput) => {
      const { data } = await api.patch<SalaryStructureDetail>(
        `/salary-structures/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Salary rules
// ---------------------------------------------------------------------------

export interface SalaryRuleListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  structureId?: string | undefined;
  category?: RuleCategory | undefined;
}

export function useSalaryRules(params: SalaryRuleListParams = {}) {
  return useQuery({
    queryKey: ['salaryRules', 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SalaryRuleRow>>(
        '/salary-rules',
        { params },
      );
      return data;
    },
  });
}

export function useSalaryRule(id: string | undefined) {
  return useQuery({
    queryKey: ['salaryRules', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<SalaryRuleRow>(
        `/salary-rules/${id ?? ''}`,
      );
      return data;
    },
    enabled: id !== undefined && id !== 'new',
  });
}

export function useCreateSalaryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryRuleInput) => {
      const { data } = await api.post<SalaryRuleRow>('/salary-rules', input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salaryRules'] });
      await queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
    },
  });
}

export function useUpdateSalaryRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryRuleInput) => {
      const { data } = await api.patch<SalaryRuleRow>(
        `/salary-rules/${id}`,
        input,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salaryRules'] });
      await queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Formula preview
// ---------------------------------------------------------------------------

export interface FormulaPreviewInput {
  formula: string;
  /** Rupees; converted to paise by the API. */
  wage: number;
  workedDays: number;
  seniorityYears: number;
}

export type FormulaPreviewResult =
  { ok: true; amount: number } | { ok: false; error: string };

export function useTestSalaryFormula() {
  return useMutation({
    mutationFn: async (input: FormulaPreviewInput) => {
      const { data } = await api.post<FormulaPreviewResult>(
        '/salary-rules/preview',
        input,
      );
      return data;
    },
  });
}
