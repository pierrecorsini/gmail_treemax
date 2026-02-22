<!-- Context: project-intelligence/nav | Priority: critical | Version: 1.0 | Updated: 2026-02-21 -->

# Project Intelligence

> Start here for quick project understanding. These files bridge business and technical domains.

## Quick Routes

| What You Need | File | Description |
|---------------|------|-------------|
| Understand the "how" | `technical-domain.md` | Stack, architecture, patterns |
| Understand the "why" | `business-domain.md` | Problem, users, value |
| Decision context | `decisions-log.md` | Why decisions were made |
| Active issues | `living-notes.md` | Open questions, debt |

## Primary Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build | Vite 5 |
| Language | TypeScript |
| Styling | Tailwind CSS + CVA |
| UI | Radix UI + Lucide |
| API | gapi-script (Google) |

## Key Patterns

- **Components**: Functional + hooks, CVA variants, Radix primitives
- **Styling**: Tailwind utility-first, `cn()` for merging
- **Naming**: kebab-case files, PascalCase components
- **Security**: OAuth 2.0, validate responses, sanitize content

## Usage

**New Team Member / Agent**:
1. Start with `navigation.md` (this file)
2. Read `technical-domain.md` for code patterns
3. Read `business-domain.md` for project context

**Quick Reference**:
- Code patterns → `technical-domain.md`
- Business context → `business-domain.md`

## Related Files

- `.opencode/context/core/standards/project-intelligence.md` - Standards
- `.opencode/context/core/context-system.md` - Context architecture
