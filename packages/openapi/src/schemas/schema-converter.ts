import type {
  ConvertedField,
  ConvertedSchema,
  JsonObjectSchema,
  JsonSchema,
  JsonSchemaTypeName,
} from '../types/schema.types.js'
import { isRecord } from '../utils/guards.js'

/** Thrown when a LykosJS schema cannot be represented faithfully as JSON Schema. */
export class SchemaConversionError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(problems.join('; '))
    this.name = 'SchemaConversionError'
    this.problems = problems
  }
}

// Mirrors LykosJS's fluent `Validator` (src/validation/field-builder.ts and compile.ts).
// The converter does not execute validation; it only describes what the Validator enforces.
//
// Every validator is a `FieldBuilder` holding an immutable `definition`. The builder already
// rejects illegal rules while it is being built (wrong rule for the kind, `min > max`,
// duplicates, `email` + `url`), so this file only has to translate a valid definition.

type LykosKind = 'string' | 'text' | 'number' | 'boolean' | 'array' | 'enum' | 'date' | 'object'

type LimitName = 'min' | 'max' | 'minLength' | 'maxLength' | 'minItems' | 'maxItems'

/** The part of LykosJS's `FieldDef` that the converter reads. */
interface FieldDefinition {
  readonly kind: LykosKind
  readonly required: boolean
  readonly nullable: boolean
  readonly email: boolean
  readonly url: boolean
  readonly confirmed: boolean
  readonly limits: Readonly<Partial<Record<LimitName, number>>>
  readonly options: readonly string[] | undefined
  readonly shape: Readonly<Record<string, unknown>> | undefined
}

const KINDS: ReadonlySet<string> = new Set<LykosKind>([
  'string',
  'text',
  'number',
  'boolean',
  'array',
  'enum',
  'date',
  'object',
])

// Same formats as LykosJS's `parseDate`: a calendar date, or a date-time that carries an
// explicit offset (`Z` or `±HH:mm`). A date-time without an offset is rejected by the Validator.
// No JSON Schema `format` is set, because `date` and `date-time` are both accepted.
const DATE_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$'
const DATE_DESCRIPTION =
  'ISO 8601: YYYY-MM-DD, or a date-time with an explicit offset (Z or ±HH:mm).'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Reads the definition of a LykosJS validator. Duck-typed on purpose: it does not depend on
 * the `FieldBuilder` class being importable, and it rejects anything that is not a validator
 * (for example the removed `rules([...])` arrays).
 */
function readDefinition(builder: unknown): FieldDefinition | undefined {
  if (!isObject(builder)) return undefined

  const definition = builder['definition']
  if (!isObject(definition)) return undefined

  const kind = definition['kind']
  if (typeof kind !== 'string' || !KINDS.has(kind)) return undefined
  if (!isObject(definition['limits'])) return undefined

  return definition as unknown as FieldDefinition
}

function jsonTypeOf(kind: LykosKind): JsonSchemaTypeName {
  switch (kind) {
    case 'string':
    case 'text':
    case 'enum':
    case 'date':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
  }
}

function toObjectSchema(fields: readonly ConvertedField[]): JsonObjectSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const field of fields) {
    properties[field.name] = field.schema
    if (field.required) required.push(field.name)
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Converts one validator. `path` is the full path used in messages ("address.city"),
 * `key` is the property name inside its own object ("city").
 */
function convertField(
  path: string,
  key: string,
  def: FieldDefinition,
  problems: string[],
): ConvertedField[] {
  const { kind, required, nullable, limits } = def

  if (required && nullable) {
    problems.push(`field "${path}": ".required()" and ".nullable()" cannot be combined`)
    return []
  }

  const before = problems.length
  const schema: { -readonly [K in keyof JsonSchema]: JsonSchema[K] } = {}

  const type = jsonTypeOf(kind)
  schema.type = nullable ? ([type, 'null'] satisfies JsonSchemaTypeName[]) : type

  const isText = kind === 'string' || kind === 'text'

  if (isText) {
    if (def.email) schema.format = 'email'
    if (def.url) {
      schema.format = 'uri'
      schema.pattern = '^https?://'
    }

    // The Validator treats empty / whitespace-only strings as missing for required fields.
    let minLength = limits.minLength
    if (required) minLength = Math.max(minLength ?? 0, 1)

    if (minLength !== undefined) schema.minLength = minLength
    if (limits.maxLength !== undefined) schema.maxLength = limits.maxLength
  }

  if (kind === 'number') {
    if (limits.min !== undefined) schema.minimum = limits.min
    if (limits.max !== undefined) schema.maximum = limits.max
  }

  if (kind === 'array') {
    if (limits.minItems !== undefined) schema.minItems = limits.minItems
    if (limits.maxItems !== undefined) schema.maxItems = limits.maxItems
  }

  if (kind === 'enum') {
    if (def.options === undefined || def.options.length === 0) {
      problems.push(`field "${path}": enum validator has no options`)
    } else {
      schema.enum = nullable ? [...def.options, null] : [...def.options]
    }
  }

  if (kind === 'date') {
    schema.pattern = DATE_PATTERN
    schema.description = DATE_DESCRIPTION
  }

  if (kind === 'object') {
    if (def.shape === undefined) {
      problems.push(`field "${path}": object validator has no shape`)
    } else {
      // Nested fields are converted with the same rules; their paths are prefixed ("address.city").
      const nested = toObjectSchema(convertFields(def.shape, `${path}.`, problems))
      schema.properties = nested.properties
      if (nested.required !== undefined) schema.required = nested.required
    }
  }

  if (problems.length > before) return []

  const converted: ConvertedField[] = [{ name: key, required, schema }]

  // `confirmed` makes the Validator compare the value with `<key>Confirmation`, looked up
  // next to the field (so it also works inside a nested object).
  if (def.confirmed) {
    const { minLength: _min, maxLength: _max, ...confirmationSchema } = schema
    converted.push({
      name: `${key}Confirmation`,
      required,
      schema: { ...confirmationSchema, description: `Must be identical to "${key}".` },
    })
  }

  return converted
}

function convertFields(
  schema: Readonly<Record<string, unknown>>,
  prefix: string,
  problems: string[],
): ConvertedField[] {
  const fields: ConvertedField[] = []
  const declared = new Set(Object.keys(schema))
  const seen = new Set<string>()

  for (const [key, builder] of Object.entries(schema)) {
    const path = prefix + key

    if (key === '' || key === '__proto__') {
      problems.push(`invalid field name "${path}"`)
      continue
    }

    const def = readDefinition(builder)

    if (def === undefined) {
      problems.push(
        `field "${path}": expected a LykosJS validator such as Validator.string(3, 50).required(). ` +
          `Rule arrays (rules([...])) are no longer supported`,
      )
      continue
    }

    const converted = convertField(path, key, def, problems)

    for (const [index, field] of converted.entries()) {
      // An explicitly declared "<field>Confirmation" wins over the derived one,
      // whatever the order of the keys.
      if (index > 0 && declared.has(field.name)) continue
      if (seen.has(field.name)) continue

      seen.add(field.name)
      fields.push(field)
    }
  }

  return fields
}

/**
 * Converts a LykosJS validation schema (the result of `defineSchema`) to a JSON Schema
 * object (OpenAPI 3.1).
 *
 * Conversions are only produced for rules the LykosJS `Validator` really enforces.
 * Anything that cannot be represented faithfully throws a `SchemaConversionError`
 * instead of being silently dropped. Text transformations (`trim`, `lowercase`) change the
 * value the Validator returns but do not constrain the input, so they are not documented.
 */
export function convertSchema(schema: unknown): ConvertedSchema {
  if (!isRecord(schema)) {
    throw new SchemaConversionError([
      'schema must be an object mapping field names to LykosJS validators',
    ])
  }

  const problems: string[] = []
  const fields = convertFields(schema, '', problems)

  if (problems.length > 0) throw new SchemaConversionError(problems)

  return { fields, objectSchema: toObjectSchema(fields) }
}
