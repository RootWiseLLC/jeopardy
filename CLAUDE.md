# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time multi-player Jeopardy game with over 100,000 questions. This is a full-stack application with a Go backend (WebSocket server) and Angular frontend.

Live deployment: https://playjeopardy.netlify.app

## Architecture

### Backend (be-jeopardy)
- **Language**: Go
- **Framework**: Gin HTTP router with WebSocket support
- **Database**: PostgreSQL (via Docker Compose)
- **Authentication**: JWT-based auth with Supabase integration

**Key packages** (in `internal/`):
- `jeopardy/`: Core game logic, player management, bot behavior, question handling, analytics
- `handlers/`: HTTP route handlers for API endpoints
- `socket/`: WebSocket connection management for real-time gameplay
- `db/`: Database queries and connection management
- `auth/`: JWT token validation and authentication
- `logic/`: Game flow and state management

The server runs a background goroutine (1-hour ticker) that cleans up inactive games.

### Frontend (fe-jeopardy)
- **Framework**: Angular 17.3
- **Styling**: LESS
- **State Management**: RxJS services
- **Authentication**: Supabase (Google, GitHub, email)

**Key directories** (in `src/app/`):
- `game/`: Main game UI components and gameplay screens
- `services/`: Core services including `game-state.service.ts` (game state management), `websocket.service.ts` (server communication), `api.service.ts` (HTTP requests), `auth.service.ts` (authentication)
- `auth/`, `profile/`, `analytics/`, `leaderboards/`: Feature modules
- `model/`: TypeScript interfaces for game entities

## Initial Setup (Fresh Environment)

### Prerequisites
- Go 1.25+ (`brew install go` on macOS)
- Node.js 18+ (currently using v23.8.0)
- PNPM (`npm install -g pnpm`)
- Docker Desktop (for PostgreSQL)
- Optional: air for Go hot reload (`go install github.com/air-verse/air@latest`)

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd be-jeopardy
   go mod tidy
   ```

2. **Generate JWT keys:**
   ```bash
   mkdir -p .keys
   ./gen_keys.sh
   ```
   This creates RSA key pair in `.keys/jwtRS512.key` and `.keys/jwtRS512.key.pub`

3. **Create .env file:**
   ```bash
   cat > .env << 'EOF'
   PORT=8080
   GIN_MODE=debug
   DATABASE_URL=postgresql://postgres:postgres@localhost:5434/postgres?sslmode=disable
   ALLOW_ORIGIN=http://localhost:4200q
   EOF

   # Add JWT keys (multi-line values)
   echo "JWT_RS512_KEY=\"$(cat .keys/jwtRS512.key)\"" >> .env
   echo "JWT_RS512_PUB_KEY=\"$(cat .keys/jwtRS512.key.pub)\"" >> .env
   ```

4. **Start PostgreSQL:**
   ```bash
   docker compose up -d postgres
   ```
   PostgreSQL runs on port 5434 (mapped from container's 5432)

5. **Run the server:**

   **With hot reload (recommended for development):**
   ```bash
   export PORT=8080 && \
   export GIN_MODE=debug && \
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5434/postgres?sslmode=disable" && \
   export ALLOW_ORIGIN="http://localhost:4200" && \
   export JWT_RS512_KEY="$(cat .keys/jwtRS512.key)" && \
   export JWT_RS512_PUB_KEY="$(cat .keys/jwtRS512.key.pub)" && \
   ~/go/bin/air
   ```

   **Without hot reload:**
   ```bash
   source .env  # May not work with multi-line values
   make run
   ```

   Server runs on http://localhost:8080

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd fe-jeopardy
   pnpm install
   ```

2. **Add Node.js types (required for compilation):**
   ```bash
   pnpm add -D @types/node
   ```

3. **Update tsconfig.app.json:**
   Edit `tsconfig.app.json` and change `"types": []` to `"types": ["node"]`

   This fixes TypeScript errors with `NodeJS.Timeout` and `Buffer` types.

4. **Run dev server:**
   ```bash
   pnpm run ng serve
   ```

   Frontend runs on http://localhost:4200 with hot reload enabled

### Loading Questions into Database

After PostgreSQL is running, load questions using Python scripts with uv:

**1. Set up Python environment with uv:**
```bash
brew install uv                    # Install uv package manager
cd be-jeopardy
uv venv                            # Create virtual environment in .venv
uv pip install requests beautifulsoup4 psycopg2-binary
```

**2. Modify scraper for quick testing** (optional):
For testing, edit `scrapers/jeopardy.py` to limit games:
```python
games = 1
MAX_GAMES = 10  # Add this line
for row in rows:
    if games > MAX_GAMES:  # Add this line
        break              # Add this line
    print(f'{games}/{MAX_GAMES}')  # Update this line
```

**3. Run scraper:**
```bash
mkdir -p clues
cd scrapers
../.venv/bin/python jeopardy.py    # Scrapes j-archive.com
# Alternative sources:
# ../.venv/bin/python jetpunk.py
# ../.venv/bin/python opentdb.py
```

**4. Fix database port in scripts:**
The Python scripts default to port 5432, but docker-compose uses 5434. Update both:
- `insert_clues.py` line 15: change `port='5432'` to `port='5434'`
- `add_alternatives.py` line 8: change `port='5432'` to `port='5434'`

**5. Load questions into database:**
```bash
cd be-jeopardy
mv scrapers/season40.tsv clues/     # Move scraped data
.venv/bin/python insert_clues.py    # Creates tables and inserts questions
```

**6. Process answer alternatives:**
```bash
.venv/bin/python add_alternatives.py  # Adds variations (removes "the", handles parentheses, etc.)
```

**Result:** Database populated with ~600 questions (10 games) or more depending on scraper settings.

## Development Commands

### Backend
```bash
cd be-jeopardy
go mod tidy                      # Install dependencies
docker compose up -d postgres    # Start PostgreSQL database
make build                       # Build server binary
make run                         # Build and run server
make clean                       # Clean build artifacts
go test ./...                    # Run tests
```

### Frontend
```bash
cd fe-jeopardy
pnpm install                     # Install dependencies
pnpm run ng serve                # Run dev server with hot reload
pnpm run ng build                # Production build
pnpm run ng test                 # Run Karma/Jasmine tests
```

## Answer Validation Logic

The game uses **fuzzy matching** via Levenshtein distance (`internal/jeopardy/question.go`):

- Case-insensitive comparison
- Tolerance scales with answer length:
  - ≤5 chars: exact match
  - 5-7 chars: 1 character difference allowed
  - 7-9 chars: 2 characters
  - 9-12 chars: 3 characters
  - 12-15 chars: 4 characters
  - 15+ chars: 5 characters

Answers from j-archive.com include variations:
- `(Harry) Houdini` → parentheses mean "Harry" is optional
- `Gordie Howe (or Bobby Hull)` → multiple acceptable answers

The `add_alternatives.py` script processes these patterns into the database.

## Real-time Game Flow

1. Players create/join games via HTTP API
2. WebSocket connection established for real-time updates
3. Game state synchronized through `game-state.service.ts` on frontend
4. Backend manages game logic, question selection, scoring, and timers in `internal/jeopardy/game.go`
5. Chat messages and emoji reactions broadcast via WebSocket
6. Player analytics and leaderboards updated in PostgreSQL

## Important Notes

- **PNPM required**: Frontend uses PNPM (not NPM) per global config
- **uv required**: Backend Python scripts use uv for package management (not pip/virtualenv)
- **Multi-line env vars**: The `.env` file contains multi-line JWT keys - use `export` commands instead of `source .env`
- **air location**: May be installed in `~/go/bin/air` if not in PATH
- **Node types**: Frontend requires `@types/node` and `"types": ["node"]` in tsconfig
- **Docker port mapping**: PostgreSQL container exposes port 5434 (not default 5432)
- **Bot logic**: Includes difficulty levels and timing simulation (`internal/jeopardy/bot.go`)
- **Name generation**: Anonymous players get adjective + animal names
- **Game cleanup**: Runs hourly to remove stale games
- **WebSocket sync**: Message types defined in both frontend and backend - keep in sync
- **Tests in Docker**: Frontend tests require Chrome launcher, won't work in Docker
