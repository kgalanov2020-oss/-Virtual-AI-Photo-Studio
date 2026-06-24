from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .studio_config import STUDIOS, Studio


app = FastAPI(title="AI Photo Studio API", version="0.1.0")


class StudioCard(BaseModel):
    slug: str
    name: str
    category: str
    description: str
    shot_count: int
    output_count: int


class CreateJobRequest(BaseModel):
    studio_slug: str


class JobResponse(BaseModel):
    id: str
    studio_slug: str
    status: str
    progress: int


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/studios", response_model=list[StudioCard])
def list_studios() -> list[StudioCard]:
    return [
        StudioCard(
            slug=studio.slug,
            name=studio.name,
            category=studio.category,
            description=studio.description,
            shot_count=len(studio.shots),
            output_count=sum(shot.variations for shot in studio.shots),
        )
        for studio in STUDIOS.values()
    ]


@app.get("/studios/{slug}", response_model=Studio)
def get_studio(slug: str) -> Studio:
    studio = STUDIOS.get(slug)
    if studio is None:
        raise HTTPException(status_code=404, detail="Studio not found")
    return studio


@app.post("/jobs", response_model=JobResponse)
def create_job(payload: CreateJobRequest) -> JobResponse:
    if payload.studio_slug not in STUDIOS:
        raise HTTPException(status_code=400, detail="Unknown studio")

    return JobResponse(
        id=f"job_{uuid4().hex}",
        studio_slug=payload.studio_slug,
        status="draft",
        progress=0,
    )
