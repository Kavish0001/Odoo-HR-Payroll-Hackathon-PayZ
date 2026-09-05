import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from './client.js';

export interface CompanyOption {
  id: string;
  name: string;
  legalName: string | null;
  currency: string;
}

/** The companies on this deployment, for the dashboard's company filter. */
export function useCompanies(): UseQueryResult<CompanyOption[]> {
  return useQuery({
    queryKey: ['companies', 'options'],
    queryFn: async (): Promise<CompanyOption[]> => {
      const { data } = await api.get<CompanyOption[]>('/companies');
      return data;
    },
    // The list changes about once a deployment.
    staleTime: 5 * 60_000,
  });
}
