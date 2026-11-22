import type { ContextHandler } from 'lykosjs'
import { Lykos } from 'lykosjs'
import type { OpenAPIOptions } from '../../src/index.js'

export const ok: ContextHandler = () => new Response('OK')

export function createApp(
  routes: ReadonlyArray<readonly ['GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD', string]>,
): Lykos {
  const app = new Lykos()
  for (const [method, path] of routes) {
    switch (method) {
      case 'GET':
        app.GET(path, ok)
        break
      case 'POST':
        app.POST(path, ok)
        break
      case 'PUT':
        app.PUT(path, ok)
        break
      case 'PATCH':
        app.PATCH(path, ok)
        break
      case 'DELETE':
        app.DELETE(path, ok)
        break
      case 'HEAD':
        app.HEAD(path, ok)
        break
    }
  }
  return app
}

export const baseInfo = { title: 'Test API', version: '1.0.0' } as const

export function options(overrides: Partial<OpenAPIOptions> = {}): OpenAPIOptions {
  return { info: { ...baseInfo }, routes: {}, ...overrides }
}

/** Runs `fn` and returns the thrown error (fails the test if nothing is thrown). */
export function catchError(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    if (error instanceof Error) return error
    throw new Error(`Non-error thrown: ${String(error)}`)
  }
  throw new Error('Expected function to throw')
}
