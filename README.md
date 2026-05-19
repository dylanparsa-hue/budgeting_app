# Budget App

A clean, modern, motivational budgeting app built with React Native (Expo) + self-hosted PostgreSQL.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up the backend (Docker)

```bash
# Copy and fill in environment variables
cp .env.docker.example .env.docker

# Generate secure secrets:
# JWT secrets:   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# DB password:   openssl rand -base64 32

# Start PostgreSQL + API server
docker compose up -d
```

The API server runs migrations automatically on startup.

### 3. Set up the Expo app

```bash
cp .env.example .env
# .env should point EXPO_PUBLIC_API_URL to your API server
```

### 4. Run the app
```bash
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Project Structure

```
budget-app/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (auth)/             # Login & Register
│   ├── (tabs)/             # Main 5-tab navigation
│   └── modals/             # Add Transaction, Budget, Goal modals
├── src/
│   ├── components/
│   │   ├── ui/             # Button, Card, Input, ProgressBar, Badge
│   │   ├── dashboard/      # InsightCard, BalanceSummary, CategoryBreakdown
│   │   ├── transactions/   # TransactionItem
│   │   ├── budgets/        # BudgetCard
│   │   └── goals/          # GoalCard
│   ├── stores/             # Zustand state (auth, transactions, budgets, goals)
│   ├── services/           # API client + AsyncStorage wrapper
│   ├── hooks/              # Custom hooks
│   ├── utils/              # currency, categories, insights helpers
│   ├── types/              # TypeScript types
│   └── theme/              # Colors, Typography, Spacing design tokens
├── server/                 # Express.js API backend
│   ├── src/
│   │   ├── db/             # PostgreSQL pool, migrations
│   │   ├── routes/         # REST API routes
│   │   └── middleware/     # Auth (JWT), rate limiting
│   └── Dockerfile          # Multi-stage production build
├── scripts/                # Utility scripts (reset-data, etc.)
└── docker-compose.yml      # PostgreSQL + API orchestration
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Offline-first** | AsyncStorage cache → optimistic updates → server sync |
| **Self-hosted PostgreSQL** | Full control, no vendor lock-in, Docker-based deployment |
| **JWT Auth** | Stateless access tokens (15m) + rotating refresh tokens (7d) |
| **Zustand** | Minimal boilerplate, built-in subscriptions, small bundle |
| **Expo Router** | File-based routing, typed routes, modal support |
| **Insight card first** | Users see a motivational message before numbers — keeps them engaged |
| **Emoji icons** | No icon library dependency, works cross-platform, expressive |

## Features

- ✅ Email auth (JWT-based, self-hosted)
- ✅ Add income / expenses in seconds
- ✅ 12 default categories + custom categories
- ✅ Monthly budgets per category with visual progress
- ✅ Savings goals with deposit tracking
- ✅ Behavioral insight engine (motivational messages)
- ✅ Dashboard with balance, charts, category breakdown
- ✅ Offline-first with auto-sync
- ✅ Search & filter transactions
- ✅ Family group architecture (DB ready)

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `.env` | Your Express API server URL |
| `DATABASE_URL` | `server/.env` | PostgreSQL connection string |
| `JWT_SECRET` | `server/.env` | Access token signing secret |
| `JWT_REFRESH_SECRET` | `server/.env` | Refresh token signing secret |
| `POSTGRES_PASSWORD` | `.env.docker` | Database password (Docker) |

## Scripts

```bash
# Reset all user data (requires DATABASE_URL env var)
DATABASE_URL=postgresql://... node scripts/reset-data.mjs

# Health check
curl http://localhost:3001/api/health

# Readiness check
curl http://localhost:3001/api/ready
```
