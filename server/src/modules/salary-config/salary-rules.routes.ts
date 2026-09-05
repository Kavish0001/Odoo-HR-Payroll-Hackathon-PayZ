import {
  nonEmptyString,
  paginationSchema,
  roundPaise,
  RULE_CATEGORIES,
  rupeesSchema,
  salaryRuleSchema,
  idSchema,
  type SalaryRuleInput,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { conflict, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';
import {
  evaluateFormula,
  FormulaError,
  type FormulaContext,
} from '../payroll/sandbox.js';

import {
  assertRuleSaveable,
  toRuleDefinition,
  toRuleDefinitionFromInput,
  UNSAVED_RULE_ID,
  toSalaryRuleRow,
} from './helpers.js';

export const salaryRulesRouter: Router = Router();

const ruleQuerySchema = paginationSchema.extend({
  structureId: idSchema.optional(),
  category: z.enum(RULE_CATEGORIES).optional(),
});
type RuleQuery = z.infer<typeof ruleQuerySchema>;

const previewSchema = z.object({
  formula: nonEmptyString('Formula', 1000),
  wage: rupeesSchema,
  workedDays: z.number().finite().min(0).max(31),
  seniorityYears: z.number().finite().min(0).max(60),
});

/**
 * A representative payslip snapshot for the formula tester.
 *
 * The preview has no payslip behind it, so `rules` and `categories` used to
 * be empty objects — which made `result = categories['BASIC']`, the very
 * example the project checklist gives, evaluate to 0 and read as a broken
 * formula rather than as a correct formula with nothing to reference. The
 * sandbox treats a missing key as 0 by design (a rule may legitimately run
 * before another), so nothing errors; the author just sees a zero and
 * distrusts the editor.
 *
 * The figures mirror the Regular Salary structure the demo ships with — half
 * the wage as basic, HRA at 40% of basic, LTA at 8%, capped PF, professional
 * tax — so a formula referencing another rule or a category total returns a
 * number an author can sanity check against the payslips they have seen.
 * They are a stand-in, not a computation: the real amounts come from the
 * employee's own structure when the payrun runs, which is why the response
 * flags them rather than leaving the caller to assume otherwise.
 *
 * Deductions are negative here for the same reason they are on a payslip
 * (rule P6): a formula subtracting from a category total must behave in the
 * preview the way it will in production, or the preview is a lie.
 */
export function sampleFormulaContext(
  body: z.infer<typeof previewSchema>,
): FormulaContext {
  // Paise throughout, as everywhere else money is handled.
  const basic = roundPaise(body.wage * 0.5);
  const hra = roundPaise(basic * 0.4);
  const lta = roundPaise(basic * 0.08);
  const standardAllowance = 416_700; // 4,167 a month, the seeded STD rule.
  const allowance = hra + lta + standardAllowance;
  const gross = basic + allowance;
  const providentFund = -Math.min(roundPaise(basic * 0.12), 180_000);
  const professionalTax = -20_000; // 200 a month.
  const deduction = providentFund + professionalTax;

  return {
    rules: {
      BASIC: basic,
      HRA: hra,
      STD: standardAllowance,
      LTA: lta,
      GROSS: gross,
      PF: providentFund,
      PT: professionalTax,
      NET: gross + deduction,
    },
    categories: {
      BASIC: basic,
      ALLOWANCE: allowance,
      GROSS: gross,
      DEDUCTION: deduction,
      NET: gross + deduction,
    },
    contract: { wage: body.wage },
    worked: {
      // Derived from the days the caller typed rather than fixed, so a
      // formula prorating on hours moves when they change the day count.
      // The token overtime is there for the same reason zero-filled rules
      // were a problem: an overtime formula that always previews as 0 looks
      // broken.
      days: body.workedDays,
      minutes: Math.round(body.workedDays * 8 * 60),
      leaveDays: 0,
      overtimeMinutes: 120,
    },
    employee: { seniorityYears: body.seniorityYears },
  };
}

const ruleWithStructure = Prisma.validator<Prisma.SalaryRuleDefaultArgs>()({
  include: { structure: { select: { name: true } } },
});
type RuleWithStructure = Prisma.SalaryRuleGetPayload<typeof ruleWithStructure>;

function toRow(rule: RuleWithStructure) {
  return toSalaryRuleRow(rule, rule.structure.name);
}

function toRuleData(body: SalaryRuleInput) {
  return {
    structureId: body.structureId,
    name: body.name,
    code: body.code,
    category: body.category,
    sequence: body.sequence,
    computationType: body.computationType,
    fixedAmount: body.fixedAmount ?? null,
    percentage: body.percentage ?? null,
    percentageBase: body.percentageBase ?? null,
    percentageRuleCode: body.percentageRuleCode ?? null,
    formula: body.formula ?? null,
    quantity: body.quantity,
    active: body.active,
  };
}

/**
 * Duplicate `code` or `sequence` within a structure (rule P1). The database
 * only reports which unique index fired, so the existing row is looked back
 * up to name it in the message rather than leaving the caller to guess.
 */
async function translateRuleError(
  error: unknown,
  structureId: number,
  body: { sequence: number; code: string },
): Promise<unknown> {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.['target'];
    const fields = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.some((field) => field.includes('sequence'))) {
      const existing = await prisma.salaryRule.findFirst({
        where: { structureId, sequence: body.sequence },
        select: { name: true },
      });
      return conflict(
        `Sequence ${String(body.sequence)} is already used by ${existing?.name ?? 'another rule'}`,
      );
    }

    if (fields.some((field) => field.includes('code'))) {
      const existing = await prisma.salaryRule.findFirst({
        where: { structureId, code: body.code },
        select: { name: true },
      });
      return conflict(
        `Code ${body.code} is already used by ${existing?.name ?? 'another rule'}`,
      );
    }

    return conflict('This rule conflicts with an existing rule');
  }
  return error;
}

salaryRulesRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'salaryRule'),
  validate({ query: ruleQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as RuleQuery;

    const where: Prisma.SalaryRuleWhereInput = {};
    if (query.structureId !== undefined) {
      where.structureId = query.structureId;
    }
    if (query.category !== undefined) {
      where.category = query.category;
    }
    if (query.search !== undefined && query.search.length > 0) {
      where.OR = [
        { name: containsInsensitive(query.search) },
        { code: containsInsensitive(query.search) },
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.salaryRule.findMany({
        where,
        ...ruleWithStructure,
        ...paginationArgs(query),
        orderBy: [{ structure: { name: 'asc' } }, { sequence: 'asc' }],
      }),
      prisma.salaryRule.count({ where }),
    ]);

    res.json(toPaginated(rules.map(toRow), total, query));
  }),
);

// Registered before "/:id" would ever be reached for this path since it is a
// different HTTP method and an exact literal path, but kept here, close to
// the other reads, since it is guarded the same way (read access only).
salaryRulesRouter.post(
  '/preview',
  requireAuth,
  requirePermission('read', 'salaryRule'),
  validate({ body: previewSchema }),
  asyncRoute((req, res) => {
    const body = req.body as z.infer<typeof previewSchema>;

    const context = sampleFormulaContext(body);

    try {
      const value = evaluateFormula(body.formula, context);
      // `illustrative` and `note` travel with the amount so the number can
      // never be read as a real payslip line: the tester runs against a
      // stand-in structure, and an author comparing this against an actual
      // payslip should know why the two differ.
      res.json({
        ok: true,
        amount: roundPaise(value),
        illustrative: true,
        note: 'Sample figures derived from the wage above, not a real payslip.',
      });
    } catch (error) {
      res.json({
        ok: false,
        error:
          error instanceof FormulaError
            ? error.message
            : 'Formula failed to evaluate',
      });
    }

    return Promise.resolve();
  }),
);

salaryRulesRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'salaryRule'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const rule = await prisma.salaryRule.findUnique({
      where: { id },
      ...ruleWithStructure,
    });
    if (rule === null) {
      throw notFound('Salary rule not found');
    }

    res.json(toRow(rule));
  }),
);

salaryRulesRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'salaryRule'),
  validate({ body: salaryRuleSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as SalaryRuleInput;

    const siblings = await prisma.salaryRule.findMany({
      where: { structureId: body.structureId },
    });
    assertRuleSaveable([
      ...siblings.map(toRuleDefinition),
      toRuleDefinitionFromInput(body, UNSAVED_RULE_ID),
    ]);

    try {
      const rule = await prisma.salaryRule.create({
        data: toRuleData(body),
        ...ruleWithStructure,
      });
      res.status(201).json(toRow(rule));
    } catch (error) {
      throw await translateRuleError(error, body.structureId, body);
    }
  }),
);

salaryRulesRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'salaryRule'),
  validate({ params: idParamsSchema, body: salaryRuleSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as SalaryRuleInput;

    const siblings = await prisma.salaryRule.findMany({
      where: { structureId: body.structureId, id: { not: id } },
    });
    assertRuleSaveable([
      ...siblings.map(toRuleDefinition),
      toRuleDefinitionFromInput(body, id),
    ]);

    try {
      const rule = await prisma.salaryRule.update({
        where: { id },
        data: toRuleData(body),
        ...ruleWithStructure,
      });
      res.json(toRow(rule));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Salary rule not found');
      }
      throw await translateRuleError(error, body.structureId, body);
    }
  }),
);

salaryRulesRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'salaryRule'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Soft delete: a payslip line may still reference this rule
      // historically (the FK sets it to null, but the amount and label were
      // already captured), so the row is deactivated, not removed.
      await prisma.salaryRule.update({
        where: { id },
        data: { active: false },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Salary rule not found');
      }
      throw error;
    }
  }),
);
