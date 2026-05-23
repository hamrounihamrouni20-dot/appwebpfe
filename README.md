# SolarWatch (Local Dev)

Quick notes to run the frontend and deploy the Supabase Edge Function `create-user`.

## Frontend (dev)

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` (or `.env.local`) with the following values (DO NOT put the service role key here):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

3. Run the dev server:

```bash
npm run dev
```

The app uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend. Never commit your keys.

## Supabase Edge Function: `create-user`

This function must be deployed to Supabase and it uses the service role key to create auth users and upsert the `profiles` table.

1. Login and link your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

2. Set secrets (run once):

```bash
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<YOUR_SERVICE_ROLE_KEY>"
```

3. Deploy the function:

```bash
supabase functions deploy create-user --no-verify-jwt
```

Important: Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code. The frontend calls the function using the anon key and a logged-in admin session; the function validates the caller and uses the service role key server-side.

## Migrations

The repository includes SQL migrations under `supabase/migrations/`. The schema includes a `profiles` table and a trigger `handle_new_user` that creates a `profiles` row when a new `auth.users` row is inserted.

## Notes

- Admin user creation from the dashboard now invokes the `create-user` Edge Function.
- If you encounter issues, check the browser console and the function logs in Supabase (`supabase functions logs run create-user`).
