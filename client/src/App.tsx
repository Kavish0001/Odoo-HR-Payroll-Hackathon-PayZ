import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout.js';
import { AuthProvider } from './lib/auth.js';
import { ContractFormPage } from './pages/contracts/ContractFormPage.js';
import { ContractsListPage } from './pages/contracts/ContractsListPage.js';
import { DepartmentFormPage } from './pages/departments/DepartmentFormPage.js';
import { DepartmentsListPage } from './pages/departments/DepartmentsListPage.js';
import { EmployeeFormPage } from './pages/employees/EmployeeFormPage.js';
import { EmployeesListPage } from './pages/employees/EmployeesListPage.js';
import { AttendanceFormPage } from './pages/attendance/AttendanceFormPage.js';
import { AttendanceListPage } from './pages/attendance/AttendanceListPage.js';
import { PayrollDashboardPage } from './pages/dashboard/PayrollDashboardPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { SalaryRuleFormPage } from './pages/salaryConfig/SalaryRuleFormPage.js';
import { SalaryRulesListPage } from './pages/salaryConfig/SalaryRulesListPage.js';
import { SalaryStructureFormPage } from './pages/salaryConfig/SalaryStructureFormPage.js';
import { SalaryStructuresListPage } from './pages/salaryConfig/SalaryStructuresListPage.js';
import { Placeholder } from './pages/Placeholder.js';
import { WorkingScheduleFormPage } from './pages/workingSchedules/WorkingScheduleFormPage.js';
import { WorkingSchedulesListPage } from './pages/workingSchedules/WorkingSchedulesListPage.js';

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
            <Route path="/employees" element={<EmployeesListPage />} />
            <Route path="/employees/:id" element={<EmployeeFormPage />} />
            <Route path="/departments" element={<DepartmentsListPage />} />
            <Route path="/departments/:id" element={<DepartmentFormPage />} />
            <Route
              path="/working-schedules"
              element={<WorkingSchedulesListPage />}
            />
            <Route
              path="/working-schedules/:id"
              element={<WorkingScheduleFormPage />}
            />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/:id" element={<ContractFormPage />} />
            <Route path="/attendance" element={<AttendanceListPage />} />
            <Route path="/attendance/:id" element={<AttendanceFormPage />} />
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
              element={<SalaryStructuresListPage />}
            />
            <Route
              path="/payroll/structures/:id"
              element={<SalaryStructureFormPage />}
            />
            <Route path="/payroll/rules" element={<SalaryRulesListPage />} />
            <Route path="/payroll/rules/:id" element={<SalaryRuleFormPage />} />
            <Route path="/dashboard" element={<PayrollDashboardPage />} />
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
