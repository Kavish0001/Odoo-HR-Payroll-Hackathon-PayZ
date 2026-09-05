import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout.js';
import { RequirePermission } from './layouts/RequirePermission.js';
import { AuthProvider } from './lib/auth.js';
import { UserFormPage } from './pages/admin/UserFormPage.js';
import { UsersListPage } from './pages/admin/UsersListPage.js';
import { AttendanceFormPage } from './pages/attendance/AttendanceFormPage.js';
import { AttendanceListPage } from './pages/attendance/AttendanceListPage.js';
import { ContractFormPage } from './pages/contracts/ContractFormPage.js';
import { ContractsListPage } from './pages/contracts/ContractsListPage.js';
import { PayrollDashboardPage } from './pages/dashboard/PayrollDashboardPage.js';
import { DepartmentFormPage } from './pages/departments/DepartmentFormPage.js';
import { DepartmentsListPage } from './pages/departments/DepartmentsListPage.js';
import { EmployeeFormPage } from './pages/employees/EmployeeFormPage.js';
import { EmployeesListPage } from './pages/employees/EmployeesListPage.js';
import { JobPositionFormPage } from './pages/jobPositions/JobPositionFormPage.js';
import { JobPositionsListPage } from './pages/jobPositions/JobPositionsListPage.js';
import { LandingPage } from './pages/landing/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { PayrunDetailPage } from './pages/payroll/PayrunDetailPage.js';
import { PayrunNewPage } from './pages/payroll/PayrunNewPage.js';
import { PayrunsListPage } from './pages/payroll/PayrunsListPage.js';
import { PayslipDetailPage } from './pages/payroll/PayslipDetailPage.js';
import { PayslipsListPage } from './pages/payroll/PayslipsListPage.js';
import { SalaryRuleFormPage } from './pages/salaryConfig/SalaryRuleFormPage.js';
import { SalaryRulesListPage } from './pages/salaryConfig/SalaryRulesListPage.js';
import { SalaryStructureFormPage } from './pages/salaryConfig/SalaryStructureFormPage.js';
import { SalaryStructuresListPage } from './pages/salaryConfig/SalaryStructuresListPage.js';
import { AllocationFormPage } from './pages/timeoff/AllocationFormPage.js';
import { AllocationsListPage } from './pages/timeoff/AllocationsListPage.js';
import { TimeOffDashboardPage } from './pages/timeoff/TimeOffDashboardPage.js';
import { TimeOffRequestFormPage } from './pages/timeoff/TimeOffRequestFormPage.js';
import { TimeOffRequestsListPage } from './pages/timeoff/TimeOffRequestsListPage.js';
import { TimeOffTypeFormPage } from './pages/timeoff/TimeOffTypeFormPage.js';
import { TimeOffTypesListPage } from './pages/timeoff/TimeOffTypesListPage.js';
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
          {/* Public marketing page, outside the signed-in application. */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<AppLayout />}>
            <Route path="/employees" element={<EmployeesListPage />} />
            <Route path="/employees/:id" element={<EmployeeFormPage />} />
            <Route path="/departments" element={<DepartmentsListPage />} />
            <Route path="/departments/:id" element={<DepartmentFormPage />} />
            <Route path="/job-positions" element={<JobPositionsListPage />} />
            <Route
              path="/job-positions/:id"
              element={<JobPositionFormPage />}
            />
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
              path="/time-off/dashboard"
              element={<TimeOffDashboardPage />}
            />
            <Route
              path="/time-off/requests"
              element={<TimeOffRequestsListPage />}
            />
            <Route
              path="/time-off/requests/:id"
              element={<TimeOffRequestFormPage />}
            />
            <Route
              path="/time-off/allocations"
              element={<AllocationsListPage />}
            />
            <Route
              path="/time-off/allocations/:id"
              element={<AllocationFormPage />}
            />
            <Route path="/time-off/types" element={<TimeOffTypesListPage />} />
            <Route
              path="/time-off/types/:id"
              element={<TimeOffTypeFormPage />}
            />
            <Route path="/payroll/payruns" element={<PayrunsListPage />} />
            <Route path="/payroll/payruns/new" element={<PayrunNewPage />} />
            <Route path="/payroll/payruns/:id" element={<PayrunDetailPage />} />
            <Route path="/payroll/payslips" element={<PayslipsListPage />} />
            <Route
              path="/payroll/payslips/:id"
              element={<PayslipDetailPage />}
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
            {/* Rule R5: account and role management is the admin's alone.
                The API refuses these routes to anyone else regardless; this
                gate makes the refusal a sentence instead of an empty table. */}
            <Route
              element={
                <RequirePermission
                  action="read"
                  resource="user"
                  label="User Management"
                />
              }
            >
              <Route path="/admin/users" element={<UsersListPage />} />
              <Route path="/admin/users/:id" element={<UserFormPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
