# Workflow Config Webapp (standard code)

## Setup local
1. Copia `.env.example` a `.env` i omple `DATABASE_URL`.
2. Instal.la dependencies:
   ```bash
   npm install
   ```
3. Arrenca:
   ```bash
   npm start
   ```
4. Obre `http://localhost:3000`.

## Notes
- Requereix haver executat `supabase_setup.sql` (funcions `app_security.*`).
- Login via `app_security.login`.
- Sessio amb cookie `httpOnly`.
- Edicio completa de `public.workflow_config` excepte `id` i `created_at`.
