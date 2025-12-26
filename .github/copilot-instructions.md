# Copilot Instructions for Talk-To-My-Lawyer

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

**Talk-To-My-Lawyer** is an AI-powered legal letter generation SaaS platform where:
- **Subscribers** fill out intake forms to generate AI-drafted legal letters
- A **human admin (attorney)** reviews and approves every letter before it becomes final
- **Employees** are referral partners with coupon codes (20% discount) and earn 5% commission
- Letters are delivered as PDFs after admin approval

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe integration
- **AI**: OpenAI GPT-4 Turbo via Vercel AI Gateway
- **Email**: Resend (primary), Brevo, SendGrid, SMTP (configurable)
- **Rate Limiting**: Upstash Redis
- **Package Manager**: pnpm (use `pnpm` for all package operations)

## Project Structure

- `/app/` - Next.js App Router pages and API routes
  - `api/` - API routes organized by feature
  - `auth/` - Authentication pages (login, signup, password reset)
  - `dashboard/` - Subscriber dashboard and management
  - `secure-admin-gateway/` - Admin portal with restricted access
- `/components/` - Reusable React components (shadcn/ui based)
- `/lib/` - Server utilities and domain logic
  - `auth/` - Authentication utilities
  - `ai/` - AI service integrations
  - `email/` - Email providers and queue
  - `security/` - CSRF, validation, sanitization
- `/types/` - Shared TypeScript types
- `/supabase/` - Database migrations
- `/scripts/` - Utility scripts

## Coding Guidelines

- Prefer functional React components with hooks
- Use Server Actions and API routes under `app/api/`
- Always declare `'use client'` for client components
- Use TypeScript with strict mode enabled
- Follow existing patterns for error handling in API routes
- Maintain consistent `NextResponse.json` response payloads
- Use Zod schemas for input validation
- Never wrap imports in try/catch blocks
- Keep Tailwind/shadcn patterns for styling

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Lint code (required before delivery)
pnpm lint

# Build for production (CI=1 enables stricter checks)
CI=1 pnpm build

# Validate environment variables
pnpm validate-env

# Health check
pnpm health-check
```

## Key Business Rules

1. **Only subscribers can generate letters** - Employees and admin cannot generate letters
2. **Admin review is mandatory** - No letter is final until admin approves it
3. **Employees never see letter content** - They only see coupon usage and commissions
4. **First letter is free** - Free trial for new subscribers (one letter)
5. **Respect RLS policies** - Never disable Row Level Security

## Security Considerations

- Never log or expose environment variable values
- All API routes require authentication
- Rate limiting is implemented via Upstash Redis
- CSRF protection is enabled for admin actions
- Input validation uses Zod schemas
- Database uses Row Level Security (RLS)

## Roles and Access

- **Subscriber** (`role = 'subscriber'`): Generate letters, view own letters, manage subscription
- **Employee** (`role = 'employee'`): Manage coupons, view commissions, no letter access
- **Admin** (`role = 'admin'`): Review all letters, access admin portal at `/secure-admin-gateway`

## Letter Workflow States

`draft` → `generating` → `pending_review` → `under_review` → `approved`/`rejected`/`completed`/`failed`

## Pricing (Reference)

Pricing tiers (subject to change - check Stripe configuration for current values):
- Single letter: $299 (one-time)
- Monthly: $299/month (4 letters)
- Yearly: $599/year (8 letters)
