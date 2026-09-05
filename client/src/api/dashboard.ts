import type { DashboardData, EmployeeType } from '@payz/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from './client.js';

/**
 * Mirrors `DashboardQuery`, but with the period bounds as the plain
 * `YYYY-MM-DD` strings that come straight off a date input and off the URL —
 * the server's `daySchema` coerces them the rest of the way.
 */
export interface DashboardParams {
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  departmentId?: string | undefined;
  employeeType?: EmployeeType | undefined;
}

export function useDashboard(params: DashboardParams) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/dashboard', { params });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}
