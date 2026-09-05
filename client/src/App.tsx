import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout.js';
import { AuthProvider } from './lib/auth.js';
import { LoginPage } from './pages/LoginPage.js';
import { Placeholder } from './pages/Placeholder.js';

/**
 * Routes mirror the wireframe navbar. Screens land module by module from P2
 * onward; each renders a placeholder for now so the navigation shape is real
 * and clickable from the start.
 */
export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<AppLayout />}>
            <Route
              path="/employees"
              element={<Placeholder title="Employees" />}
            />
            <Route
              path="/departments"
              element={<Placeholder title="Departments" />}
            />
            <Route
              path="/working-schedules"
              element={<Placeholder title="Working Schedules" />}
            />
            <Route
              path="/contracts"
              element={<Placeholder title="Contracts" />}
            />
            <Route
              path="/attendance"
              element={<Placeholder title="Attendance" />}
            />
            <Route
              path="/time-off/requests"
              element={<Placeholder title="Time Off Requests" />}
            />
            <Route
              path="/time-off/allocations"
              element={<Placeholder title="Allocations" />}
            />
            <Route
              path="/time-off/types"
              element={<Placeholder title="Time Off Types" />}
            />
            <Route
              path="/payroll/payruns"
              element={<Placeholder title="Payruns" />}
            />
            <Route
              path="/payroll/payslips"
              element={<Placeholder title="Payslips" />}
            />
            <Route
              path="/payroll/structures"
              element={<Placeholder title="Salary Structures" />}
            />
            <Route
              path="/payroll/rules"
              element={<Placeholder title="Salary Rules" />}
            />
            <Route
              path="/dashboard"
              element={<Placeholder title="Payroll Dashboard" />}
            />
            <Route
              path="/admin/users"
              element={<Placeholder title="Users" />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/employees" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
