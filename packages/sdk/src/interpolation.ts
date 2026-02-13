const tokenRegex = /\{\{([^}]+)\}\}/g;
const singleTokenRegex = /^\s*\{\{([^}]+)\}\}\s*$/;

export type InterpolationContext = {
  trigger: Record<string, unknown>;
  steps: Record<string, { output: Record<string, unknown> }>;
  env: Record<string, string | undefined>;
};

function readPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function resolveExpression(expr: string, ctx: InterpolationContext): unknown {
  const path = expr
    .trim()
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const [root, ...rest] = path;
  if (!root) {
    return undefined;
  }

  if (root === 'trigger') {
    return readPath(ctx.trigger, rest);
  }

  if (root === 'env') {
    return readPath(ctx.env, rest);
  }

  const stepOutput = ctx.steps[root]?.output;
  if (!stepOutput) {
    return undefined;
  }

  // Prefer explicit "{{step.output.path}}" while keeping backward compatibility with "{{step.path}}".
  if (rest[0] === 'output') {
    return readPath(stepOutput, rest.slice(1));
  }
  return readPath(stepOutput, rest);
}

export function resolveTemplate(raw: string, ctx: InterpolationContext): string {
  return raw.replace(tokenRegex, (_, expr: string) => {
    const value = resolveExpression(expr, ctx);
    return value == null ? '' : String(value);
  });
}

export function interpolateObject<T>(input: T, ctx: InterpolationContext): T {
  if (typeof input === 'string') {
    const single = input.match(singleTokenRegex);
    if (single) {
      const value = resolveExpression(single[1] ?? '', ctx);
      return (value == null ? '' : value) as T;
    }
    return resolveTemplate(input, ctx) as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => interpolateObject(item, ctx)) as T;
  }
  if (input && typeof input === 'object') {
    const mapped = Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, interpolateObject(v, ctx)]);
    return Object.fromEntries(mapped) as T;
  }
  return input;
}
