/**
 * Runnable example:  bun run examples/hirehub.ts
 * Then open http://localhost:4000/docs
 */
import { defineSchema, Lykos, Validator } from 'lykosjs'
import { OpenAPIManager } from '../src/index.js'
// In your own project: import { OpenAPIManager } from '@lykosjs/openapi'

// 1. Write each schema ONCE: LykosJS validates with it, the docs are generated from it.
const CreateUser = defineSchema({
  name: Validator.string(2, 50).required(),
  email: Validator.string(3, 255).email().required(),
  role: Validator.enum(['admin', 'member']).nullable(),
  password: Validator.string(8, 40).required().confirmed(),
})
const UserQuery = defineSchema({
  page: Validator.number(1, 10).nullable(),
  search: Validator.text().nullable(),
})
const UserParams = defineSchema({ id: Validator.string(2, 255).required() })
const UserResponse = defineSchema({
  id: Validator.string(2, 255).required(),
  name: Validator.text().required(),
  email: Validator.string(3, 255).email().required(),
})

// 2. Register routes as usual: no documentation metadata here.
const app = new Lykos()

app.GET('/users', (_ctx, reply) => reply.json([]))

app.POST('/users', async (ctx, reply) => {
  const result = Validator.validate(await ctx.json<Record<string, unknown>>(), CreateUser)
  if (!result.valid) return reply.json({ errors: result.errors }, 422)
  return reply.json({ id: '1', name: result.data }, 201)
})

app.GET('/users/:id', (ctx, reply) =>
  reply.json({ id: ctx.params['id'], name: 'Jhon Doe', email: 'jhon@example.com' }),
)

// 3. Document everything in one place, then set it up AFTER the routes exist.
const openapi = new OpenAPIManager({
  info: {
    title: 'HireHub REST API',
    version: '1.0.0',
    description: 'HireHub REST API Documentation',
  },
  docs: '/docs',
  json: '/docs/json',
  securitySchemes: {
    BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },

  routes: {
    getUsers: {
      method: 'GET',
      path: '/users',
      summary: 'Get all users',
      description: 'Returns all registered users',
      tags: ['Users'],
      security: ['BearerAuth'],
      request: { query: UserQuery },
      response: {
        200: { description: 'Users retrieved successfully' },
        401: { description: 'Unauthorized' },
      },
    },
    createUser: {
      method: 'POST',
      path: '/users',
      summary: 'Create a new user',
      tags: ['Users'],
      request: { body: CreateUser },
      response: {
        201: { description: 'User created successfully', schema: UserResponse },
        422: { description: 'Validation failed' },
      },
    },
    getUser: {
      method: 'GET',
      path: '/users/:id',
      summary: 'Get user by ID',
      tags: ['Users'],
      request: { params: UserParams },
      response: {
        200: { description: 'User found', schema: UserResponse },
        404: { description: 'User not found' },
      },
    },
    // Optional: only documented when it is really registered.
    legacyUsers: {
      method: 'GET',
      path: '/legacy/users',
      isRequired: false,
      deprecated: true,
      response: { 200: { description: 'Legacy list' } },
    },
  },
})

openapi.setup(app)

app.listen(4000, () => {
  console.log('HireHub API on http://localhost:4000  (docs: /docs, spec: /docs/json)')
})
