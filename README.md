<div align="center">

<img
  src="https://res.cloudinary.com/dgagbheuj/image/upload/v1795313052/muvd4yk1qmoa3kmdql43.png"
  alt="LykosJS — Built for Speed. Designed for Scale."
  width="100%"
/>

<br />
<br />

<img
  src="https://res.cloudinary.com/dgagbheuj/image/upload/v1795527989/atneib1qc0uynu90pkfu.png"
  alt="LykosJS Logo"
  width="96"
/>

# LykosJS

**A lightweight, modular backend framework built for speed and DX.**

Built for performance, simplicity, and a better developer experience.

<br />

[![Version](https://img.shields.io/badge/version-1.0.0-1f6bff?style=for-the-badge&labelColor=02050d)](https://github.com/lykosjs/lykos)
[![Bun](https://img.shields.io/badge/runtime-Bun%201.4%2B-19d3ff?style=for-the-badge&logo=bun&logoColor=white&labelColor=02050d)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-3ea6ff?style=for-the-badge&logo=typescript&logoColor=white&labelColor=02050d)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-ffffff?style=for-the-badge&labelColor=02050d)](#license)

[Installation](#installation) ·
[Architecture](#architecture) ·
[Dependency Injection](#dependency-injection) ·
[CLI](#cli) ·
[Documentation](https://lykos.com) ·
[Contributing](#contributing)

</div>

<br />

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
  - [Starter template (recommended)](#1-starter-template-recommended)
  - [Start from scratch](#2-start-from-scratch)
- [Architecture](#architecture)
- [Dependency Injection](#dependency-injection)
- [CLI](#cli)
- [Learn More](#learn-more)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Overview

LykosJS is a backend framework for [Bun](https://bun.sh) and TypeScript. It pairs a lightweight HTTP core with explicit, decorator-free dependency injection, built-in validation, ready-to-use middleware, and an integrated CLI, so you can build real applications without assembling a stack from scratch.

## Features

| | Feature | Description |
| :-: | :-- | :-- |
| 🧩 | **Modular Architecture** | Clean, reusable modules that keep your codebase organized and maintainable. |
| 💉 | **Dependency Injection** | Explicit, decorator-free DI with `DIModule`, `bind`, and `value`. |
| 🛡️ | **Ready-to-Use Middleware** | Protect routes and handle common request workflows. |
| ⚡ | **High Performance** | Built for Bun and TypeScript, with a lightweight HTTP core. |
| ✅ | **Built-in Validation** | Validate incoming data with a simple, developer-friendly API. |
| 🛠️ | **Integrated CLI** | Generate complete modules in seconds. |
| 🎯 | **Developer Experience** | Straightforward APIs and a clean architecture without unnecessary complexity. |

## Installation

> [!NOTE]
> Requires [Bun](https://bun.sh) **1.4 or newer**. There are two ways to get started.

### 1. Starter template (recommended)

```bash
bun create lykosjs my-app
```

This is the recommended way to get started. It creates a ready-to-use project with an organized modular structure.

Example application entry point (`src/launch.ts`):

```ts
import { Lykos } from 'lykosjs'
import { Modules } from './modules'

async function launch() {
  const app = new Lykos()

  app.GET('/', async (ctx, reply) => reply.send('Welcome to LykosJS 🐺'))

  app.modules(Modules)

  app.listen(4000, () => console.log('🐺 LykosJS is running at http://localhost:4000'))
}

launch().catch((error: unknown) => {
  console.error('🐺 [LykosJS] Failed to start application:', error)
  process.exit(1)
})
```

After the project is generated, the terminal displays:

```text
🐺 LykosJS · ✔ Project created successfully
────────────────────────────────────────────────────
Location  C:\Projects\my-app
Template  REST API
────────────────────────────────────────────────────

Next steps

1. $ cd "my-app"
2. $ bun install
3. $ bun run dev

Happy building with LykosJS! 🚀
```

### 2. Start from scratch

LykosJS doesn't force a project structure on you. Initialize a Bun project and install LykosJS:

```bash
bun init
bun add lykosjs
```

Then create your application entry point and configure your routes and modules using the LykosJS API.

## Architecture

Organize your application into focused modules. Each module can contain its own controllers, routes, services, and configuration.

Register your modules through the application:

```ts
app.modules(Modules)
```

This keeps features separated and makes your application easier to maintain and extend.

## Dependency Injection

LykosJS ships with an explicit, decorator-free dependency injection system. There is no `reflect-metadata`, no magic, and no hidden global container: every dependency a class receives is declared in its module, so you can read exactly what gets wired to what.

### Core building blocks

| Building block | Purpose |
| :-- | :-- |
| `DIModule` | Base class for a module. Declares what the module imports, provides, and exposes. |
| `bind(Class, ...deps)` | Registers `Class` as a provider and injects `deps` into its constructor, in order. |
| `value(x)` | Registers an existing value (a schema, config object, constant) so it can be injected. |
| `imports` | Other modules whose providers this module can use. |
| `providers` | Services, middlewares, schemas, and values available inside the module. |
| `controllers` | Controllers instantiated with their dependencies. |
| `routers` | Routers that connect controllers and middlewares to the `Lykos` app. |
| `auth` | Per-module authentication, configured with `defineAuth`. |

### Defining a module

```ts
import { bind, value, defineAuth, DIModule, Lykos, AuthMiddleware } from 'lykosjs'

export class PaymentsModule extends DIModule {
  override imports = [NotificationsModule, ContractsModule]

  override providers = [
    value(PaymentSchema),
    value(OrderSchema),

    bind(PaymentsService, PaymentSchema, OrderSchema, NotificationsService),

    UserActiveMiddleware,
    bind(UserVerificationMiddleware, UserVerificationSchema),
    RolesMiddleware,
  ]

  override controllers = [bind(PaymentsController, PaymentsService)]

  override routers = [
    bind(
      PaymentsRouter,
      Lykos,
      PaymentsController,
      AuthMiddleware,
      UserActiveMiddleware,
      UserVerificationMiddleware,
      RolesMiddleware,
    ),
  ]

  override auth = defineAuth({
    verifier: PaymentsController,
    mode: 'cookie',
    cookieName: 'token',
  })
}
```

### How it works

1. **`value(...)`** makes plain values (such as schemas) injectable.
2. **`bind(Class, ...deps)`** creates the class by passing each dependency to its constructor, in the order you list them.
3. **`imports`** lets a module use providers exposed by other modules, such as `NotificationsService` from `NotificationsModule`.
4. **Controllers** receive their services; **routers** receive the `Lykos` app, the controller, and the middlewares they apply.
5. **`defineAuth`** configures how the module authenticates requests (here, cookie-based with a `token` cookie).

### A matching service

Dependencies arrive through the constructor, in the same order as in `bind(...)`:

```ts
export class PaymentsService {
  constructor(
    private readonly payments: typeof PaymentSchema,
    private readonly orders: typeof OrderSchema,
    private readonly notifications: NotificationsService,
  ) {}
}
```

### Best practices

> [!TIP]
> Keep the constructor order in sync with the `bind(...)` call. Changing one without the other changes what gets injected.

- **Share, don't repeat.** If several modules use the same schemas or middlewares, expose them from a dedicated module (for example a database module or a guards module) and list it in `imports`.
- **Keep services focused.** A service that needs many dependencies is usually a sign it should be split.
- **Test easily.** Because dependencies are plain constructor arguments, you can instantiate a class in a test with fakes, with no container required.

## CLI

Generate a complete module with one command:

```bash
bun run lykosjs g module users
```

The generator creates the module files according to the selected project template.

## Learn More

| Resource | Link |
| :-- | :-- |
| Framework | [LykosJS on GitHub](https://github.com/lykosjs/lykos) |
| Runtime | [Bun](https://bun.sh) |
| Documentation | [LykosJS Documentation](https://lykos.com) |

## Contributing

Contributions are welcome. Please read:

- [CONTRIBUTING.md](https://github.com/lykosjs/lykos/blob/main/CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](https://github.com/lykosjs/lykos/blob/main/CODE_OF_CONDUCT.md)

## Security

> [!IMPORTANT]
> For security issues, please read [SECURITY.md](https://github.com/lykosjs/lykos/blob/main/SECURITY.md) and report vulnerabilities privately.

## License

LykosJS is released under the **MIT License**. See [LICENSE](https://github.com/lykosjs/lykos/blob/main/LICENSE).

Copyright © 2026 Zen Allaham — LykosJS

<div align="center">

<sub>**Built for Speed. Designed for Scale.** 🐺</sub>

</div>
