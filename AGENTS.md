# AGENTS.md

Conventions for AI coding agents working in this repo. Mirrors `CLAUDE.md`; cross-tool agnostic.

For project-specific rules see [`CLAUDE.md`](./CLAUDE.md).

<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Dashboard work

When touching `apps/dashboard/**`:
- Load the relevant `@tanstack/router-core#<sub-skill>` before non-trivial routing/data-loading work (sub-skills: `search-params`, `path-params`, `navigation`, `data-loading`, `auth-and-guards`, `type-safety`, etc.).
- Load `.claude/skills/transitions-dev` for micro-interactions.
- Prefer Spell UI > shadcn primitives > plain Tailwind for components.
