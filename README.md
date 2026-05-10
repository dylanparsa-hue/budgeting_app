# Budget App

A clean, modern, motivational budgeting app built with React Native (Expo) + Supabase.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run `supabase/migrations/001_initial_schema.sql`
3. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key

```bash
cp .env.example .env
```

### 3. Run the app
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
│   ├── services/           # Supabase client + AsyncStorage wrapper
│   ├── hooks/              # Custom hooks
│   ├── utils/              # currency, categories, insights helpers
│   ├── types/              # TypeScript types
│   └── theme/              # Colors, Typography, Spacing design tokens
└── supabase/
    └── migrations/         # SQL schema
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Offline-first** | AsyncStorage cache → optimistic updates → server sync |
| **Zustand** | Minimal boilerplate, built-in subscriptions, small bundle |
| **Expo Router** | File-based routing, typed routes, modal support |
| **Insight card first** | Users see a motivational message before numbers — keeps them engaged |
| **Emoji icons** | No icon library dependency, works cross-platform, expressive |

## Features

- ✅ Email auth (Supabase)
- ✅ Add income / expenses in seconds
- ✅ 12 default categories + custom categories
- ✅ Monthly budgets per category with visual progress
- ✅ Savings goals with deposit tracking
- ✅ Behavioral insight engine (motivational messages)
- ✅ Dashboard with balance, charts, category breakdown
- ✅ Offline-first with auto-sync
- ✅ Search & filter transactions
- ✅ Family group architecture (DB + RLS ready)

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
