/**
 * A restricted expression evaluator for salary rule formulas.
 *
 * Salary rules are configuration, entered through a form and stored in the
 * database. Evaluating that with `eval` or `new Function` would hand anyone
 * who can edit a rule the ability to run arbitrary code on the payroll server.
 *
 * So this parses the expression into an AST and walks it, and the grammar
 * simply has no production for anything dangerous: no function declarations,
 * no assignment other than to `result`, no loops, no `require`, no `process`,
 * no property access that is not an allowlisted identifier. Those are not
 * blocked by a denylist that can be worked around; they cannot be parsed
 * (guardrail 10.5).
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export interface FormulaContext {
  /** Amounts already computed this payslip, by rule code. */
  rules: Record<string, number>;
  /** Running category totals, by category. */
  categories: Record<string, number>;
  /** Contract wage in paise, plus period facts. */
  contract: { wage: number };
  worked: {
    days: number;
    minutes: number;
    leaveDays: number;
    overtimeMinutes: number;
  };
  employee: { seniorityYears: number };
}

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type TokenType = 'number' | 'string' | 'ident' | 'punct' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const PUNCT = [
  '===',
  '!==',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '==',
  '!=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '(',
  ')',
  '[',
  ']',
  ',',
  '?',
  ':',
  '.',
  '=',
];

function tokenise(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i] ?? '';

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let j = i;
      while (j < source.length && /[0-9_.]/.test(source[j] ?? '')) {
        j += 1;
      }
      tokens.push({ type: 'number', value: source.slice(i, j), pos: i });
      i = j;
      continue;
    }

    if (char === "'" || char === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== char) {
        if (source[j] === '\\') {
          throw new FormulaError(
            'Escape sequences are not allowed in formulas',
          );
        }
        j += 1;
      }
      if (j >= source.length) {
        throw new FormulaError('Unterminated string');
      }
      tokens.push({ type: 'string', value: source.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_$]/.test(source[j] ?? '')) {
        j += 1;
      }
      tokens.push({ type: 'ident', value: source.slice(i, j), pos: i });
      i = j;
      continue;
    }

    const punct = PUNCT.find((candidate) => source.startsWith(candidate, i));
    if (punct !== undefined) {
      tokens.push({ type: 'punct', value: punct, pos: i });
      i += punct.length;
      continue;
    }

    // Backticks, semicolons, braces and arrows all land here. There is no
    // production for them, so template literals, statements, object literals
    // and arrow functions are unparseable rather than merely discouraged.
    throw new FormulaError(
      `Unexpected character ${JSON.stringify(char)} at position ${String(i)}`,
    );
  }

  tokens.push({ type: 'eof', value: '', pos: source.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

type Node =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'ident'; name: string }
  | { kind: 'member'; object: Node; property: Node; computed: boolean }
  | { kind: 'call'; callee: Node; args: Node[] }
  | { kind: 'unary'; op: string; argument: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'logical'; op: string; left: Node; right: Node }
  | { kind: 'conditional'; test: Node; consequent: Node; alternate: Node };

/** Binding power for each binary operator, loosest first. */
const BINARY_PRECEDENCE: Record<string, number> = {
  '??': 1,
  '||': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '<': 5,
  '>': 5,
  '<=': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
};

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.index] ?? { type: 'eof', value: '', pos: -1 };
  }

  private next(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private expect(value: string): void {
    const token = this.next();
    if (token.value !== value) {
      throw new FormulaError(
        `Expected ${value} but found ${token.value || 'end of expression'}`,
      );
    }
  }

  parseExpression(minPrecedence = 0): Node {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (token.type !== 'punct') {
        break;
      }

      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      this.next();
      const right = this.parseExpression(precedence + 1);
      const kind =
        token.value === '&&' || token.value === '||' || token.value === '??'
          ? 'logical'
          : 'binary';
      left = { kind, op: token.value, left, right };
    }

    if (this.peek().value === '?' && minPrecedence === 0) {
      this.next();
      const consequent = this.parseExpression();
      this.expect(':');
      const alternate = this.parseExpression();
      return { kind: 'conditional', test: left, consequent, alternate };
    }

    return left;
  }

  private parseUnary(): Node {
    const token = this.peek();
    if (
      token.type === 'punct' &&
      (token.value === '-' || token.value === '+' || token.value === '!')
    ) {
      this.next();
      return { kind: 'unary', op: token.value, argument: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();

    for (;;) {
      const token = this.peek();

      if (token.value === '.') {
        this.next();
        const property = this.next();
        if (property.type !== 'ident') {
          throw new FormulaError('Expected a property name after "."');
        }
        node = {
          kind: 'member',
          object: node,
          property: { kind: 'string', value: property.value },
          computed: false,
        };
        continue;
      }

      if (token.value === '[') {
        this.next();
        const property = this.parseExpression();
        this.expect(']');
        node = { kind: 'member', object: node, property, computed: true };
        continue;
      }

      if (token.value === '(') {
        this.next();
        const args: Node[] = [];
        if (this.peek().value !== ')') {
          for (;;) {
            args.push(this.parseExpression());
            if (this.peek().value === ',') {
              this.next();
              continue;
            }
            break;
          }
        }
        this.expect(')');
        node = { kind: 'call', callee: node, args };
        continue;
      }

      break;
    }

    return node;
  }

  private parsePrimary(): Node {
    const token = this.next();

    if (token.type === 'number') {
      const value = Number(token.value.replace(/_/g, ''));
      if (!Number.isFinite(value)) {
        throw new FormulaError(`Invalid number ${token.value}`);
      }
      return { kind: 'number', value };
    }

    if (token.type === 'string') {
      return { kind: 'string', value: token.value };
    }

    if (token.type === 'ident') {
      return { kind: 'ident', name: token.value };
    }

    if (token.value === '(') {
      const node = this.parseExpression();
      this.expect(')');
      return node;
    }

    throw new FormulaError(
      `Unexpected ${token.value || 'end of expression'} in formula`,
    );
  }

  atEnd(): boolean {
    return this.peek().type === 'eof';
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** The only functions a formula may call. */
const MATH_ALLOWLIST = new Set(['min', 'max', 'round', 'floor', 'ceil', 'abs']);

/** The only root identifiers a formula may name. */
const ROOTS = new Set([
  'rules',
  'categories',
  'contract',
  'worked',
  'employee',
  'Math',
]);

interface EvalOptions {
  /** Rule codes whose sequence is at or before the current rule. */
  availableRuleCodes?: ReadonlySet<string>;
  onWarning?: (message: string) => void;
}

function evaluateNode(
  node: Node,
  context: FormulaContext,
  options: EvalOptions,
): unknown {
  switch (node.kind) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'ident': {
      if (!ROOTS.has(node.name)) {
        throw new FormulaError(
          `Unknown identifier "${node.name}". Available: ${[...ROOTS].join(', ')}`,
        );
      }
      if (node.name === 'Math') {
        return 'Math';
      }
      return context[node.name as keyof FormulaContext];
    }

    case 'member': {
      const object = evaluateNode(node.object, context, options);
      const key = String(
        node.computed
          ? evaluateNode(node.property, context, options)
          : (node.property as { value: string }).value,
      );

      if (object === 'Math') {
        if (!MATH_ALLOWLIST.has(key)) {
          throw new FormulaError(`Math.${key} is not available in formulas`);
        }
        return `Math.${key}`;
      }

      // Prototype access is not reachable: these keys are rejected outright
      // rather than looked up.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new FormulaError(`Access to "${key}" is not allowed`);
      }

      if (typeof object !== 'object' || object === null) {
        throw new FormulaError(`Cannot read "${key}" of a non-object`);
      }

      const record = object as Record<string, unknown>;

      // A rule referenced before it has run reads 0 and records a warning,
      // rather than silently feeding undefined into the arithmetic.
      if (!(key in record)) {
        options.onWarning?.(
          `Formula referenced "${key}", which has no value yet; treated as 0`,
        );
        return 0;
      }

      return record[key];
    }

    case 'call': {
      const callee = evaluateNode(node.callee, context, options);
      if (typeof callee !== 'string' || !callee.startsWith('Math.')) {
        throw new FormulaError('Only Math functions may be called');
      }
      const name = callee.slice('Math.'.length);
      const args = node.args.map((arg) =>
        toNumber(evaluateNode(arg, context, options)),
      );
      const fn = (
        Math as unknown as Record<string, (...a: number[]) => number>
      )[name];
      if (fn === undefined) {
        throw new FormulaError(`Math.${name} is not available`);
      }
      return fn(...args);
    }

    case 'unary': {
      const value = evaluateNode(node.argument, context, options);
      if (node.op === '!') {
        return !value;
      }
      return node.op === '-' ? -toNumber(value) : toNumber(value);
    }

    case 'binary': {
      const left = evaluateNode(node.left, context, options);
      const right = evaluateNode(node.right, context, options);

      switch (node.op) {
        case '+':
          return toNumber(left) + toNumber(right);
        case '-':
          return toNumber(left) - toNumber(right);
        case '*':
          return toNumber(left) * toNumber(right);
        case '/': {
          const divisor = toNumber(right);
          if (divisor === 0) {
            // Infinity on a payslip is worse than a failed rule.
            throw new FormulaError('Division by zero');
          }
          return toNumber(left) / divisor;
        }
        case '%': {
          const divisor = toNumber(right);
          if (divisor === 0) {
            throw new FormulaError('Modulo by zero');
          }
          return toNumber(left) % divisor;
        }
        case '<':
          return toNumber(left) < toNumber(right);
        case '>':
          return toNumber(left) > toNumber(right);
        case '<=':
          return toNumber(left) <= toNumber(right);
        case '>=':
          return toNumber(left) >= toNumber(right);
        case '==':
        case '===':
          return left === right;
        case '!=':
        case '!==':
          return left !== right;
        default:
          throw new FormulaError(`Unsupported operator ${node.op}`);
      }
    }

    case 'logical': {
      const left = evaluateNode(node.left, context, options);
      if (node.op === '&&') {
        return left === false || left === 0
          ? left
          : evaluateNode(node.right, context, options);
      }
      if (node.op === '||') {
        return left === false || left === 0 || left === null
          ? evaluateNode(node.right, context, options)
          : left;
      }
      return left ?? evaluateNode(node.right, context, options);
    }

    case 'conditional':
      return evaluateNode(node.test, context, options) === true ||
        toNumber(evaluateNode(node.test, context, options)) !== 0
        ? evaluateNode(node.consequent, context, options)
        : evaluateNode(node.alternate, context, options);

    default:
      throw new FormulaError('Unsupported expression');
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  throw new FormulaError(`Expected a number, received ${typeof value}`);
}

/**
 * Strips an optional leading `result =`, which is how the wireframe writes
 * formulas (`result = categories['BASIC']`).
 */
function stripAssignment(source: string): string {
  const match = /^\s*result\s*=(?!=)([\s\S]*)$/.exec(source);
  if (match?.[1] !== undefined) {
    return match[1];
  }
  if (/[^=!<>]=(?!=)/.test(source)) {
    throw new FormulaError(
      'A formula may only assign to "result", or be a bare expression',
    );
  }
  return source;
}

/** Every identifier the expression reads, for static checks before compute. */
export function referencedRuleCodes(source: string): string[] {
  const codes = new Set<string>();
  const pattern =
    /rules\s*\[\s*['"]([A-Za-z0-9_]+)['"]\s*\]|rules\.([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const code = match[1] ?? match[2];
    if (code !== undefined) {
      codes.add(code);
    }
  }

  return [...codes];
}

/**
 * Evaluates a formula and returns a finite number.
 *
 * A 50 ms budget bounds pathological input. There are no loops in the grammar,
 * so runaway execution is not really reachable, but deeply nested expressions
 * still cost time and payroll should never hang on one bad rule.
 */
export function evaluateFormula(
  source: string,
  context: FormulaContext,
  options: EvalOptions = {},
): number {
  const expression = stripAssignment(source);
  const parser = new Parser(tokenise(expression));
  const ast = parser.parseExpression();

  if (!parser.atEnd()) {
    throw new FormulaError('Unexpected trailing input in formula');
  }

  const startedAt = Date.now();
  const value = evaluateNode(ast, context, options);
  if (Date.now() - startedAt > 50) {
    throw new FormulaError('Formula took too long to evaluate');
  }

  const result = toNumber(value);
  if (!Number.isFinite(result)) {
    throw new FormulaError(
      'Formula produced a value that is not a finite number',
    );
  }
  return result;
}
