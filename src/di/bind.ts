import type { Deps, Provider, Token } from './types'

/** Internal: builds a provider from a token, its dependencies and a factory. */
export function provide<T, A extends readonly unknown[]>(
  token: Token<T>,
  deps: Deps<A>,
  factory: (...args: A) => T,
): Provider<T> {
  return {
    token,
    deps: deps as readonly Token[],
    create: (args) => factory(...(args as A)),
  }
}

/**
 * Binds a class to the tokens of its constructor dependencies.
 * A wrong type, count or order is a compile-time error.
 */
export function bind<T, A extends readonly unknown[]>(
  cls: new (...args: A) => T,
  ...deps: Deps<A>
): Provider<T> {
  return provide(cls as unknown as Token<T>, deps, (...args: A) => new cls(...args))
}

/**
 * Registers a class itself as an injectable value (e.g. a Sequelize model)
 * instead of an instance built from it. The class is its own token.
 */
export function value<C extends Token>(cls: C): Provider<C> {
  return provide(cls as unknown as Token<C>, [] as unknown as Deps<[]>, () => cls)
}
