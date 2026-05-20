# Budget App

A clean, modern, motivational, and behavioral-focused budgeting application built with React Native (Expo) on the frontend and a self-hosted Express.js/PostgreSQL stack on the backend. 

---

## Table of Contents
1. [Overview & Core Philosophy](#overview--core-philosophy)
2. [Project Highlights & Tech Stack](#project-highlights--tech-stack)
3. [Core Intelligent Engines](#core-intelligent-engines)
   - [Smart Behavioral Insight Engine](#1-smart-behavioral-insight-engine)
   - [AI-Powered Budget Advisor](#2-ai-powered-budget-advisor)
   - [Smart Savings Planner](#3-smart-savings-planner)
4. [Offline-First Sync Pattern](#offline-first-sync-pattern)
5. [Database Schema & Shared Budgeting](#database-schema--shared-budgeting)
6. [Localization (i18n)](#localization-i18n)
7. [Project Structure](#project-structure)
8. [Comprehensive API Reference](#comprehensive-api-reference)
9. [Detailed Setup & Quickstart](#detailed-setup--quickstart)
10. [Utility Scripts & Diagnostics](#utility-scripts--diagnostics)
11. [Security & Production Hardening](#security--production-hardening)

---

## Overview & Core Philosophy

Traditional budgeting apps fail because they cause friction. They force users to look at numbers in a dry, spreadsheet-like format, which triggers stress. 

This **Budget App** is designed around **behavioral science principles**:
- **Motivation First**: Before seeing raw balance numbers, the user is greeted with a motivational insight card. This positive reinforcement frame encourages consistent engagement.
- **Smart Recommendations**: Custom engines calculate budgets and savings plans without requiring heavy LLM integration, meaning zero-latency, private, and offline-compatible financial advice.
- **Zero-Dependency Visuals**: Utilizes expressive emojis and dynamic themes rather than heavy icons or complex graphics, keeping the app lightweight and accessible cross-platform.
- **Privacy & Ownership**: By utilizing a self-hosted PostgreSQL database and Docker orchestration, your financial data remains entirely under your control.

---

## Project Highlights & Tech Stack

### Frontend (Client)
- **Core**: React Native (Expo SDK 54) + TypeScript.
- **Navigation**: File-based typed routing via `expo-router`.
- **State Management**: Lightweight, high-performance state handling via `zustand`.
- **UI & Animations**: Dynamic micro-animations with `react-native-reanimated`, layout protection using `react-native-safe-area-context`, custom layouts with HSL-based color tokens, and Google Fonts (`Sora` and `Manrope`).
- **Storage**: Offline persistence wrapping `@react-native-async-storage/async-storage`.
- **Haptics**: Micro-tactile feedback through `expo-haptics`.

### Backend (Server)
- **Core**: Node.js + Express.js + TypeScript.
- **Database**: PostgreSQL (v16) with raw connection pooling (`pg` package).
- **Authentication**: Stateful-backed stateless JWT architecture (15-minute access tokens + rotating 7-day refresh tokens stored securely in database).
- **Security**: Request validation (`express-validator`), header security (`helmet`), cross-origin policies (`cors`), and multi-tier rate limiting (`express-rate-limit`).
- **Orchestration**: Docker & Docker Compose setup for database and API server.

---

## Core Intelligent Engines

The application implements three decoupled logical engines under `src/services/` that drive both in-app interfaces and schedule local push notifications.

### 1. Smart Behavioral Insight Engine (`insightEngine.ts`)
Generates contextual, action-oriented financial insights sorted by severity (`alert` → `warning` → `info` → `success`). It scans transactions, budgets, goals, and recurring items across four main domains:
- **Financial Awareness**: Flags large transactions (exceeding a threshold like 1000+ units), detects spending spikes (e.g., spending in a category is $\ge 30\%$ higher than last month), and warns when a single category dominates ($> 60\%$ of total monthly spend).
- **Budget Control**: Instantly highlights exceeded budgets and warns when category spending reaches a high threshold (e.g., $\ge 85\%$ of the set budget).
- **Account Protection**: Flags low balances and overdraft risks, and alerts the user if their upcoming bills exceed $80\%$ of their available funds.
- **Motivation & Goals**: Provides positive reinforcement milestones (e.g., reaching $50\%$, $75\%$, or $100\%$ of a goal target) and delivers rotating daily motivational quotes (e.g., *"Small consistent actions lead to big financial results over time."*).

### 2. AI-Powered Budget Advisor (`budgetAdvisor.ts`)
A rule-based budget recommendation engine that uses a hybrid model of the standard **50/30/20 budget baseline** combined with **3-month historical averages**.
- **Disposable Income Calculation**: Evaluates gross monthly income and deducts fixed recurring obligations.
- **Dynamic Allocation**: Recommends category limits categorized into `essential` (50% target), `lifestyle` (30% target), and `savings` (20% target).
- **Adaptive Context**: If a user has active savings goals, the engine automatically boosts the savings target. It alerts users with contextual tips depending on their actual spending ratios (e.g., warning if they are $\ge 130\%$ over target).

### 3. Smart Savings Planner (`savingsPlanner.ts`)
Calculates feasibility, projects timelines, and issues natural language advice regarding savings goals.
- **Safe Savings Capacity**: Deducts fixed bills, average variable expenses (excluding savings-tagged transactions), and a custom **safety buffer** (defaults to 20% of income) from average monthly income.
- **Priority Queue Allocation**: Sorts active goals by deadline urgency. High-urgency deadline-based goals are funded first. Leftover safe savings are split equally among open-ended (deadline-free) goals.
- **Feasibility Checking**: Evaluates if the current savings capacity matches the monthly requirement needed to hit each goal's deadline. If not, it calculates an **Income Gap** (the extra monthly earnings or cuts needed to succeed) and returns structured advice array sentences.

---

## Offline-First Sync Pattern

The application is built to run flawlessly offline, synchronizing state to the server optimistically when connectivity is established:

```mermaid
sequenceDiagram
    participant User
    participant Zustand Store
    participant AsyncStorage
    participant API Server
    
    User->>Zustand Store: Add Transaction / Update Goal
    Zustand Store->>AsyncStorage: Persist updated state locally
    Zustand Store->>Zustand Store: Apply optimistic UI update (Instant feedback)
    Zustand Store->>API Server: POST /api/transactions (Sync in background)
    alt Server online
        API Server-->>Zustand Store: 201 Created & Verified Payload
        Zustand Store->>AsyncStorage: Mark record as synced
    else Server offline / Connection drops
        Zustand Store->>Zustand Store: Queue unsynced items in store memory
        Note over Zustand Store: App retries sync on next launch or reconnect
    end
```

This sequence ensures zero input delay for the user while protecting data from volatile network conditions.

---

## Database Schema & Shared Budgeting

The database runs on **PostgreSQL 16**. The initial schema (`001_initial_schema.sql`) details eight relational tables optimized with indices and auto-updating triggers:

```mermaid
erDiagram
    users ||--o{ refresh_tokens : has
    users ||--o{ categories : "creates custom"
    users ||--o{ transactions : logs
    users ||--o{ budgets : manages
    users ||--o{ savings_goals : tracks
    users ||--o{ family_groups : creates
    users ||--o{ group_members : belongs_to
    
    family_groups ||--o{ group_members : contains
    family_groups ||--o{ transactions : groups
    family_groups ||--o{ budgets : "shares budget"
    family_groups ||--o{ savings_goals : "shares goals"
    
    categories ||--o{ transactions : classifies
    categories ||--o{ budgets : scopes
```

### Table Schema Summary

| Table | Primary Key | Key Fields | Description |
|---|---|---|---|
| `users` | `UUID` | `email`, `password_hash`, `currency` | User accounts and global settings |
| `refresh_tokens` | `UUID` | `user_id`, `token_hash`, `expires_at` | Rotating refresh tokens for secure JWT flow |
| `categories` | `UUID` | `user_id` (NULL=system), `name`, `icon`, `color` | System default and custom categories |
| `family_groups` | `UUID` | `name`, `created_by`, `invite_code` | Shared family/group spaces |
| `group_members` | `UUID` | `group_id`, `user_id`, `role` (admin/member) | Junction table for group membership |
| `transactions` | `UUID` | `user_id`, `group_id`, `amount`, `type`, `date`, `tags` | Expense/income entries |
| `budgets` | `UUID` | `category_id`, `amount`, `month`, `year` | Category limits for a monthly period |
| `savings_goals` | `UUID` | `name`, `target_amount`, `current_amount`, `deadline` | Financial targets & milestone tracker |

### Advanced SQL Trigger Functionality
- **`update_updated_at()`**: A PL/pgSQL function triggered before any update command on `users`, `transactions`, `budgets`, `savings_goals`, and `family_groups` to keep database audits precise.
- **`join_group_by_invite_code()`**: A secure stored procedure that validates an 8-character uppercase invite code and atomically registers the calling user to the corresponding group with a default `member` role, avoiding race conditions.

---

## Localization (i18n)

The application features full multi-language localization managed by `i18next` and `react-i18next`. Supported locales are located under `src/i18n/locales/`:

1. **English (`en`)** — `en.json`
2. **Spanish (`es`)** — `es.json`
3. **Persian / Farsi (`fa`)** — `fa.json` (Includes full RTL support styling overrides)
4. **Malay (`ms`)** — `ms.json`

The app automatically reads the system language on startup and loads the respective translation bundle.

---

## Project Structure

```
budget-app/
├── .agents/                 # AI Assistant workspace rules
├── app/                     # Expo Router file-based screens
│   ├── (auth)/              # Register, Login, and Reset screens
│   ├── (tabs)/              # Main tab bar navigation:
│   │   ├── index.tsx        # Dashboard (Motivate, balance summary, category chart)
│   │   ├── transactions.tsx # List, search, filter transactions
│   │   ├── budgets.tsx      # Set and monitor category limits
│   │   ├── goals.tsx        # Track savings goals & timeline planner
│   │   └── plan.tsx         # AI budgeting advisor recommendations
│   └── modals/              # Transaction addition, budget, and goal modals
├── src/
│   ├── components/          # Reusable UI component layer:
│   │   ├── ui/              # Buttons, Cards, Inputs, ProgressBars, Badges
│   │   ├── dashboard/       # InsightCard, BalanceSummary, CategoryBreakdown
│   │   ├── transactions/    # TransactionItem, SearchFilter
│   │   ├── budgets/         # BudgetCard, BudgetList
│   │   └── goals/           # GoalCard, SavingsPlannerDetails
│   ├── i18n/                # Localization setup and translation files
│   ├── lib/                 # Shared logic / HTTP client
│   ├── services/            # Intelligent engines & native device services
│   ├── stores/              # Zustand global application state stores
│   ├── theme/               # Design tokens (Colors, Typography, Spacing)
│   ├── types/               # TypeScript models & schemas
│   └── utils/               # Formatting, currency, date helpers
├── server/                  # Node/Express API Server
│   ├── src/
│   │   ├── db/              # Postgres pool connection & migrations system
│   │   ├── middleware/      # Rate limits, body validators, JWT verification
│   │   └── routes/          # API subrouters
│   ├── Dockerfile           # Multi-stage production container setup
│   └── package.json         # Server scripts & dependencies
├── scripts/                 # Administration scripts
│   └── reset-data.mjs       # Database tables wiper script
├── docker-compose.yml       # Production-ready PostgreSQL & API orchestration
└── package.json             # Root Expo client configurations
```

---

## Comprehensive API Reference

All requests and responses follow standard JSON styling. Authenticated requests require the HTTP header:
`Authorization: Bearer <access_token>`

### 1. Authentication Endpoints

#### `POST /api/auth/register`
Creates a new user profile. Stricter rate limits apply (10 attempts per 15 minutes).
- **Body Schema**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123",
    "full_name": "John Doe"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "data": {
      "user": { "id": "uuid", "email": "user@example.com", "user_metadata": { "full_name": "John Doe" } },
      "session": { "access_token": "jwt...", "refresh_token": "jwt...", "expires_in": 900 },
      "profile": { "id": "uuid", "full_name": "John Doe", "avatar_url": null, "currency": "MYR", "created_at": "...", "updated_at": "..." }
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates user, issues access and refresh tokens.
- **Body Schema**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123"
  }
  ```
- **Response (200 OK)**:
  *(Same payload structure as register response)*

#### `POST /api/auth/refresh`
Rotates and updates JWT sessions securely. The database revokes the old refresh token and generates a new pair.
- **Body Schema**:
  ```json
  {
    "refresh_token": "old_refresh_token_jwt..."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "session": { "access_token": "new_access_token...", "refresh_token": "new_refresh_token...", "expires_in": 900 }
    }
  }
  ```

#### `POST /api/auth/logout`
Revokes all active sessions for the authenticated user by dropping refresh tokens from the DB.
- **Response (200 OK)**:
  ```json
  {
    "data": { "message": "Logged out successfully" }
  }
  ```

#### `GET /api/auth/me`
Retrieves currently authenticated user and profile metadata.
- **Response (200 OK)**:
  *(Standard user and profile metadata payload)*

---

### 2. Profile Endpoints

#### `GET /api/profiles/:id`
Retrieves a specific user profile. Users are authorized to request only their own profile.
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "id": "uuid",
      "full_name": "John Doe",
      "avatar_url": "https://example.com/avatar.png",
      "currency": "USD",
      "created_at": "...",
      "updated_at": "..."
    }
  }
  ```

#### `PATCH /api/profiles/:id`
Updates profile metadata. Allowed fields: `full_name`, `currency` (3 uppercase letters), `avatar_url`.
- **Response (200 OK)**:
  *(Returns updated profile object)*

---

### 3. Categories Endpoints

#### `GET /api/categories`
Lists categories (Returns both global default categories where `user_id IS NULL` and custom categories belonging to the user).
- **Response (200 OK)**:
  ```json
  {
    "data": [
      { "id": "uuid", "user_id": null, "name": "Food", "icon": "🍔", "color": "#F97316", "type": "expense", "is_default": true, "sort_order": 1 },
      { "id": "uuid", "user_id": "user-uuid", "name": "Side Project", "icon": "🚀", "color": "#10B981", "type": "income", "is_default": false, "sort_order": 0 }
    ]
  }
  ```

#### `POST /api/categories`
Creates a custom user category.
- **Body Schema**:
  ```json
  {
    "name": "Gym & Fitness",
    "icon": "🏋️",
    "color": "#EF4444",
    "type": "expense",
    "sort_order": 15
  }
  ```
- **Response (201 Created)**:
  *(Returns created category)*

#### `PATCH /api/categories/:id` & `DELETE /api/categories/:id`
Allows editing or removing user-created custom categories. Attempts to modify system categories yield an authorization error.

---

### 4. Transactions Endpoints

#### `GET /api/transactions`
Fetches a list of recent transactions.
- **Query Params**:
  - `limit`: (Optional) Limit returned rows (Default: 100, Max: 500).
  - `group_id`: (Optional) Fetch shared transactions for a family group.
- **Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "user_id": "user-uuid",
        "group_id": null,
        "category_id": "cat-uuid",
        "type": "expense",
        "amount": "45.50",
        "note": "Weekly Groceries",
        "date": "2026-05-20",
        "payment_method": "card",
        "tags": ["groceries", "food"],
        "is_recurring": false,
        "created_at": "...",
        "updated_at": "...",
        "category": { "id": "cat-uuid", "name": "Food", "icon": "🍔", "color": "#F97316" }
      }
    ]
  }
  ```

#### `POST /api/transactions`
Logs a new transaction.
- **Body Schema**:
  ```json
  {
    "type": "expense",
    "amount": 12.80,
    "category_id": "cat-uuid",
    "note": "Lunch details",
    "date": "2026-05-20",
    "payment_method": "cash",
    "tags": ["lunch"],
    "is_recurring": false,
    "group_id": null
  }
  ```

#### `PATCH /api/transactions/:id` & `DELETE /api/transactions/:id`
Enables modifying and deleting transactions belonging to the user.

---

### 5. Budgets Endpoints

#### `GET /api/budgets`
Lists category limits. Can filter by `month` (1-12) and `year`.
- **Response (200 OK)**:
  ```json
  {
    "data": [
      { "id": "uuid", "user_id": "user-uuid", "group_id": null, "category_id": "cat-uuid", "amount": "500.00", "period": "monthly", "month": 5, "year": 2026, "category": { ... } }
    ]
  }
  ```

#### `PUT /api/budgets`
Upserts a budget limit. If a limit already exists for the matching combination of user/group, category, period, month, and year, the value is updated; otherwise, a new budget entry is created.
- **Body Schema**:
  ```json
  {
    "category_id": "cat-uuid",
    "amount": 600.00,
    "period": "monthly",
    "month": 5,
    "year": 2026,
    "group_id": null
  }
  ```

---

### 6. Savings Goals Endpoints

#### `GET /api/goals`
Lists active savings goals.

#### `POST /api/goals`
Creates a goal target.
- **Body Schema**:
  ```json
  {
    "name": "New Laptop",
    "target_amount": 2500.00,
    "current_amount": 300.00,
    "deadline": "2026-12-31",
    "icon": "💻",
    "color": "#3B82F6",
    "group_id": null
  }
  ```

#### `PATCH /api/goals/:id` & `DELETE /api/goals/:id`
Updates and manages savings goals. `PATCH` allows modifying the `current_amount` or marking the goal as completed with `is_completed: true`.

---

### 7. Family/Group Shared Budgeting

#### `GET /api/groups`
List the user's family groups, including list of group members and their user profiles.

#### `POST /api/groups`
Creates a new shared family group and designates the creator as the group `admin`. Generates a unique 8-character alphanumeric `invite_code`.
- **Body Schema**:
  ```json
  {
    "name": "The Smith Family",
    "description": "Our shared household budget",
    "icon": "🏡",
    "color": "#10B981"
  }
  ```

#### `POST /api/groups/join`
Enables joining an existing group using their invite code.
- **Body Schema**:
  ```json
  {
    "invite_code": "A8B2C3D4"
  }
  ```

---

## Detailed Setup & Quickstart

Follow these instructions to start the environment locally.

### Prerequisites
- Install [Node.js](https://nodejs.org/) (v18 or newer recommended).
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Step 1: Configure Environment Variables

1. Set up the local client environment variables. Copy the `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Modify `.env` to point `EXPO_PUBLIC_API_URL` to your API server:
   ```env
   # Local development url
   EXPO_PUBLIC_API_URL=http://localhost:3001
   ```

2. Set up the Docker containers variables. Copy `.env.docker.example` to `.env.docker`:
   ```bash
   cp .env.docker.example .env.docker
   ```

3. Open `.env.docker` and fill in secure values:
   - Generate secure JWT secrets:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - Generate a secure Postgres password:
     ```bash
     openssl rand -base64 24
     ```

### Step 2: Start the Backend Infrastructure
Use Docker Compose to build the server container, boot the PostgreSQL database, run initial migrations, and spin up the API:
```bash
docker compose up -d --build
```
Verify services are active:
```bash
docker compose ps
```

### Step 3: Run the Expo Mobile Application
1. Install client dependencies from the root directory:
   ```bash
   npm install
   ```
2. Start the Expo builder:
   ```bash
   npx expo start
   ```
3. Control the simulator options:
   - Press **`i`** to boot the iOS Simulator.
   - Press **`a`** to boot the Android Emulator.
   - Scan the terminal QR code using the **Expo Go** application on your physical device.

---

## Utility Scripts & Diagnostics

### Database Slate Reset
If you need to wipe all tables in your local development environment and restart clean, use the reset script:
```bash
# Execute directly from root (requires setting DATABASE_URL context)
DATABASE_URL=postgresql://budget_user:your_password@localhost:5432/budget_app node scripts/reset-data.mjs
```
*Note: Category defaults are re-seeded automatically by migration triggers when you re-launch the backend.*

### Endpoint Probes
- **Liveness Probe**: `curl http://localhost:3001/api/health`
  - Returns `200 OK` if the node process is running.
- **Readiness Probe**: `curl http://localhost:3001/api/ready`
  - Returns `200 OK` if the server is healthy and successfully querying the PostgreSQL pool. If the database is down, returns `503 Service Unavailable`.

---

## Security & Production Hardening

- **Database Connection Security**: In a production environment, connection URLs should include `?sslmode=require`. The server allows setting strict certificate verification in `.env`:
  ```env
  DB_SSL_REJECT_UNAUTHORIZED=true
  DB_SSL_CA=/path/to/ca-certificate.crt
  ```
- **Non-Root Docker Execution**: The backend container `Dockerfile` uses a multi-stage compilation that copies compiled Javascript into a lean runner image and runs using the standard non-privileged `node` user to prevent privilege escalations.
- **Token Rotation Safety**: Access tokens expire in 15 minutes, forcing the client to trade their refresh token. When a refresh token is traded, the server rotates *both* access and refresh tokens, invalidating the old refresh token globally.
- **Strict Rate Limits**: Applied to prevent brute-force attacks. General API endpoints are limited to 200 requests per 15 minutes per IP. Authentication routes `/api/auth/login` and `/api/auth/register` are capped at 10 requests per 15 minutes.
- **Security Headers**: Standard express routing is wrapped inside `helmet()` to block cross-site scripting (XSS), sniff attacks, and enforce transport-security headers.
