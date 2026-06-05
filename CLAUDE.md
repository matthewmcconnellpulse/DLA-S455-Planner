# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## ⚠️ Current state of the repository

As of the last update to this file, **this repository is freshly initialized**.
It contains only:

```
.
├── README.md   # Project title only
└── CLAUDE.md   # This file
```

There is **no application code, build tooling, dependency manifest, test
suite, or framework configuration yet**. Do not assume a tech stack, directory
layout, or commands exist — verify against the working tree before acting.

> **Maintenance note:** This file describes a not-yet-built project. As soon as
> real code, tooling, and conventions are introduced, **update the sections
> below** (project overview, structure, commands, conventions) to match reality
> and remove the placeholder language. Keeping CLAUDE.md accurate is part of
> "done" for any substantial change.

## Project overview

- **Name:** DLA-S455-Planner
- **Repository:** `matthewmcconnellpulse/dla-s455-planner`
- **Purpose:** _To be documented._ The name suggests a planning/scheduling
  application. Fill this in with the actual goal, target users, and scope once
  defined.

## Repository structure

_To be documented once code exists._ When adding the first real structure,
replace this section with an annotated tree of the top-level directories and a
one-line description of each (e.g. what lives in `src/`, `tests/`, `infra/`,
etc.).

## Development workflow

### Common commands

_None defined yet._ Once a package manager / build system is in place, document
the canonical commands here so they don't have to be rediscovered, for example:

| Task         | Command          |
| ------------ | ---------------- |
| Install deps | _TBD_            |
| Run locally  | _TBD_            |
| Run tests    | _TBD_            |
| Lint/format  | _TBD_            |
| Build        | _TBD_            |

Always prefer the project's own scripts (e.g. `package.json` scripts, a
`Makefile`, or `Taskfile`) over ad-hoc commands once they exist.

### Git & branching conventions

These conventions are **already in force** and apply now:

- **Develop on a dedicated feature branch** — never commit directly to `main`.
  If you are not already on a feature branch, create one before making changes.
- **Commit messages** should be clear and descriptive, explaining the *why* of
  a change, not just the *what*.
- **Push with upstream tracking:** `git push -u origin <branch-name>`.
- **Do not open a pull request unless explicitly asked.**
- **Never push to a branch other than the one you were asked to work on**
  without explicit permission.
- The default branch is `main`; `origin` is the canonical remote.

### Pull requests & CI

_No CI/CD pipeline is configured yet_ (no `.github/workflows/`). When CI is
added, document here how to run the same checks locally before pushing, and
what must be green for a PR to merge.

## Coding conventions

_To be documented._ Once a language and style tooling are chosen (formatter,
linter, type checker), record them here along with any project-specific
patterns. Until then, follow the idioms of whatever code you are editing and
match the surrounding style.

## Integrations & external services

No integrations are wired into the codebase yet. If/when this project connects
to external services (databases, third-party APIs, etc.), document the
services, where their configuration lives, and how credentials are supplied
(env vars, secrets manager) — **never commit secrets to the repository.**

## Notes for AI assistants

- This is a near-empty repo: **read before you write.** Confirm what actually
  exists rather than relying on this file's placeholders.
- When you introduce the first real tooling or structure, update the relevant
  sections above in the same change so this file stays trustworthy.
- Respect the git/branch rules above; they are the one set of conventions that
  is already established.
