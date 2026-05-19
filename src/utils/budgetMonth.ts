/**
 * budgetMonth.ts
 *
 * Central budget-month attribution utilities.
 *
 * TWO CORE CONCEPTS
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. TRANSACTION DATE  — the real calendar date the money moved.
 *      Stored in `transaction.date`.
 *      Used for: transaction history display, all-time cash-balance.
 *
 *   2. BUDGET MONTH  — the month a transaction belongs to for budgeting,
 *      AI recommendations, and monthly analytics.
 *      Stored as a tag on the transaction:
 *        • Income  → `budget_month:YYYY-MM`
 *        • Expense → `obligation_month:YYYY-MM`  (obligation/fixed-bill expenses only)
 *        • Regular expense with no tag → same as transaction date month
 *
 * EXAMPLES
 * ─────────────────────────────────────────────────────────────────────────────
 *   June salary received May 29
 *     transactionDate = 2026-05-29
 *     budgetMonth     = 2026-06   (via budget_month:2026-06 tag)
 *
 *   June rent paid early on May 12
 *     transactionDate = 2026-05-12
 *     budgetMonth     = 2026-06   (via obligation_month:2026-06 tag)
 *
 * BACKWARD COMPATIBILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * Transactions without a budget/obligation tag fall back to their date month.
 */

type MinTransaction = { type: string; date: string; tags: string[] };

// ─── Tag prefix constants ─────────────────────────────────────────────────────

export const BUDGET_MONTH_TAG_PREFIX     = 'budget_month:';
export const OBLIGATION_MONTH_TAG_PREFIX = 'obligation_month:';

/**
 * Tag written on an expense when the user confirms an over-budget spend.
 * Format: `budget_split:YYYY-MM:33.00`
 * Meaning: `amount` of this expense is allocated to `YYYY-MM`'s budget
 *           (the overflow that exceeds the primary month's remaining budget).
 */
export const BUDGET_SPLIT_TAG_PREFIX = 'budget_split:';

/** Build the `budget_month:YYYY-MM` tag to store on an income transaction. */
export function makeBudgetMonthTag(monthKey: string): string {
  return `${BUDGET_MONTH_TAG_PREFIX}${monthKey}`;
}

/**
 * Build the `budget_split:YYYY-MM:amount` tag for an over-budget expense.
 * The tag records that `amount` of the expense is allocated to `monthKey`'s budget.
 */
export function makeBudgetSplitTag(monthKey: string, amount: number): string {
  return `${BUDGET_SPLIT_TAG_PREFIX}${monthKey}:${amount.toFixed(2)}`;
}

/**
 * Parse a `budget_split:YYYY-MM:amount` tag.
 * Returns `{ monthKey, amount }` or `null` if the tag is missing / malformed.
 */
export function parseBudgetSplitTag(tag: string): { monthKey: string; amount: number } | null {
  if (!tag.startsWith(BUDGET_SPLIT_TAG_PREFIX)) return null;
  const rest  = tag.slice(BUDGET_SPLIT_TAG_PREFIX.length);
  const match = rest.match(/^(\d{4}-\d{2}):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { monthKey: match[1], amount: parseFloat(match[2]) };
}

/** Extract the `YYYY-MM` budget-month key from a transaction's tags. */
function extractBudgetMonthTag(tags: string[]): string | null {
  const tag = tags.find(t => t.startsWith(BUDGET_MONTH_TAG_PREFIX));
  return tag ? tag.slice(BUDGET_MONTH_TAG_PREFIX.length) : null;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the budget month key (`YYYY-MM`) for a transaction.
 *
 * • Income with a `budget_month:YYYY-MM` tag → that tag's value.
 * • Everything else (expenses, untagged income) → the transaction's own date.
 */
export function getBudgetMonthKey(t: MinTransaction): string {
  if (t.type === 'income') {
    const tagged = extractBudgetMonthTag(t.tags ?? []);
    if (tagged) return tagged;
  }
  // Fast path: ISO date starts with YYYY-MM
  return t.date.slice(0, 7);
}

/**
 * Returns the budget month key (`YYYY-MM`) for an EXPENSE transaction.
 *
 * Obligation / fixed-bill expenses carry an `obligation_month:YYYY-MM` tag
 * that records which budget month the bill belongs to, even when paid early.
 *
 * Example: June rent paid on May 12 has transactionDate=2026-05-12 but
 *          budgetMonth=2026-06 (stored as `obligation_month:2026-06` tag).
 *
 * Regular expenses without the tag fall back to their transaction date month.
 */
export function getExpenseBudgetMonthKey(t: MinTransaction): string {
  if (t.type === 'expense') {
    const tag = (t.tags ?? []).find(tag => tag.startsWith(OBLIGATION_MONTH_TAG_PREFIX));
    if (tag) return tag.slice(OBLIGATION_MONTH_TAG_PREFIX.length);
  }
  return t.date.slice(0, 7);
}

/**
 * Unified helper: returns the budget month key for ANY transaction type.
 *
 * • Income  → reads `budget_month:YYYY-MM` tag, falls back to date.
 * • Expense → reads `obligation_month:YYYY-MM` tag, falls back to date.
 */
export function getTransactionBudgetMonthKey(t: MinTransaction): string {
  return t.type === 'income' ? getBudgetMonthKey(t) : getExpenseBudgetMonthKey(t);
}

/**
 * Returns true when this is an income transaction that was physically received
 * in an earlier month than the month it is attributed to for budgeting.
 *
 * Example: salary received 2026-05-29 tagged `budget_month:2026-06` → true.
 */
export function isEarlyReceivedIncome(t: MinTransaction): boolean {
  if (t.type !== 'income') return false;
  const tagged = extractBudgetMonthTag(t.tags ?? []);
  if (!tagged) return false;
  return tagged > t.date.slice(0, 7);
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

/**
 * Returns the total income attributed to a given `YYYY-MM` budget month.
 * Uses `budget_month` tags for attribution (not transaction date).
 */
export function getMonthBudgetIncome(
  transactions: MinTransaction[],
  monthKey: string,
): number {
  return transactions
    .filter(t => t.type === 'income' && getBudgetMonthKey(t) === monthKey)
    .reduce((s, t: any) => s + Number(t.amount), 0);
}

/**
 * Returns the total of all income transactions that are physically received
 * (any date) but attributed to a future budget month.
 *
 * This is the amount that appears in "cash balance" but is earmarked for a
 * future month, so spending it now will affect that month's budget.
 */
export function getFutureMonthReservedIncome(
  transactions: MinTransaction[],
  currentMonthKey: string,
): number {
  return transactions
    .filter(t => isEarlyReceivedIncome(t) && getBudgetMonthKey(t) > currentMonthKey)
    .reduce((s, t: any) => s + Number(t.amount), 0);
}

// ─── Split-expense budget contributions ──────────────────────────────────────

/**
 * Returns the budget-month contribution breakdown for a single expense transaction.
 *
 * REGULAR expense  →  `{ [primaryMonthKey]: fullAmount }`
 *
 * OVER-BUDGET confirmed expense (has a `budget_split:YYYY-MM:amount` tag):
 *   `{ [primaryMonthKey]: fullAmount − splitAmount,
 *      [splitMonthKey]:   splitAmount }`
 *
 * Use this everywhere you need to know which portion of an expense belongs to
 * which budget month — it replaces direct `getExpenseBudgetMonthKey` comparisons
 * so that split transactions never make any single month show negative.
 *
 * Non-expense transactions return `{}` (use getBudgetMonthKey for income).
 */
export function getExpenseBudgetContributions(
  t: { type: string; date: string; tags: string[]; amount: number },
): Record<string, number> {
  if (t.type !== 'expense') return {};

  const primaryKey = getExpenseBudgetMonthKey(t);

  const splitTag = (t.tags ?? []).find(tag => tag.startsWith(BUDGET_SPLIT_TAG_PREFIX));
  if (splitTag) {
    const parsed = parseBudgetSplitTag(splitTag);
    if (parsed && parsed.amount > 0) {
      if (parsed.amount >= t.amount) {
        // Entire expense charged to the future month (current-month budget was RM0).
        // Primary month contributes nothing — keeps it at RM0, never negative.
        return { [parsed.monthKey]: t.amount };
      }
      // Partial overflow: current month gets what was left, future month gets the rest.
      const primaryAmount = Math.round((t.amount - parsed.amount) * 100) / 100;
      return {
        [primaryKey]:      primaryAmount,
        [parsed.monthKey]: parsed.amount,
      };
    }
  }

  return { [primaryKey]: t.amount };
}
