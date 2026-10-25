# Deploying to AWS (EC2 + Docker Compose)

One small EC2 server runs the same containers as `npm run docker:up`, plus Caddy for HTTPS.

```
Internet ──443──▶ Caddy ──▶ api:3000 ──▶ db:5432
            80 ─▶ (redirect + certificate)
```

Only Caddy publishes ports. Postgres and the API are reachable only inside Docker's network.

## Server

- `t4g.small` (Arm/Graviton, 2 vCPU, 2 GiB) in us-east-2, Amazon Linux 2023, 20 GiB gp3 disk.
- Security group `triage-api-sg`: SSH 22 from the admin's IP only; HTTP 80 and HTTPS 443 from anywhere.
- An Elastic IP, so the address survives stop/start.
- 2 GiB swap file, so `npm ci` and `tsc` don't run out of memory during the image build.
- Docker, the Compose and Buildx plugins, and Git.

## First deploy

1. Point the domain's DNS (`A` record) to the Elastic IP and wait until `dig +short <domain>` returns it.
2. Clone the repo and create the `.env` from the template. The secrets are generated on the server
   and written straight into the file, so they never appear on screen or in the shell history:

   ```bash
   git clone https://github.com/YouuFeelme/triage-api.git
   cd triage-api
   cp deploy/production.env.example .env
   chmod 600 .env
   sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 32)|" .env
   sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|" .env
   sed -i "s|^API_DOMAIN=.*|API_DOMAIN=<your domain>|" .env
   ```

3. Build and start everything (database, migrations, API, Caddy):

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

   `migrate` should show `exited (0)`, and `api` should show `healthy`.

4. Check from your own computer:

   ```bash
   curl -i https://<your domain>/api/v1/health/ready
   ```

## Updating

```bash
cd ~/triage-api
git pull
docker compose up -d --build
```

Pending migrations run before the new API starts. If they fail, Compose stops with an error
instead of starting the new API.

## Useful commands

- `docker compose logs -f api`: API logs (JSON, one line per request with its request ID).
- `docker compose logs caddy`: certificate issues show up here.
- `docker compose exec db psql -U triage -d triage`: SQL console.
- `docker compose down`: stops everything. Data and certificates stay in their volumes.

## Notes

- `POSTGRES_PASSWORD` only takes effect when the `pgdata` volume is created. Changing it later
  means changing it inside Postgres too.
- Never run `npm run db:seed` in production. The seed refuses to run with `NODE_ENV=production`.
- If SSH stops connecting, the home IP probably changed: update the SSH rule with "My IP".
