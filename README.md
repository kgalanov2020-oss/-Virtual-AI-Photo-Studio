# AI Photo Studio

Virtual AI Photo Studio MVP: a user chooses one studio, uploads 5-10 selfies, and receives a complete AI photo session with consistent lighting, poses, and camera angles.

## Product Direction

The first product version is focused on one offer:

> Get a professional AI studio photo session from 5-10 selfies.

The MVP starts with one studio, `Modern Business Studio`, instead of a broad generic avatar generator. Each studio contains fixed shot templates so the output feels like a complete photoshoot, not random AI images.

## Planned Stack

- Frontend: Next.js, Tailwind, shadcn/ui
- API: FastAPI, Python
- Auth, database, storage: Supabase
- AI worker: RunPod, ComfyUI, InstantID, IP-Adapter or FaceID
- Queue: Redis with RQ/Celery
- Payments: Stripe

## Current Contents

- `apps/web` - Next.js frontend that reads the first studio from Supabase
- `apps/api/app/studio_config.py` - first studio and shot templates
- `apps/api/app/main.py` - minimal FastAPI contract for studios and job creation
- `docs/product-brief.md` - current product brief from the source material
- `docs/api-contract.md` - MVP API endpoints
- `supabase/schema.sql` - initial Supabase table design with RLS

## Run The Web App

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vplhgizzyonpwqjdzvwg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Then run:

```bash
pnpm install
pnpm dev:web
```

## Supabase Storage

Run `supabase/storage.sql` in the Supabase SQL Editor before testing real selfie uploads.
The upload flow uses anonymous Supabase Auth, so enable anonymous sign-ins in Auth settings for the MVP.

## Next Implementation Steps

1. Initialize GitHub repository.
2. Create Supabase project and run the schema after reviewing policies.
3. Build the Next.js onboarding flow: studio selection, selfie guide, upload, payment, gallery.
4. Connect FastAPI to Supabase and object storage.
5. Build the RunPod/ComfyUI worker for one shot template, then scale to all templates.
