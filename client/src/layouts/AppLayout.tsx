import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../lib/auth.js';

import { Navbar } from './Navbar.js';

export function AppLayout(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="text-muted flex min-h-screen items-center justify-center font-mono text-sm">
        Loading&hellip;
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
