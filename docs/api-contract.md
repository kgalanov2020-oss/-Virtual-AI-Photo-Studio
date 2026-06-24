# MVP API Contract

Base API: FastAPI.

The first version should keep the API simple and job-centered. The frontend creates a job, uploads selfies, starts generation, then polls for status and images.

## Endpoints

### `GET /health`

Returns service status.

### `GET /studios`

Returns active studio cards.

### `GET /studios/{slug}`

Returns the full studio definition, including shot templates.

### `POST /jobs`

Creates a job.

Request:

```json
{
  "studio_slug": "modern-business-studio"
}
```

Response:

```json
{
  "id": "job_...",
  "studio_slug": "modern-business-studio",
  "status": "draft",
  "progress": 0
}
```

### `POST /jobs/{job_id}/selfies`

Uploads or attaches selfie files to the job.

The real implementation should store files in Supabase Storage and create rows in `uploaded_selfies`.

### `POST /jobs/{job_id}/start`

Validates the job and queues generation.

Status changes:

`draft` -> `queued` -> `running` -> `completed` or `failed`

### `GET /jobs/{job_id}`

Returns job status and progress.

### `GET /jobs/{job_id}/images`

Returns generated gallery items.

## Worker Contract

For each job:

1. Load approved selfies.
2. Build an identity embedding with InstantID, IP-Adapter, or FaceID.
3. Iterate through `studio_shots`.
4. Generate 4 variations per shot.
5. Run face refinement and upscale.
6. Upload results to storage.
7. Insert rows into `generated_images`.
8. Update job progress after every completed shot.
