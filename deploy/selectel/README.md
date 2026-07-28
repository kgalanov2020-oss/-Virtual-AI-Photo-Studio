# Selectel production deployment

This deployment runs the Next.js application and Caddy on a Selectel Cloud Server.

Recommended minimum: Ubuntu 24.04, 2 vCPU, 4 GB RAM, 40 GB SSD, public IPv4.

## First deployment

1. Install Docker Engine and the Compose plugin.
2. Clone the repository to `/opt/virtual-ai-photo-studio`.
3. Copy `.env.example` to `.env` and transfer the current production secrets.
4. Before switching DNS, use a temporary hostname in `SITE_DOMAIN` and verify `/api/health`, registration, photo upload, generation, payment creation, webhook handling, static images, and mobile layout.
5. Run `docker compose up -d --build` from this directory.
6. Only after acceptance checks, point root and `www` DNS records to the Selectel public IP and set `SITE_DOMAIN=virtualphotostudio.ru`.

Outreach sending is deliberately disabled during migration. Re-enable it only after the public site and mail delivery are verified.
