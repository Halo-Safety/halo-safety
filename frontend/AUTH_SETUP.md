# HALO authentication and production data setup

The front end uses Supabase Auth (real email/password sessions) and Supabase Postgres with Row Level Security. It does NOT have a browser-only bypass.

## 1. Create a Supabase project

1. Create a Supabase project at https://supabase.com/dashboard.
2. In Authentication → Providers → Email, enable Email. Disable open user signups for an invite-only team if desired.
3. In Authentication → Users, invite the people who should be able to access Halo. They must establish a password.
4. In Authentication → URL Configuration, set Site URL to your **production** Vercel domain and add the **Preview** domain pattern or specific preview URL to Redirect URLs for password reset. Use the root path without a hash.
5. Check Supabase Auth SMTP configuration before real external invitations or password resets. Default email sending is rate-limited and not suitable for production volume.

## 2. Vercel environment variables

In Vercel → halo-safety → Settings → Environment Variables set for Production, Preview, and Development as required:

- `VITE_SUPABASE_URL` — Supabase project URL (public)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — publishable client key (public). A legacy anon key also works.
  
**Never put the Supabase `service_role` or other secret keys into any `VITE_` variable.** Vite embeds those in client JS.

Redeploy after changing Vercel environment variables. Until both are configured, the sign-in page stays visible and rejects all attempts rather than offering fake access.

## 3. Database (RLS)

Apply `supabase/schema.sql` in Supabase SQL Editor. Its tables are:

- `organizations` — team/company account
- `organization_members` — members and roles
- `sensor_events` — recorded sensor events

The browser can only SELECT rows belonging to organizations in its membership. Browser users cannot write or edit incidents. The simulator remains a separate sandbox, and its animations do not create official incident records.

Once you've invited users, add an organization and their membership in the SQL Editor:

```sql
insert into public.organizations (name) values ('Your organization') returning id;
-- Replace the two UUIDs below with your actual organization id and
-- a real user id copied from Authentication → Users.
insert into public.organization_members (organization_id, user_id, role)
values ('ORGANIZATION_UUID', 'AUTH_USER_UUID', 'admin');
```

Do not invent UUIDs or create fake production incidents.

**Device ingestion is not implemented yet.** A future authenticated ingestion service should validate signed ESP32 credentials, choose the appropriate `organization_id`, and use a server-side secret unavailable to browsers. The previously local Flask API is not automatically protected by the new Supabase login. Do not expose that Flask endpoint publicly without its own authorization checks.

## 4. Test

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env.local` locally (never commit that file). Check that:

1. Incorrect credentials fail; correct invited user credentials succeed.
2. Sign out actually revokes the client session.
3. Password reset email and password update work.
4. A logged-out user cannot read `sensor_events` via Supabase's API.
5. Users in different organizations do not see each other's records.
6. The low-poly background moves smoothly and respects reduced motion.

The background is a **pre-generated SVG** animated with CSS transform only. It has no JS animation loop, Canvas updates, or external animation library.
