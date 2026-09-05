import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from './client.js';

export interface PublicStats {
  employees: number;
  payrollPeriods: number;
  payslips: number;
  payslipLines: number;
  attendanceRecords: number;
  salaryRules: number;
}

/**
 * Workspace counts for the landing page. Public, so it works before sign-in.
 */
export function usePublicStats(): UseQueryResult<PublicStats> {
  return useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const response = await api.get<PublicStats>('/stats');
      return response.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}
