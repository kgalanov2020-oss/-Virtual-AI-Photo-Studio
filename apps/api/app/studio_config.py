from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StudioShot(BaseModel):
    slug: str
    name: str
    camera_angle: str
    pose: str
    crop: str
    prompt: str
    negative_prompt: str
    variations: int = Field(default=4, ge=1, le=8)


class Studio(BaseModel):
    slug: str
    name: str
    category: Literal["business", "lifestyle", "fashion", "fitness", "beauty"]
    description: str
    preview_prompt: str
    shots: list[StudioShot]


BASE_NEGATIVE_PROMPT = (
    "cartoon, illustration, low quality, blurry, distorted face, changed identity, "
    "asymmetrical eyes, bad skin texture, plastic skin, extra fingers, deformed hands, "
    "bad anatomy, duplicate person, watermark, text, logo, overexposed, underexposed"
)


MODERN_BUSINESS_STUDIO = Studio(
    slug="modern-business-studio",
    name="Modern Business Studio",
    category="business",
    description=(
        "A premium business photo session in a modern office studio with clean interiors, "
        "soft daylight, polished wardrobe direction, and LinkedIn-ready framing."
    ),
    preview_prompt=(
        "premium modern business photo studio, glass office, soft daylight, neutral colors, "
        "executive chair, large windows, realistic commercial photography"
    ),
    shots=[
        StudioShot(
            slug="window-portrait",
            name="Window Portrait",
            camera_angle="eye-level, 85mm portrait lens",
            pose="standing near large office window, relaxed shoulders",
            crop="head and shoulders",
            prompt=(
                "professional business headshot, standing near large glass office window, "
                "soft natural daylight, premium modern office background, confident expression, "
                "realistic skin texture, sharp eyes, shallow depth of field, LinkedIn profile photo"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="executive-desk",
            name="Executive Desk",
            camera_angle="slightly low angle, 70mm lens",
            pose="sitting at executive desk with laptop, hands natural",
            crop="half body",
            prompt=(
                "professional portrait sitting at a clean executive desk, modern laptop, "
                "premium office interior, confident founder energy, cinematic softbox lighting, "
                "realistic commercial photography"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="arms-crossed",
            name="Arms Crossed",
            camera_angle="eye-level, 50mm lens",
            pose="standing with arms crossed, confident posture",
            crop="half body",
            prompt=(
                "professional half-body business portrait, arms crossed, modern business studio, "
                "clean neutral background, soft rim light, confident but approachable expression, "
                "photorealistic editorial portrait"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="startup-founder",
            name="Startup Founder",
            camera_angle="three-quarter angle, 50mm lens",
            pose="leaning lightly on desk, casual professional posture",
            crop="waist up",
            prompt=(
                "startup founder portrait in modern workspace, casual professional outfit, "
                "desk and laptop in background, daylight, approachable confident expression, "
                "realistic skin, premium editorial photography"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="presentation-moment",
            name="Presentation Moment",
            camera_angle="three-quarter side angle, 70mm lens",
            pose="standing beside presentation screen, one hand gesturing naturally",
            crop="three-quarter body",
            prompt=(
                "business leader giving a presentation in a modern meeting room, subtle screen glow, "
                "professional confident gesture, premium office interior, cinematic realistic lighting"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="lounge-chair",
            name="Lounge Chair",
            camera_angle="eye-level, 85mm lens",
            pose="sitting in designer lounge chair, relaxed confident posture",
            crop="three-quarter body",
            prompt=(
                "executive portrait sitting in a designer lounge chair, luxury modern office lobby, "
                "soft window light, polished professional style, realistic editorial photography"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="black-background",
            name="Black Background",
            camera_angle="eye-level, 85mm studio lens",
            pose="standing straight, calm confident expression",
            crop="head and shoulders",
            prompt=(
                "premium studio business portrait on dark charcoal background, dramatic softbox light, "
                "subtle rim light, high-end executive headshot, realistic facial details, sharp eyes"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="walking-office",
            name="Walking Office",
            camera_angle="slight telephoto, candid editorial angle",
            pose="walking through modern office corridor, natural movement",
            crop="three-quarter body",
            prompt=(
                "candid professional portrait walking through a modern office corridor, glass walls, "
                "natural movement, confident expression, premium business editorial photography"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="close-up-editorial",
            name="Close-up Editorial",
            camera_angle="close-up, 100mm portrait lens",
            pose="slight turn toward camera, focused expression",
            crop="tight close-up",
            prompt=(
                "close-up editorial business portrait, premium studio lighting, realistic pores and skin, "
                "sharp eyes, neutral background, confident thoughtful expression, high-end magazine style"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
        StudioShot(
            slug="coffee-workspace",
            name="Coffee Workspace",
            camera_angle="three-quarter angle, 50mm lens",
            pose="sitting at workspace with coffee and laptop, natural hands",
            crop="waist up",
            prompt=(
                "professional lifestyle business portrait at a clean workspace, coffee cup and laptop, "
                "soft daylight, modern founder vibe, warm but premium atmosphere, photorealistic"
            ),
            negative_prompt=BASE_NEGATIVE_PROMPT,
        ),
    ],
)


STUDIOS: dict[str, Studio] = {
    MODERN_BUSINESS_STUDIO.slug: MODERN_BUSINESS_STUDIO,
}
