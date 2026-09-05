import {
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  type RuleCategory,
  type SalaryRuleRow,
} from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useSalaryRules, useSalaryStructure } from '../../api/salaryConfig.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

import { CategoryBadge } from './CategoryBadge.js';

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = RULE_CATEGORIES.map((value) => ({
  value,
  label: RULE_CATEGORY_LABELS[value],
}));

export function SalaryRulesListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const structureId = searchParams.get('structureId') ?? undefined;

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RuleCategory | ''>('');
  const [page, setPage] = useState(1);

  const structureQuery = useSalaryStructure(structureId);

  const rulesQuery = useSalaryRules({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
    structureId,
    category: category === '' ? undefined : category,
  });

  const rows = rulesQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<SalaryRuleRow>[]>(
    () => [
      { id: 'name', header: 'Rule Name', accessorKey: 'name' },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.code}</span>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      },
      {
        id: 'structureName',
        header: 'Structure',
        accessorKey: 'structureName',
      },
      {
        id: 'sequence',
        header: 'Sequence',
        accessorKey: 'sequence',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.sequence}</span>
        ),
      },
      {
        id: 'active',
        header: 'Active',
        accessorFn: (row) => (row.active ? 'ACTIVE' : 'INACTIVE'),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.active ? 'ACTIVE' : 'INACTIVE'}
            dot
          />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Salary Rules"
        breadcrumbs={
          structureId !== undefined
            ? [
                { label: 'Salary Structures', to: '/payroll/structures' },
                {
                  label: structureQuery.data?.name ?? 'Structure',
                  to: `/payroll/structures/${structureId}`,
                },
                { label: 'Rules' },
              ]
            : undefined
        }
        subtitle={
          structureId !== undefined
            ? `Filtered to ${structureQuery.data?.name ?? 'this structure'}.`
            : undefined
        }
        actions={
          allowed('create', 'salaryRule') ? (
            <Button
              onClick={() => {
                void navigate(
                  structureId !== undefined
                    ? `/payroll/rules/new?structureId=${structureId}`
                    : '/payroll/rules/new',
                );
              }}
            >
              New
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search rules…"
          className="max-w-64"
          aria-label="Search salary rules"
        />
        <Select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as RuleCategory | '');
            setPage(1);
          }}
          options={CATEGORY_OPTIONS}
          placeholder="All categories"
          className="max-w-48"
          aria-label="Filter by category"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={rulesQuery.isLoading}
        isError={rulesQuery.isError}
        errorMessage="Could not load salary rules. The API may still be starting up."
        emptyTitle="No salary rules found"
        emptyDescription="Try a different search, or add a new rule."
        onRowClick={(row) => {
          void navigate(`/payroll/rules/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {rulesQuery.data !== undefined && (
        <Pagination
          page={rulesQuery.data.page}
          pageSize={rulesQuery.data.pageSize}
          total={rulesQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
