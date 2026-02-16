// Zod stub with JSON Schema generation for Bedrock tool schemas.
// Tracks schema structure so z.toJSONSchema() produces valid output.
const identity = (v) => v;
function S(jsonType, extra) {
  const s = {
    _js: { type: jsonType, ...extra },
    parse: identity, safeParse: (v) => ({ success: true, data: v }),
    optional: () => S(jsonType, { ...extra, _optional: true }),
    nullable: () => S(jsonType, { ...extra, nullable: true }),
    describe: (d) => S(jsonType, { ...extra, description: d }),
    default: () => S(jsonType, { ...extra, _optional: true }),
    array: () => S('array', { items: s._js }),
    // passthrough methods that return self
    transform: () => s, refine: () => s, pipe: () => s, brand: () => s,
    catch: () => s, readonly: () => s, strip: () => s, strict: () => s,
    superRefine: () => s, url: () => s, or: () => s,
    // object methods
    extend: (shape) => S('object', { ...extra, properties: { ...(extra?.properties || {}), ...mapShape(shape) } }),
    merge: (other) => S('object', { ...extra, properties: { ...(extra?.properties || {}), ...(other?._js?.properties || {}) } }),
    pick: () => s, omit: () => s, partial: () => s, required: () => s, passthrough: () => s, keyof: () => s,
    shape: extra?.properties || {},
    _def: { typeName: jsonType === 'object' ? 'ZodObject' : 'Zod' + jsonType.charAt(0).toUpperCase() + jsonType.slice(1) },
    _type: undefined, _output: undefined, _input: undefined,
    and: () => s, isOptional: () => !!extra?._optional, isNullable: () => !!extra?.nullable,
    // for enum
    options: extra?._values || [],
  };
  return s;
}
function mapShape(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v._js || { type: 'string' };
  return out;
}
function toJSONSchema(s) {
  if (!s?._js) return { type: 'object', properties: {} };
  const j = s._js;
  const out = {};
  if (j.description) out.description = j.description;
  if (j.type === 'object') {
    out.type = 'object';
    out.properties = {};
    const req = [];
    for (const [k, v] of Object.entries(j.properties || {})) {
      out.properties[k] = toJSONSchema({ _js: v });
      if (!v._optional) req.push(k);
    }
    if (req.length) out.required = req;
  } else if (j.type === 'array') {
    out.type = 'array';
    if (j.items) out.items = toJSONSchema({ _js: j.items });
  } else if (j.type === 'enum') {
    out.type = 'string';
    if (j._values) out.enum = j._values;
  } else if (j.type === 'record') {
    out.type = 'object';
    if (j._valueType) out.additionalProperties = toJSONSchema({ _js: j._valueType });
  } else {
    out.type = j.type || 'string';
  }
  return out;
}
const z = {
  string: () => S('string'),
  number: () => S('number'),
  boolean: () => S('boolean'),
  object: (shape) => S('object', { properties: shape ? mapShape(shape) : {} }),
  array: (item) => S('array', { items: item?._js }),
  enum: (vals) => S('enum', { _values: vals }),
  record: (k, v) => S('record', { _valueType: (v || k)?._js }),
  literal: (val) => S('string', { enum: [val] }),
  union: () => S('string'),
  any: () => S('string'),
  unknown: () => S('string'),
  void: () => { const s = S('object'); s._def = { typeName: 'ZodVoid' }; return s; },
  never: () => S('string'),
  lazy: (fn) => fn(),
  custom: () => S('string'),
  instanceof: () => S('string'),
  coerce: null, // set below
  NEVER: Symbol('NEVER'),
  toJSONSchema,
  // Zod class exports
  ZodType: class {}, ZodObject: class {}, ZodString: class {},
};
z.coerce = z;
export default z;
export { z };
export const ZodType = class {};
export const ZodObject = class {};
export const ZodString = class {};
export const ZodVoid = class {};
export const ZodError = class extends Error { constructor(issues) { super('ZodError'); this.issues = issues || []; } };
export const ZodFirstPartyTypeKind = new Proxy({}, { get: (_, p) => p });
export const ZodIssueCode = new Proxy({}, { get: (_, p) => p });
export const ZodParsedType = new Proxy({}, { get: (_, p) => p });
export { z as z4, z as z4mini };
