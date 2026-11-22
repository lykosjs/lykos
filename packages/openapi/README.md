# @lykosjs/openapi

Official **OpenAPI 3.1** documentation and **Swagger UI** for the LykosJS framework.

> Write your API documentation in one place. Let LykosJS handle the rest.

This package works with LykosJS only. It reads the routes that are really registered in your application, checks that your documentation matches them, generates the OpenAPI document once, and serves it (with Swagger UI) through LykosJS's own routing.

## Features

- All endpoint documentation in a single constructor call; nothing is added to `GET` / `POST`.
- **Route discovery** from LykosJS's router (`app.readRoutes()`), no file scanning, no regex, no AST.
- **Strict validation**: a documented route must exist with the same method and path (parameter names included). All errors are reported at once.
- **OpenAPI 3.1.0** output, validated against the official OpenAPI 3.1 JSON Schema in the test suite.
- **Validator integration**: LykosJS validation schemas (`defineSchema` / `rules`) are converted to JSON Schema, so you write each schema once.
- Path, query and header parameters, request bodies (`application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`), multiple responses per route.
- Security schemes: HTTP Bearer / JWT, API key (header or query), cookie.
- **Swagger UI served locally** (`swagger-ui-dist`), with a strict Content-Security-Policy. No CDN.
- The document is generated once; documentation requests never regenerate it.
- Strict TypeScript types, no `any` in the public API.

## Installation

```bash
bun add @lykosjs/openapi
```

## Requirements

- Bun >= 1.4 (developed and tested on Bun 1.4.4)
- `lykosjs` **1.0.0** (peer dependency)

> **Important:** `@lykosjs/openapi` requires LykosJS to expose its registered routes through the additive, read-only API `app.readRoutes()`, available in LykosJS 1.0.0. No patch or additional setup is required.
>
> With an older LykosJS, `setup()` fails immediately with a clear error that names the required version.

## Basic usage

```ts
import { Lykos } from 'lykosjs'
import { OpenAPIManager } from '@lykosjs/openapi'

const app = new Lykos()

app.GET('/users', (ctx, reply) => reply.json([]))
app.POST('/users', (ctx, reply) => reply.status(201).json({}))
app.GET('/users/:id', (ctx, reply) => reply.json({ id: ctx.params.id }))

const openapi = new OpenAPIManager({
  info: {
    title: 'HireHub API',
    version: '1.0.0',
    description: 'HireHub REST API Documentation',
  },

  docs: '/docs',
  json: '/docs/json',

  routes: {
    getUsers: {
      method: 'GET',
      path: '/users',
      summary: 'Get all users',
      description: 'Returns all registered users',
      tags: ['Users'],
      response: { 200: { description: 'Users retrieved successfully' } },
    },
    createUser: {
      method: 'POST',
      path: '/users',
      summary: 'Create a new user',
      tags: ['Users'],
      response: { 201: { description: 'User created successfully' } },
    },
    getUser: {
      method: 'GET',
      path: '/users/:id',
      summary: 'Get user by ID',
      response: { 200: { description: 'User found' } },
    },
  },
})

// After ALL application routes have been registered:
openapi.setup(app)

app.listen(4000)
// http://localhost:4000/docs       Swagger UI
// http://localhost:4000/docs/json  OpenAPI document
```

A complete, runnable example is in [`examples/hirehub.ts`](./examples/hirehub.ts): `bun run examples/hirehub.ts`.

## Configuration

```ts
new OpenAPIManager({
  info, // required: { title, version, description?, termsOfService?, contact?, license? }
  routes, // required: Record<documentationKey, OpenAPIRoute> ({} is allowed)
  docs: '/docs', // Swagger UI path, or false to disable. Default '/docs'
  json: '/docs/json', // OpenAPI JSON path, or false to disable. Default '/docs/json'
  servers, // optional: [{ url, description? }]
  securitySchemes, // optional: see Authentication
  middlewares, // optional: LykosJS middlewares applied to the documentation routes only
  swaggerUI, // optional: { title?, persistAuthorization?, docExpansion? }
})
```

- `docs` and `json` must be static paths (no parameters), different from each other. `json` cannot be disabled while `docs` is enabled (the UI reads it).
- Unknown properties anywhere in the configuration are rejected, so a typo like `summery` is an error, not silently ignored.
- The configuration is validated and copied in the constructor; all problems are reported together in one `OpenAPIValidationError`.

### `setup()`, `generate()`, `getDocument()`

| Method          | Behaviour                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup(app)`    | Strict validation, generates the document **once**, registers the documentation routes in `app` (`GET` only). Must be called **after** the application routes are registered. |
| `generate(app)` | Same validation and generation, but registers nothing. Returns a new document each call.                                                                                      |
| `getDocument()` | A copy of the document generated by `setup()`. Throws before `setup()`. Mutating the copy cannot affect what is served.                                                       |

Calling `setup()` again with the **same** application is a no-op (routes are never registered twice). Calling it with a **different** application throws; create one `OpenAPI` instance per application. If `setup()` throws (validation failed), nothing was registered and you can call it again after fixing the problem.

`OpenAPI` never creates a server; it adds routes to your LykosJS application and runs inside its lifecycle.

## Route documentation

```ts
routes: {
  getUser: {                       // documentation key: becomes the operationId, never a path
    method: 'GET',                 // GET | POST | PUT | PATCH | DELETE | HEAD
    path: '/users/:id',            // LykosJS style (:id) or OpenAPI style ({id})
    summary: 'Get user by ID',
    description: 'Markdown is allowed (rendered safely by Swagger UI)',
    tags: ['Users'],
    deprecated: false,
    isRequired: true,              // default true, see Strict validation
    security: ['BearerAuth'],
    request: { /* body | contentType | query | params | headers */ },
    response: { 200: { description: 'User found' } },
  },
}
```

`OPTIONS` cannot be documented: LykosJS's HTTP server answers every `OPTIONS` request (CORS preflight) before routing, so such a route could never be reached. Trying to document one is a configuration error.

## Strict validation

At `setup()` / `generate()` every documented route is compared with the registered routes, on **method and path**. Path parameters are compared by name: LykosJS `/users/:id` equals OpenAPI `/users/{id}`, but not `/users/{userId}`. Trailing slashes are normalized exactly like LykosJS's router does.

| Situation                                                 | Result                                 |
| --------------------------------------------------------- | -------------------------------------- |
| Documented and registered                                 | documented                             |
| Documented, not registered, `isRequired` true (default)   | **error**                              |
| Documented, not registered, `isRequired: false`           | no error, **left out of the document** |
| Registered, not documented                                | fine, not in the document              |
| Same path, different method, or different parameter names | counts as not registered               |

All problems are collected and thrown together:

```text
[LykosJS OpenAPI] Strict Validation Failed

Missing registered routes (2):

Documentation Key: getUsers
Method: GET
Path: /users
Hint: this path is registered with: POST

Documentation Key: getUser
Method: GET
Path: /users/{userId}
Hint: parameter names must match exactly; LykosJS registered GET /users/:id

The documented endpoints were not registered in LykosJS.
```

The documentation routes themselves are also checked: if `docs`, `json` or the asset paths collide with a registered `GET` route (including dynamic ones such as `/:slug`), `setup()` throws instead of taking over that path.

## Request documentation

```ts
request: {
  body: CreateUserSchema,                       // requestBody
  contentType: 'application/json',              // default; or 'application/x-www-form-urlencoded' | 'multipart/form-data'
  query: UserQuerySchema,                       // query parameters
  params: UserParamsSchema,                     // refines the types of path parameters
  headers: UserHeadersSchema,                   // header parameters
}
```

- Path parameters are always extracted from `path` (type `string`, `required: true`). A `params` schema can refine their type; each is emitted once. A `params` field that is not in the path, or a nullable path parameter, is an error.
- Query and header parameters are `required` exactly when the schema field is `required`.
- The request body is `required` when at least one field is `required`.
- `GET` and `HEAD` cannot have a body. Header parameters named `Accept`, `Content-Type` or `Authorization` are rejected (OpenAPI ignores them); use `contentType` or `security`.

## Response documentation

```ts
response: {
  200: { description: 'OK', schema: UserSchema },                          // JSON by default
  201: { description: 'Created', schema: UserSchema, contentType: 'application/vnd.api+json' },
  404: { description: 'Not found' },                                       // no content declared
}
```

Content is declared only when you provide a `schema`; JSON is never assumed otherwise. Statuses `1xx`, `204` and `304` cannot have a schema. Status keys must be integers 100 to 599 (`default` and `2XX` ranges are not supported).

## Validator integration

Pass the same schema you give to `Validator.validate`:

```ts
import { defineSchema, Validator } from 'lykosjs'

const CreateUser = defineSchema({
  name: Validator.string(2, 50).required(),
  email: Validator.string(3, 50).email().required(),
})

// runtime validation
Validator.validate(data, CreateUser)
// documentation: request: { body: CreateUser }
```

The converter describes what LykosJS's `Validator` actually enforces. It does not run validation.

| Validator rule                            | JSON Schema                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `required`                                | listed in `required` (and, for `string`, `minLength` is at least 1: the Validator rejects empty strings) |
| optional field                            | not in `required`                                                                                        |
| `nullable`                                | `type: [T, 'null']` (an `enum` also gets `null`)                                                         |
| `string` / `number` / `boolean` / `array` | `type`                                                                                                   |
| `email`                                   | `type: string`, `format: email`                                                                          |
| `url`                                     | `type: string`, `format: uri`, `pattern: ^https?://`                                                     |
| `enum:a,b`                                | `type: string`, `enum`                                                                                   |
| `minLength` / `maxLength`                 | `minLength` / `maxLength`                                                                                |
| `min` / `max` on `number`                 | `minimum` / `maximum`                                                                                    |
| `min` / `max` on `string`                 | `minLength` / `maxLength` (that is what the Validator checks)                                            |
| `minItems` / `maxItems`                   | `minItems` / `maxItems`                                                                                  |
| `confirmed`                               | adds the `<field>Confirmation` property the Validator compares against                                   |

Anything that cannot be represented faithfully is an error, never silently dropped: unknown rules, incompatible type rules (`string` with `number`), limits on the wrong type (`minItems` on a string), `required` with `nullable`.

What the LykosJS Validator does not have is not inlykosed here: **no nested objects, no integer type, no item schemas for arrays and no custom rules** (the Validator throws on unknown rules, so they cannot be documented either).

The conversion happens once, in the constructor.

## Authentication

Define schemes once, reference them per route. This library only _documents_ authentication; it never handles JWTs or stores tokens.

```ts
new OpenAPIManager({
  info,
  securitySchemes: {
    BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    CookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
  },
  routes: {
    me: {
      method: 'GET',
      path: '/me',
      security: ['BearerAuth'],
      response: { 200: { description: 'OK' } },
    },
  },
})
```

Only routes with `security` are marked as protected. Listing several names means **any one of them** is accepted (OR). A route referencing an undeclared scheme is a configuration error.

## Swagger UI

`GET /docs` serves Swagger UI from the bundled [`swagger-ui-dist`](https://www.npmjs.com/package/swagger-ui-dist) files through LykosJS. The page reads `GET /docs/json`.

- Everything is served by your application: `/docs/assets/swagger-ui.css`, `/docs/assets/swagger-ui-bundle.js`, `/docs/assets/init.js`. Only these three files exist; no request path is used to read files.
- The page has a `Content-Security-Policy` (`script-src 'self'`, `frame-ancestors 'none'`, ...). There are no inline scripts and no external requests (the online validator badge is disabled).
- Descriptions are never put into the HTML; Swagger UI renders them with its own sanitizer.
- The paths are configurable (`docs: '/api-docs', json: '/api-docs/json'`) and either can be turned off (`docs: false` keeps only the JSON).

### Restricting access

The library does not inlykos an authentication system. Use LykosJS's middleware:

```ts
import type { Context, NextFunc, Reply } from 'lykosjs'

const docsGuard = (ctx: Context, reply: Reply, next: NextFunc) =>
  ctx.headers.get('x-docs-key') === process.env.DOCS_KEY
    ? next()
    : new Response('Unauthorized', { status: 401 })

new OpenAPIManager({ info, routes, middlewares: [docsGuard] }) // guards only the documentation routes
```

Global middleware added with `use` **before** `setup()` also applies to the documentation routes (LykosJS attaches global middleware when a route is registered). To hide the documentation entirely, do not call `setup()` (for example in production).

## OpenAPI JSON

`GET /docs/json` serves the pre-serialized document with `application/json; charset=utf-8` and `X-Content-Type-Options: nosniff`. The document is built once in `setup()`; requests only send the stored string.

```json
{
  "openapi": "3.1.0",
  "info": { "title": "HireHub API", "version": "1.0.0" },
  "paths": {
    "/users": {
      "get": {
        "summary": "Get all users",
        "tags": ["Users"],
        "operationId": "getUsers",
        "responses": { "200": { "description": "Users retrieved successfully" } }
      }
    }
  }
}
```

Documentation keys are used only as `operationId`; they never appear as paths.

## Error handling

All configuration, validation and compatibility problems throw `OpenAPIValidationError`:

```ts
import { OpenAPIManager, OpenAPIValidationError } from '@lykosjs/openapi'

try {
  openapi.setup(app)
} catch (error) {
  if (error instanceof OpenAPIValidationError) {
    console.error(error.message) // formatted report
    console.error(error.issues) // structured: 'config' | 'missing-route' | 'docs-conflict'
  }
  throw error
}
```

Errors never include environment variables or secrets.

## TypeScript support

The package ships declarations and uses no `any` in its public API. Schemas are typed with LykosJS's own `ValidationSchema`, so `defineSchema` / `rules` results are accepted and invalid rules are compile errors. Exported types: `OpenAPIOptions`, `OpenAPIRoute`, `OpenAPIRequest`, `OpenAPIResponse`, `OpenAPIResponses`, `OpenAPIMethod`, `OpenAPIInfo`, `OpenAPIServer`, `OpenAPISecurityScheme`, `OpenAPIDocument`, `SwaggerUIOptions`, `LykosJSSchema`, `JsonSchema`, `ValidationIssue`.

## Examples

- [`examples/hirehub.ts`](./examples/hirehub.ts): routes, validator schemas, security, optional and deprecated routes.

## Limitations

- Routes registered after `setup()` are not validated or documented. Call `setup()` last.
- Nested objects, integers, array item types, custom validation rules, response headers, response `default` / ranges, `OPTIONS` operations and OAuth2 / OpenID Connect are not supported, because LykosJS's Validator or server does not provide them or they are outside the current scope.
- `application/x-www-form-urlencoded` and `multipart/form-data` fields reach handlers as strings. LykosJS's Validator checks types strictly, so `number` / `boolean` / `array` rules on form bodies describe the schema, not a value a browser form can send; convert before validating.
- A route with `isRequired: false` whose method or parameter names do not match is treated as not registered and left out silently (that is what optional means).
- Cookie authentication is documented as an `apiKey` scheme with `in: 'cookie'`.
- Runs on Bun, like LykosJS.

## Development

```bash
bun install        # expects the LykosJS repository next to this one: ../lykosjs (built)
bun run check      # typecheck + tests
bun run build      # dist/ (bun build + tsc declarations)
```

`devDependencies.lykosjs` is `file:../lykosjs`; point it at the published version once LykosJS 1.0.0 is released.

## License

MIT. See [LICENSE](./LICENSE).
