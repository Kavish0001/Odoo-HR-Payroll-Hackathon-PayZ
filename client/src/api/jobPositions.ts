import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from './client.js';

export interface JobPositionOption {
  id: string;
  title: string;
}

/**
 * Lightweight lookup for the job-position selects on the employee and
 * contract forms. This module has no dedicated screen in this lane, so a
 * missing endpoint (404) degrades to an empty list rather than an error.
 */
export function useJobPositions() {
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
