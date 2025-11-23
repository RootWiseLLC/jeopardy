# Question Scraping & Database Loading

The scraping system is **completely separate** from the main deployment. You can update scrapers and re-run them anytime without affecting the running application.

## Quick Start

### Local Development (scrape + upload flow)

```bash
# 1. Start PostgreSQL
cd be-jeopardy
docker compose up -d postgres

# 2. Set up Python environment with uv
uv venv
uv pip install requests beautifulsoup4 psycopg2-binary

# 3. Fix database port in Python scripts
# Edit insert_clues.py line 15: change port='5432' to port='5434'
# Edit add_alternatives.py line 8: change port='5432' to port='5434'

# 4. Run scraper
.venv/bin/python scrapers/jeopardy.py

# 5. Load into database
mv scrapers/*.tsv clues/
.venv/bin/python insert_clues.py
.venv/bin/python add_alternatives.py
```

### On Coolify Server (load data from local scrape)

```bash
# 1. Run the scraper locally (see steps above). The TSV lands under be-jeopardy/scrapers/
# in LOCAL BUILD root...
# First comment out the network stuff in docker-compose.scraper.yml
docker compose -f docker-compose.scraper.yml build scraper
docker compose -f docker-compose.scraper.yml run --rm scraper jeopardy
# then uncomment the network stuff

# 2. Copy the TSV to the server
scp be-jeopardy/clues/jeopardy_seasons_30_40.tsv \
    root@5.161.234.29:/data/coolify/applications/ps0cc4c8cw0okc0cg8ogs840/be-jeopardy/clues/

# 3. Load the TSV into the production database
# on server...
cd /data/coolify/applications/ps0cc4c8cw0okc0cg8ogs840
docker compose -f docker-compose.scraper.yml run --rm \
  --entrypoint bash \
  scraper -c "python insert_clues.py && python add_alternatives.py"
```

## Available Scrapers

All scrapers are in `be-jeopardy/scrapers/`:

1. **jeopardy.py** - j-archive.com (official Jeopardy questions)
   - Most authentic source
   - ~100,000+ questions
   - Modify `MAX_GAMES` variable to limit scraping

2. **jetpunk.py** - jetpunk.com trivia
3. **opentdb.py** - Open Trivia Database
4. **the-trivia-api.py** - The Trivia API

## Updating Scrapers After Deployment

You can modify scrapers anytime:

### Local Changes
```bash
# Edit scraper
vim be-jeopardy/scrapers/jeopardy.py

# Test locally
cd be-jeopardy
.venv/bin/python scrapers/jeopardy.py

# Push changes
git add scrapers/
git commit -m "Update scraper"
git push
```

### On Server
```bash
# Pull latest code
git pull

# Rebuild scraper image
docker build -f Dockerfile.scraper -t jeopardy-scraper .

# Run updated scraper
docker run --rm \
  --network jeopardy_default \
  -e DATABASE_URL="..." \
  jeopardy-scraper jeopardy
```

## Database Port Configuration

**Important:** The Python scripts default to port 5432, but docker-compose uses 5434 for local dev.

You have two options:

### Option 1: Use environment variable (recommended for server)
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://postgres:postgres@localhost:5434/postgres?sslmode=disable"

# Then modify Python scripts to read from env var
```

### Option 2: Hard-code port (quick fix for local dev)
Edit these files:
- `insert_clues.py` line 15: `port='5434'`
- `add_alternatives.py` line 8: `port='5434'`

## Limiting Scraping (Testing)

When testing, you don't want to scrape all 100,000+ questions. Edit `scrapers/jeopardy.py`:

```python
games = 1
MAX_GAMES = 10  # Add this line at top of scraping loop

for row in rows:
    if games > MAX_GAMES:  # Add this check
        break
    # ... rest of scraping code
```

This limits to 10 games (~600 questions) instead of the full archive.

## Workflow Summary

1. **Initial deployment**: Scrape and load questions once before going live
2. **Running app**: Main app runs independently, reads from database
3. **Updates**: Re-run scrapers anytime to add more questions (scripts use INSERT, not DELETE)
4. **No downtime**: Scraping doesn't affect running games

## Pre-seeded Database (Advanced)

For faster deployment, you can:

1. Scrape and populate database locally
2. Export PostgreSQL data: `pg_dump > questions.sql`
3. Create a Docker volume with pre-loaded data
4. Mount volume in production

This way new deployments start with a full database.
