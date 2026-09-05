import { Navigate, Outlet } from 'react-router-dom';

import { Backdrop } from '../components/brand/Backdrop.js';
import { useAuth } from '../lib/auth.js';

import { HeaderStrip } from './HeaderStrip.js';
import { Navbar } from './Navbar.js';

export function AppLayout(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="text-muted eyebrow flex min-h-screen items-center justify-center">
        Loading&hellip;
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen">
      <Backdrop />
      <Navbar />
      <HeaderStrip />
      <main className="mx-auto max-w-[1500px] px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
