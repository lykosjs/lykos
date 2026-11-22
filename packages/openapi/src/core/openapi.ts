import type { OpenAPIDocument } from '../types/openapi.types.js'
import type { OpenAPIOptions } from '../types/route.types.js'
import type { ResolvedOptions } from '../types/internal.types.js'
import { createDocsRoutes } from '../ui/swagger-ui.js'
import { assetBase } from '../ui/swagger-ui.js'
import { findDocsConflicts, validateRegisteredRoutes } from '../validation/route-validator.js'
import { OpenAPIValidationError, type ValidationIssue } from '../validation/validation-error.js'
import { generateDocument } from './generator.js'
import { resolveOptions } from './resolve-options.js'
import type { Lykos } from 'lykosjs'

/** The part of a LykosJS application this library needs. */
export type LykosApplication = Pick<Lykos, 'GET' | 'readRoutes'>

function assertApplication(app: unknown): asserts app is LykosApplication {
  const candidate = app as Partial<Record<keyof LykosApplication, unknown>> | null | undefined

  if (typeof candidate !== 'object' || candidate === null || typeof candidate.GET !== 'function') {
    throw new OpenAPIValidationError(
      [],
      '[LykosJS OpenAPI] setup() expects a LykosJS application instance.',
    )
  }

  if (typeof candidate.readRoutes !== 'function') {
    throw new OpenAPIValidationError(
      [],
      '[LykosJS OpenAPI] Incompatible LykosJS application: it has no readRoutes() route introspection API.',
    )
  }
}

/**
 * OpenAPI 3.1 documentation for a LykosJS application.
 *
 * ```ts
 * const openapi = new OpenAPI({ info, routes: { getUsers: { ... } } })
 * openapi.setup(app) // after every route has been registered
 * ```
 */
export class OpenAPIManager {
  readonly #options: ResolvedOptions
  #app: LykosApplication | undefined
  #document: OpenAPIDocument | undefined

  /**
   * Validates the configuration (including every schema) and throws one
   * `OpenAPIValidationError` listing all problems.
   */
  constructor(options: OpenAPIOptions) {
    this.#options = resolveOptions(options)
  }

  /**
   * Builds the document for the routes currently registered in `app`, after strict validation.
   * Pure: it registers nothing and can be called at any time. Documented routes with
   * `isRequired: false` that are not registered are left out.
   */
  generate(app: LykosApplication): OpenAPIDocument {
    assertApplication(app)
    return this.#build(app)
  }

  /**
   * Validates, generates the document once and registers the documentation routes
   * (`GET <json>`, `GET <docs>` and its assets) in `app`.
   *
   * - Call it AFTER registering every application route: validation and the
   *   document reflect the routes registered at that moment.
   * - Middlewares added with `use` before this call also protect the
   *   documentation; `options.middlewares` applies to it only.
   * - Calling it again with the same application is a no-op; with another
   *   application it throws (one `OpenAPI` instance serves one application).
   */
  setup(app: LykosApplication): void {
    assertApplication(app)

    if (this.#app !== undefined) {
      if (this.#app === app) return
      throw new OpenAPIValidationError(
        [],
        '[LykosJS OpenAPI] This OpenAPI instance is already set up with another application. Create a new OpenAPI instance per application.',
      )
    }

    const { docsPath, jsonPath, middlewares, swaggerUI } = this.#options
    const document = this.#build(app)
    const json = JSON.stringify(document)

    const routes = createDocsRoutes({ docsPath, jsonPath, json, ui: swaggerUI })
    for (const route of routes) {
      app.GET(route.path, route.handler, ...middlewares)
    }

    this.#document = document
    this.#app = app
  }

  /** A copy of the generated document. Only available after `setup()`. */
  getDocument(): OpenAPIDocument {
    if (this.#document === undefined) {
      throw new Error('[LykosJS OpenAPI] getDocument() is only available after setup(app).')
    }
    return structuredClone(this.#document)
  }

  #build(app: LykosApplication): OpenAPIDocument {
    const registered = app.readRoutes()
    const { docsPath, jsonPath } = this.#options

    const issues: ValidationIssue[] = []
    const { issues: missing, active } = validateRegisteredRoutes(this.#options.routes, registered)
    issues.push(...missing)

    const endpoints = [
      ...(jsonPath === undefined ? [] : [{ target: 'json', path: jsonPath }]),
      ...(docsPath === undefined
        ? []
        : [
            { target: 'docs', path: docsPath },
            { target: 'docs assets', path: `${assetBase(docsPath)}/init.js` },
          ]),
    ]
    issues.push(...findDocsConflicts(endpoints, registered))

    if (issues.length > 0) throw new OpenAPIValidationError(issues)

    return generateDocument({
      info: this.#options.info,
      servers: this.#options.servers,
      securitySchemes: this.#options.securitySchemes,
      routes: active,
    })
  }
}
