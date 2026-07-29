# Church Care Hub

A role-based church visitor, member, attendance, and care-management application built with React, TypeScript, Vite, and Supabase.

## Roles

- **Usher** â€” visitor registration, attendance, visitor notes, and visit tracking.
- **Pastor** â€” usher capabilities plus member records, pastoral care, and Excel/CSV imports.
- **Administrator** â€” full oversight, role approvals, system monitoring, members, visitors, attendance, and care records.

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

The project is configured for Vercel with:

- Framework preset: `Vite`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

Import this GitHub repository into Vercel, then add these variables to the
Production, Preview, and Development environments:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ORGANIZATION_ID=
```

Use a Supabase publishable key (`sb_publishable_...`) in the browser-facing
`VITE_SUPABASE_PUBLISHABLE_KEY` variable. Never use a Supabase secret or
`service_role` key in a `VITE_` variable.

After the first deployment, pushes to `main` deploy to production and pull
requests create preview deployments through Vercel's Git integration.
