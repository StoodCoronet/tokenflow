# Token Flow

LLM traffic monitoring and context optimization system.

## Install

```bash
pnpm install
pnpm build
npm install -g .
```

## CLI

```bash
tflow start              # Start proxy server
tflow stop               # Stop server
tflow restart            # Restart server
tflow status             # Show server status
tflow ui                 # Open Web dashboard
tflow config             # Interactive configuration
tflow --tldr             # Quick reference
```

## Dev

```bash
pnpm install
pnpm dev                 # Server + UI with hot reload
```

## Architecture

```
packages/
├── cli/          # CLI entry (commander + inquirer)
├── server/       # Fastify proxy + SQLite + detectors
├── ui/           # React + Vite + Tailwind dashboard
└── shared/       # Types, constants, utils
```

## Docs

| Doc | Date | Description |
|-----|------|-------------|
| [Spec](docs/2026-03-26-spec.md) | 2026-03-26 | Product spec, architecture, data model |
| [Deploy](docs/2026-03-26-deploy.md) | 2026-03-26 | Deployment guide (Python version, legacy) |
| [CLI Redesign](docs/2026-04-15-cli-redesign.md) | 2026-04-15 | CLI redesign notes based on CCR |
| [TS Rewrite Plan](docs/2026-04-16-typescript-rewrite-plan.md) | 2026-04-16 | TypeScript rewrite plan |

## License

MIT
