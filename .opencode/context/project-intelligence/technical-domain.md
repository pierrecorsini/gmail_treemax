<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-02-21 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for email-treemap-client.
**Last Updated**: 2026-02-21

## Quick Reference
**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React | 18.2 | Component-based UI with hooks |
| Build Tool | Vite | 5.4 | Fast HMR, ES modules native |
| Language | TypeScript | Latest | Type safety, better DX |
| Styling | Tailwind CSS | 3.4 | Utility-first, rapid prototyping |
| UI Primitives | Radix UI | Latest | Accessible, unstyled components |
| Icons | Lucide React | 0.575 | Lightweight, tree-shakeable |
| Variants | class-variance-authority | 0.7 | Type-safe component variants |
| API | gapi-script | 1.2 | Google API integration |

## Code Patterns

### Component Structure
```typescript
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const componentVariants = cva('base-classes', {
  variants: {
    variant: { default: '...', outline: '...' },
    size: { sm: '...', lg: '...' }
  },
  defaultVariants: { variant: 'default', size: 'sm' }
});

interface ComponentProps extends VariantProps<typeof componentVariants> {
  className?: string;
  children: React.ReactNode;
}

export function Component({ variant, size, className, children }: ComponentProps) {
  return <div className={cn(componentVariants({ variant, size }), className)}>{children}</div>;
}
```

### Google API Pattern
```typescript
import { gapi } from 'gapi-script';

async function fetchGmailData() {
  const response = await gapi.client.gmail.users.messages.list({
    userId: 'me',
    maxResults: 10
  });
  // Validate response before use
  if (!response.result?.messages) return [];
  return response.result.messages;
}
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | user-profile.tsx, email-list.ts |
| Components | PascalCase | UserProfile, EmailList |
| Functions | camelCase | getUserProfile, fetchEmails |
| Hooks | camelCase + use | useAuth, useGapi |
| Types | PascalCase | User, EmailMessage |
| Constants | SCREAMING_SNAKE_CASE | API_BASE_URL, MAX_RESULTS |

## Code Standards

1. **TypeScript strict mode** - Enable strict type checking
2. **Functional components** - Use hooks, avoid class components
3. **Tailwind CSS** - Utility-first styling, avoid custom CSS
4. **CVA for variants** - Type-safe component variants
5. **Radix UI primitives** - Accessible, unstyled base components

## Security Requirements

1. **OAuth 2.0 via Google** - Authenticate using Google OAuth flow
2. **Validate API responses** - Check response structure before use
3. **Sanitize email content** - Clean HTML before rendering
4. **Secure token storage** - Avoid localStorage for sensitive tokens
5. **Minimal OAuth scopes** - Request only required permissions

## Project Structure

```
email-treemap-client/
├── src/
│   ├── components/     # React components (PascalCase folders)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities (cn, formatters)
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Root component
├── public/             # Static assets
└── package.json
```

## 📂 Codebase References

**Entry Point**: `src/main.tsx` - React app bootstrap
**Root Component**: `src/App.tsx` - Main application
**Styling**: `tailwind.config.js` - Tailwind configuration
**Build**: `vite.config.ts` - Vite configuration

## Related Files
- business-domain.md - Business context and problem statement
- decisions-log.md - Major decisions with rationale
