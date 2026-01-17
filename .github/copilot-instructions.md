# Copilot Instructions for Talk-To-My-Lawyer

AI legal letter drafting with **mandatory attorney review**.

## Non‑negotiables (security + roles)

1. **Only subscribers can generate letters.** Employees and admins must never access letter generation APIs.
2. **Admin/ attorney review is mandatory.** No “raw AI” letters reach subscribers.
3. **Employees never see letter content.** They only see coupon stats + commissions.
4. **Two admin roles exist: System Admin and Attorney Admin.**
   - Both have access to the letter review workflow in their dedicated dashboards but cannot generate letters.
   - **System Admin:** Has detailed statistics and logs for every user, letter, employee, and discount code. Can view full profile settings and complete information in the letter preview and editing modal.
   - **Attorney Admin:** Can only access the review letter modal without any user information or profile settings visibility.

5. **Respect Supabase RLS.** Never disable Row Level Security.
6. **Do not log sensitive information.** Avoid logging personal data or secrets.
7. **Do not leak secrets.** Never log env var values (mention names like `OPENAI_API_KEY` only).
8. **Use pnpm only.** Do not add npm/yarn lockfiles.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
CI=1 pnpm build
pnpm validate-env
```

## Repo map

- API routes: `app/api/**/route.ts`
- Subscriber UI: `app/dashboard/**`
- Admin portals: `app/secure-admin-gateway/**` and `app/attorney-portal/**`
- Supabase clients: `lib/supabase/server.ts` (server) and `lib/supabase/client.ts` (client)

```instructions
# Copilot Instructions (pointer)

This repository uses `AGENTS.md` as the canonical source for AI/agent policies and workflows (letter generation flow, admin review, email delivery, and security non-negotiables).

Please edit `AGENTS.md` for policy or workflow updates; keep this file short to avoid drift.

See the canonical file: [AGENTS.md](AGENTS.md)

```

import { createClient } from "@/lib/supabase/server";
