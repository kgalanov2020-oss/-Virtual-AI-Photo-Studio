-- Seed data for the first MVP studio.
-- Run this after supabase/migrations/0001_initial_ai_photo_studio.sql.

with studio as (
  insert into public.studios (
    slug,
    name,
    description,
    preview_url,
    is_active
  )
  values (
    'modern-business-studio',
    'Modern Business Studio',
    'A premium business photo session in a modern office studio with clean interiors, soft daylight, polished wardrobe direction, and LinkedIn-ready framing.',
    null,
    true
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    preview_url = excluded.preview_url,
    is_active = excluded.is_active
  returning id
)
insert into public.studio_shots (
  studio_id,
  slug,
  name,
  camera_angle,
  pose,
  crop,
  prompt,
  negative_prompt,
  variations,
  sort_order
)
select
  studio.id,
  shot.slug,
  shot.name,
  shot.camera_angle,
  shot.pose,
  shot.crop,
  shot.prompt,
  shot.negative_prompt,
  shot.variations,
  shot.sort_order
from studio
cross join (
  values
    (
      'window-portrait',
      'Window Portrait',
      'eye-level, 85mm portrait lens',
      'standing near large office window, relaxed shoulders',
      'head and shoulders',
      'professional business headshot, standing near large glass office window, soft natural daylight, premium modern office background, confident expression, realistic skin texture, sharp eyes, shallow depth of field, LinkedIn profile photo',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      10
    ),
    (
      'executive-desk',
      'Executive Desk',
      'slightly low angle, 70mm lens',
      'sitting at executive desk with laptop, hands natural',
      'half body',
      'professional portrait sitting at a clean executive desk, modern laptop, premium office interior, confident founder energy, cinematic softbox lighting, realistic commercial photography',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      20
    ),
    (
      'arms-crossed',
      'Arms Crossed',
      'eye-level, 50mm lens',
      'standing with arms crossed, confident posture',
      'half body',
      'professional half-body business portrait, arms crossed, modern business studio, clean neutral background, soft rim light, confident but approachable expression, photorealistic editorial portrait',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      30
    ),
    (
      'startup-founder',
      'Startup Founder',
      'three-quarter angle, 50mm lens',
      'leaning lightly on desk, casual professional posture',
      'waist up',
      'startup founder portrait in modern workspace, casual professional outfit, desk and laptop in background, daylight, approachable confident expression, realistic skin, premium editorial photography',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      40
    ),
    (
      'presentation-moment',
      'Presentation Moment',
      'three-quarter side angle, 70mm lens',
      'standing beside presentation screen, one hand gesturing naturally',
      'three-quarter body',
      'business leader giving a presentation in a modern meeting room, subtle screen glow, professional confident gesture, premium office interior, cinematic realistic lighting',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      50
    ),
    (
      'lounge-chair',
      'Lounge Chair',
      'eye-level, 85mm lens',
      'sitting in designer lounge chair, relaxed confident posture',
      'three-quarter body',
      'executive portrait sitting in a designer lounge chair, luxury modern office lobby, soft window light, polished professional style, realistic editorial photography',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      60
    ),
    (
      'black-background',
      'Black Background',
      'eye-level, 85mm studio lens',
      'standing straight, calm confident expression',
      'head and shoulders',
      'premium studio business portrait on dark charcoal background, dramatic softbox light, subtle rim light, high-end executive headshot, realistic facial details, sharp eyes',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      70
    ),
    (
      'walking-office',
      'Walking Office',
      'slight telephoto, candid editorial angle',
      'walking through modern office corridor, natural movement',
      'three-quarter body',
      'candid professional portrait walking through a modern office corridor, glass walls, natural movement, confident expression, premium business editorial photography',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      80
    ),
    (
      'close-up-editorial',
      'Close-up Editorial',
      'close-up, 100mm portrait lens',
      'slight turn toward camera, focused expression',
      'tight close-up',
      'close-up editorial business portrait, premium studio lighting, realistic pores and skin, sharp eyes, neutral background, confident thoughtful expression, high-end magazine style',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      90
    ),
    (
      'coffee-workspace',
      'Coffee Workspace',
      'three-quarter angle, 50mm lens',
      'sitting at workspace with coffee and laptop, natural hands',
      'waist up',
      'professional lifestyle business portrait at a clean workspace, coffee cup and laptop, soft daylight, modern founder vibe, warm but premium atmosphere, photorealistic',
      'cartoon, illustration, low quality, blurry, distorted face, changed identity, asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed',
      4,
      100
    )
) as shot(
  slug,
  name,
  camera_angle,
  pose,
  crop,
  prompt,
  negative_prompt,
  variations,
  sort_order
)
on conflict (studio_id, slug) do update set
  name = excluded.name,
  camera_angle = excluded.camera_angle,
  pose = excluded.pose,
  crop = excluded.crop,
  prompt = excluded.prompt,
  negative_prompt = excluded.negative_prompt,
  variations = excluded.variations,
  sort_order = excluded.sort_order;
