import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import './styles/index.css';

/**
 * Cache policy, set for an application several people use at once.
 *
 * It previously held every list for thirty seconds and never refetched when a
 * tab regained focus, which is fine for one person clicking around and wrong
 * for everyone else: an employee filing a leave request left the approver's
 * open tab showing a queue without it, and switching back to that tab did not
 * fix it. Nothing was broken server-side -- the request was there on every
 * read -- the browser just never asked again.
 *
 * Refetching on focus is what makes "I applied, can you approve it" work
 * across two accounts. The short stale time keeps that from firing on every
 * incidental focus while still being far shorter than the pause between two
 * people talking to each other.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
