# CLI Redesign — Completed

**Date**: 2026-04-16
**Status**: Done

Based on [claude-code-router](https://github.com/musistudio/claude-code-router) patterns.

## Commands

| Command | Description |
|---------|-------------|
| `tflow start [-p PORT]` | Start server (daemon) |
| `tflow stop` | Stop server |
| `tflow restart` | Restart server |
| `tflow status` | Show PID, port, state |
| `tflow ui` | Open dashboard in browser |
| `tflow config` | TUI configuration |
| `tflow --tldr` | Quick reference guide |

## Config

`~/.tokenflow/config.json5` — JSON5 with comments, auto-created on first use.

## Process Management

- PID file: `~/.tokenflow/server.pid`
- `tflow ui` auto-starts server if not running
- Cross-platform browser open (macOS/Windows/Linux)
