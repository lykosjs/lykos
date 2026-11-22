import { describe, expect, test } from 'bun:test'
import { Validator, defineSchema } from 'lykosjs'
import { convertSchema, SchemaConversionError } from '../../src/schemas/schema-converter'

const props = (schema: unknown) => convertSchema(schema).objectSchema.properties
const required = (schema: unknown) => convertSchema(schema).objectSchema.required

describe('convertSchema', () => {
  test('converts the documented example (required string + email)', () => {
    const UserSchema = defineSchema({
      name: Validator.string(2, 255).required(),
      email: Validator.string(3, 255).email().required(),
    })

    expect(convertSchema(UserSchema).objectSchema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 255 },
        email: { type: 'string', format: 'email', minLength: 3, maxLength: 255 },
      },
      required: ['name', 'email'],
    })
  })

  test('string, number and boolean', () => {
    const schema = defineSchema({
      a: Validator.string(1, 50).required(),
      b: Validator.number(1, 10).required(),
      c: Validator.boolean().required(),
    })

    expect(props(schema)).toMatchObject({
      a: { type: 'string', minLength: 1, maxLength: 50 },
      b: { type: 'number', minimum: 1, maximum: 10 },
      c: { type: 'boolean' },
    })
  })

  test('text() is a required string with a minimum length of 1', () => {
    const schema = defineSchema({ a: Validator.text().required() })

    expect(props(schema)['a']).toEqual({ type: 'string', minLength: 1 })
  })

  test('nullable fields are not in "required"', () => {
    const onlyNullable = defineSchema({ a: Validator.string(1, 50).nullable() })
    const mixed = defineSchema({
      a: Validator.string(1, 50).required(),
      b: Validator.number(1, 10).nullable(),
    })

    expect(required(onlyNullable)).toBeUndefined()
    expect(required(mixed)).toEqual(['a'])
  })

  test('nullable uses the OpenAPI 3.1 type array', () => {
    const schema = defineSchema({
      a: Validator.string(1, 50).nullable(),
      b: Validator.number(1, 10).nullable(),
    })

    expect(props(schema)['a']).toMatchObject({ type: ['string', 'null'] })
    expect(props(schema)['b']).toEqual({ type: ['number', 'null'], minimum: 1, maximum: 10 })
  })

  test('string limits map to minLength / maxLength', () => {
    const schema = defineSchema({ a: Validator.string(3, 10).required() })

    expect(props(schema)['a']).toEqual({ type: 'string', minLength: 3, maxLength: 10 })
  })

  test('number limits map to minimum / maximum', () => {
    const schema = defineSchema({ a: Validator.number(1, 255).required() })

    expect(props(schema)['a']).toEqual({ type: 'number', minimum: 1, maximum: 255 })
  })

  test('email adds the email format', () => {
    const schema = defineSchema({ email: Validator.string(5, 255).email().required() })

    expect(props(schema)['email']).toMatchObject({
      type: 'string',
      format: 'email',
      minLength: 5,
      maxLength: 255,
    })
  })

  test('confirmed adds the "<field>Confirmation" property the Validator reads', () => {
    const schema = defineSchema({
      password: Validator.string(8, 40).required().confirmed(),
    })
    const converted = convertSchema(schema).objectSchema

    expect(Object.keys(converted.properties)).toEqual(['password', 'passwordConfirmation'])
    expect(converted.properties['password']).toEqual({
      type: 'string',
      minLength: 8,
      maxLength: 40,
    })
    expect(converted.properties['passwordConfirmation']).toMatchObject({ type: 'string' })
    expect(converted.required).toEqual(['password', 'passwordConfirmation'])
  })

  test('an explicit "<field>Confirmation" wins over the derived one', () => {
    const schema = defineSchema({
      password: Validator.string(8, 40).required().confirmed(),
      passwordConfirmation: Validator.string(8, 40).required(),
    })
    const converted = convertSchema(schema)

    expect(converted.fields.filter((field) => field.name === 'passwordConfirmation')).toHaveLength(
      1,
    )
  })

  describe('rejects what it cannot represent (never silently ignored)', () => {
    test.each([
      [{ a: ['required', 'string'] }],
      [{ a: ['required', 'string', 'minLength:3'] }],
      [{ a: ['nullable', 'number', 'min:1', 'max:5'] }],
      [{ a: ['required', 'enum:a,b'] }],
      [{ a: 'required' }],
      [{ a: ['required', 5] }],
    ])('rule arrays are no longer supported: %j', (schema) => {
      expect(() => convertSchema(schema)).toThrow(SchemaConversionError)
      expect(() => convertSchema(schema)).toThrow('expected a LykosJS validator')
    })

    test('rejects an empty field name', () => {
      expect(() => convertSchema({ '': Validator.string(1, 10).required() })).toThrow(
        SchemaConversionError,
      )
    })

    test.each([[null], [undefined], ['x'], [5], [[]], [[['required']]]])(
      'non-object schema %j',
      (schema) => {
        expect(() => convertSchema(schema)).toThrow(SchemaConversionError)
      },
    )

    test('reports every problem at once', () => {
      try {
        convertSchema({ a: ['required', 'bogus'], b: ['required', 'string', 'min'] })
        throw new Error('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaConversionError)
        expect((error as SchemaConversionError).problems).toHaveLength(2)
      }
    })
  })

  describe('agrees with the real Validator', () => {
    test('a payload accepted by the Validator satisfies the generated limits', () => {
      const schema = defineSchema({
        age: Validator.number(18, 65).required(),
        name: Validator.string(2, 255).required(),
      })
      const { objectSchema } = convertSchema(schema)

      expect(objectSchema.properties['age']).toMatchObject({ minimum: 18, maximum: 65 })
      expect(objectSchema.properties['name']).toMatchObject({ minLength: 2, maxLength: 255 })

      expect(Validator.validate({ age: 17, name: 'ab' }, schema).valid).toBe(false)
      expect(Validator.validate({ age: 70, name: 'ab' }, schema).valid).toBe(false)
      expect(Validator.validate({ age: 30, name: 'a' }, schema).valid).toBe(false)
      expect(Validator.validate({ age: 30, name: 'ab' }, schema).valid).toBe(true)
    })
  })
})
