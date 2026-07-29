# Church Care Hub

A role-based church visitor, member, attendance, and care-management application built with React, TypeScript, Vite, and Supabase.

## Roles

- **Usher** — visitor registration, attendance, visitor notes, and visit tracking.
- **Pastor** — usher capabilities plus member records, pastoral care, and Excel/CSV imports.
- **Administrator** — full oversight, role approvals, system monitoring, members, visitors, attendance, and care records.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Configure these environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ORGANIZATION_ID=
```

## Production

The project is configured for Vercel. Add the same environment variables to the Vercel project before deployment.
