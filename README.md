# LykosJS v1.0.0 — Latest 🐺

<h1>
  <img src="https://res.cloudinary.com/dgagbheuj/image/upload/v1795227129/koakwx1uyjf68edpilc8.png" alt="LykosJS Logo" width="48" height="48" align="absmiddle" />
  LykosJS
</h1>

**A lightweight, modular backend framework built for speed and DX.**

Built for performance, simplicity, and a better developer experience.

> LykosJS is distributed under the [MIT License](#license).

## Features

- **Modular Architecture** — Clean, reusable modules that keep your codebase organized and maintainable.
- **Ready-to-Use Middleware** — Protect routes and handle common request workflows.
- **High Performance** — Built for Bun and TypeScript, with a lightweight HTTP core.
- **Built-in Validation** — Validate incoming data with a simple, developer-friendly API.
- **Integrated CLI** — Generate complete modules in seconds.
- **Developer Experience** — Straightforward APIs and a clean architecture without unnecessary complexity.

## Installation

Requires [Bun](https://bun.sh) 1.3 or newer. There are two ways to get started.

### 1. Starter template (recommended)

```bash
bun create lykosjs my-app
```

The recommended way to get started. It creates a ready-to-use project with an organized modular structure.

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

After project generation, the terminal displays:

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

## Simple API, Modular Architecture

Organize your application into focused modules. Each module can contain its own controllers, routes, services, and configuration.

Register your modules through the application:

```ts
app.modules(Modules)
```

This keeps features separated and makes your application easier to maintain and extend.

## CLI

Generate a complete module with one command:

```bash
bun run lykosjs g module users
```

The generator creates the module files according to the selected project template.

## Learn More

- **Framework:** [LykosJS on GitHub](https://github.com/lykosjs/lykos)
- **Runtime:** [Bun](https://bun.sh)
- **Documentation:** [LykosJS Documentation](https://lykos.com)

Contributions are welcome:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

For security issues, please read [SECURITY.md](SECURITY.md) and report vulnerabilities privately.

## License

LykosJS is released under the **MIT License**. See [LICENSE](LICENSE).

Copyright (c) 2026 Zen Allaham — LykosJS

<p align="center">
  <img
    src="https://res.cloudinary.com/dgagbheuj/image/upload/v1795313052/muvd4yk1qmoa3kmdql43.png"
    alt="LykosJS — Built for Speed. Designed for Scale."
    width="100%"
  />
</p>
