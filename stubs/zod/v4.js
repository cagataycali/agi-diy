// Minimal zod stub — MCP SDK uses zod for protocol validation.
// In browser, we trust server responses and skip validation.
const identity = (v) => v;
const schema = () => ({
  parse: identity, safeParse: (v) => ({ success: true, data: v }),
  optional: schema, nullable: schema, array: schema, object: schema,
  string: schema, number: schema, boolean: schema, enum: schema,
  union: schema, literal: schema, record: schema, tuple: schema,
  intersection: schema, lazy: schema, any: schema, unknown: schema,
  void: schema, never: schema, undefined: schema, null: schema,
  default: schema, transform: schema, refine: schema, pipe: schema,
  describe: schema, brand: schema, catch: schema, readonly: schema,
  extend: schema, merge: schema, pick: schema, omit: schema,
  partial: schema, required: schema, passthrough: schema, strict: schema,
  strip: schema, keyof: schema, shape: {}, _def: { typeName: 'ZodObject' },
  _type: undefined, _output: undefined, _input: undefined,
  and: schema, or: schema, isOptional: () => false, isNullable: () => false,
});
const z = new Proxy(schema(), {
  get(target, prop) {
    if (prop === 'ZodType' || prop === 'ZodObject' || prop === 'ZodString' || prop === 'ZodNumber' ||
        prop === 'ZodBoolean' || prop === 'ZodArray' || prop === 'ZodEnum' || prop === 'ZodUnion' ||
        prop === 'ZodLiteral' || prop === 'ZodRecord' || prop === 'ZodTuple' || prop === 'ZodIntersection' ||
        prop === 'ZodLazy' || prop === 'ZodAny' || prop === 'ZodUnknown' || prop === 'ZodVoid' ||
        prop === 'ZodNever' || prop === 'ZodUndefined' || prop === 'ZodNull' || prop === 'ZodDefault' ||
        prop === 'ZodOptional' || prop === 'ZodNullable') {
      return class { static create = schema; constructor() { return schema(); } };
    }
    if (prop === 'instanceof') return () => schema();
    if (prop === 'custom') return () => schema();
    if (prop === 'coerce') return z;
    if (prop === 'NEVER') return Symbol('NEVER');
    return target[prop] ?? schema;
  }
});
export default z;
export { z };

// Named schema constructors — needed for `import * as z from 'zod/v4'` (MCP SDK auth)
export const string = schema, number = schema, boolean = schema, object = schema, array = schema;
export const record = schema, tuple = schema, union = schema, intersection = schema;
export const literal = schema, lazy = schema, any = schema, unknown = schema;
export const optional = schema, nullable = schema, never = schema;
export const enum_ = schema; export { enum_ as enum };
export const void_ = schema; export { void_ as void };

export const ZodType = class {};
export const ZodObject = class {};
export const ZodString = class {};
export const ZodVoid = class {};
export const ZodError = class extends Error { constructor(issues) { super('ZodError'); this.issues = issues || []; } };
export const ZodFirstPartyTypeKind = new Proxy({}, { get: (_, p) => p });
export const ZodIssueCode = new Proxy({}, { get: (_, p) => p });
export const ZodParsedType = new Proxy({}, { get: (_, p) => p });
export { z as z4, z as z4mini };
