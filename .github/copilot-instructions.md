# Copilot Instructions for Talk-To-My-Lawyer

AI-assisted legal letter generation platform with mandatory attorney review. Subscribers generate AI drafts → admins review/approve → subscribers receive finalized letters as PDFs.

## Non-Negotiable Rules

1. **Only subscribers can generate letters** - Employees and admins must never access letter generation APIs
2. **Admin review is mandatory** - No "raw AI" letters reach subscribers; every letter requires approval
3. **Employees never see letter content** - They only see coupon stats and commissions
4. **Respect RLS** - Never disable Row Level Security; all DB access respects role scoping
5. **Do not leak secrets** - Never log env var values; refer to names like `OPENAI_API_KEY` only
6. **Use pnpm exclusively** - Never add npm/yarn lockfiles (`packageManager=pnpm@10.27.0`)

## Essential Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm lint             # Required before delivery
CI=1 pnpm build       # Production build (stricter checks)
pnpm validate-env     # Check environment variables
```

## Architecture Patterns

### API Route Structure
All routes under `app/api/` follow this pattern (see [generate-letter/route.ts](/app/api/generate-letter/route.ts)):

```typescript
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, letterGenerationRateLimit } from '@/lib/rate-limit-redis'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, 5, "1 h")
  if (rateLimitResponse) return rateLimitResponse

  // 2. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return errorResponses.unauthorized()

  // 3. Role check via profiles table
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can...")

  // 4. Business logic...
  return successResponse(data)
}
```

### Admin Routes
Use `requireAdminAuth()` from [lib/auth/admin-guard.ts](/lib/auth/admin-guard.ts):

```typescript
import { requireAdminAuth } from '@/lib/auth/admin-guard'

const authError = await requireAdminAuth()
if (authError) return authError
```

### Supabase Client Usage
- **Server/API routes**: `import { createClient } from "@/lib/supabase/server"` (async)
- **Client components**: `import { createClient } from "@/lib/supabase/client"` (sync)

### Error Handling
Use helpers from [lib/api/api-error-handler.ts](/lib/api/api-error-handler.ts):
- `errorResponses.unauthorized()`, `.forbidden()`, `.validation()`, `.notFound()`
- `successResponse(data, status?)` for consistent JSON responses
- `handleApiError(error, context)` in catch blocks

### Validation
Use schema-based validation from [lib/validation/letter-schema.ts](/lib/validation/letter-schema.ts):
```typescript
const validation = validateLetterGenerationRequest(letterType, intakeData)
if (!validation.valid) return errorResponses.validation("Invalid input", validation.errors)
```

### Rate Limiting
Predefined limiters in [lib/rate-limit-redis.ts](/lib/rate-limit-redis.ts):
- `authRateLimit` - 5/15min
- `apiRateLimit` - 100/1min
- `letterGenerationRateLimit` - 5/1hr
- `subscriptionRateLimit` - 3/1hr

Falls back to in-memory when Upstash unavailable.

## Key Domain Concepts

### User Roles (`profiles.role`)
- `subscriber` - Generate letters, view own letters, manage subscription
- `employee` - Coupon code (20% off), commission tracking (5%), never sees letters
- `admin` - Two sub-roles via `profiles.admin_sub_role`:
  - `super_admin` - Full access: Analytics, all users, all letters, coupon tracking, commission management
  - `attorney_admin` - Limited access: Letter review center, profile settings only

### Admin Role Helper Functions
- `is_super_admin()` - Returns true for `role='admin'` AND `admin_sub_role='super_admin'`
- `is_attorney_admin()` - Returns true for `role='admin'` AND `admin_sub_role='attorney_admin'`
- `get_admin_dashboard_stats()` - Comprehensive stats for Super Admin only

### Elevating a User to Admin
Admins are never created through normal signup. Use one of these methods:

**CLI Script (recommended):**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Promote existing user via SQL:**
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';
```

Admin login requires 3 factors: email + password + `ADMIN_PORTAL_KEY` environment variable.

### Letter Status Flow
`draft` → `generating` → `pending_review` → `under_review` → `approved`/`rejected`/`completed`/`failed`

### Key Database RPCs (Supabase)
- `check_letter_allowance(user_id)` - Check remaining credits
- `deduct_letter_allowance(user_id)` - Atomic credit deduction
- `log_letter_audit(letter_id, action, ...)` - Audit trail

## Directory Reference

| Path | Purpose |
|------|---------|
| `app/api/` | Route handlers (letters, auth, subscriptions, admin) |
| `app/dashboard/` | Subscriber UI |
| `app/secure-admin-gateway/` | Admin portal (requires portal key + role) |
| `lib/auth/` | Auth guards, admin sessions, user helpers |
| `lib/api/` | Shared error handlers and response helpers |
| `lib/email/service.ts` | Provider-agnostic email with templates |
| `lib/validation/` | Input validation schemas |
| `lib/services/` | Business logic (allowance, subscriptions) |
| `scripts/*.sql` | DB migrations (run in numeric order) |

## Component Conventions

- Functional React components with hooks
- `'use client'` directive only when interactive
- shadcn/ui primitives in `components/ui/`
- Tailwind for styling; use existing design tokens from [lib/design-tokens.ts](/lib/design-tokens.ts)
