# Deployment Guide

Complete guide for deploying T-Rex Trivia to Coolify with Docker Compose.

## Prerequisites

- Coolify instance running
- GitHub repository
- Domain: trextrivia.com (DNS configured to point to Coolify)

## Step 1: Generate JWT Keys (One-Time Setup)

JWT keys are created **once** and reused across all deployments. Do NOT regenerate them or all user sessions will be invalidated.

```bash
# Generate RSA key pair
ssh-keygen -t rsa -b 4096 -m PEM -f jwtRS512.key -N ""

# Base64 encode for environment variables (single line)
cat jwtRS512.key | base64 | tr -d '\n' && echo
cat jwtRS512.key.pub | base64 | tr -d '\n' && echo
```

Copy both outputs - you'll need them for Coolify environment variables.

**IMPORTANT:**
- Back up the original `jwtRS512.key` and `jwtRS512.key.pub` files securely
- NEVER commit these to git
- If you lose them, all users must re-authenticate

## Step 2: Push to GitHub

The frontend is already configured for trextrivia.com. Just push your code:

```bash
git add .
git commit -m "Ready for deployment"
git push origin master
```

GitHub Actions will automatically build the frontend and commit the `dist/` folder.

## Step 3: Deploy to Coolify

### In Coolify Dashboard:

1. **Create New Resource** → Docker Compose
2. **Git Repository**: Point to your GitHub repo
3. **Branch**: `master`
4. **Docker Compose Location**: `/docker-compose.yml`

### Set Environment Variables:

```bash
POSTGRES_PASSWORD=your_strong_random_password_here
DOMAIN=trextrivia.com
JWT_PRIVATE_KEY=paste_base64_encoded_private_key_here
JWT_PUBLIC_KEY=paste_base64_encoded_public_key_here
```

### Configure Domains:

Add `trextrivia.com` to both services:

1. **Backend service**:
   - Domain: `trextrivia.com`
   - Port: `8080`

2. **Frontend service**:
   - Domain: `trextrivia.com`
   - Port: `80`

Traefik will route:
- `/jeopardy/*` → Backend (API + WebSockets)
- `/*` → Frontend (static files)

### Deploy:

Click **Deploy** and monitor logs.

## Step 4: Populate Database

After first deployment, scrape questions from j-archive.com.

SSH into your Coolify server:

```bash
# Navigate to deployment directory
cd /path/to/your/deployment

# Build and run scraper
docker compose -f docker-compose.scraper.yml build
docker compose -f docker-compose.scraper.yml run --rm scraper jeopardy
```

This loads ~100,000+ questions. See [SCRAPING.md](SCRAPING.md) for details.

**To limit for testing:** Edit `be-jeopardy/scrapers/jeopardy.py` and add `MAX_GAMES = 10` for ~600 questions.

## Step 5: Test

Visit https://trextrivia.com

- Create a game
- Join and test WebSocket connections
- Answer questions
- Test chat and reactions

## Updating After Deployment

### Code Changes

```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# GitHub Actions builds frontend automatically
# Then pull in Coolify dashboard to redeploy
```

### Add More Questions

```bash
# SSH to Coolify server
docker compose -f docker-compose.scraper.yml run --rm scraper jeopardy
```

No downtime - scraper runs separately.

## Troubleshooting

### WebSockets not connecting
- Verify `ALLOW_ORIGIN=https://trextrivia.com` in backend env vars
- Check `/jeopardy/*` routes to backend service (port 8080)
- Test: `wscat -c wss://trextrivia.com/jeopardy/chat`

### Frontend shows 404
- Verify GitHub Actions ran and committed `dist/`
- Check `fe-jeopardy/dist/fe-jeopardy/browser/` exists in repo
- Check nginx container: `docker logs <frontend-container>`

### Backend won't start
- Check JWT keys are base64 encoded (single line, no newlines)
- Test decode: `echo "your_key" | base64 -d`
- Check backend logs: `docker logs <backend-container>`

### No questions available
- Run the scraper (Step 4)
- Check database: `docker exec -it <postgres-container> psql -U postgres -c "SELECT count(*) FROM jeopardy_clues;"`

### CORS errors
- Set `ALLOW_ORIGIN=https://trextrivia.com` (include `https://`)
- Check backend logs for received origin

## Architecture

**Services:**
- `postgres` - PostgreSQL (internal)
- `backend` - Go server on port 8080 (`/jeopardy/*`)
- `frontend` - nginx on port 80 (static files)

**WebSocket paths:**
- `/jeopardy/play/:gameName` - Game state
- `/jeopardy/chat` - Chat messages
- `/jeopardy/reactions` - Emoji reactions

**Flow:**
1. User visits `https://trextrivia.com` → Frontend
2. API calls to `https://trextrivia.com/jeopardy/*` → Backend
3. WebSockets to `wss://trextrivia.com/jeopardy/*` → Backend

## Monitoring

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Check health
docker ps

# Check database
docker exec -it <postgres-container> psql -U postgres -c "SELECT count(*) FROM jeopardy_clues;"
```

## Need Help?

- Database setup: [SCRAPING.md](SCRAPING.md)
- Architecture: [DEPLOY-README.md](DEPLOY-README.md)
- Quick reference: [DEPLOYMENT-SUMMARY.txt](DEPLOYMENT-SUMMARY.txt)
