import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
  Modal, Dimensions, I18nManager,
} from 'react-native';
import {
  X, Check, CheckCircle2, AlertTriangle, AlertCircle, Calendar,
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Trash2, Banknote, CreditCard, Landmark, Gift,
  ArrowRightLeft, Smartphone, MoreHorizontal,
  Briefcase, Zap, Building2, Package, TrendingUp, HelpCircle, RotateCcw,
  Home, Car, Heart, ShoppingBag, Film, BookOpen, Utensils,
  Search, Plus, Pencil, Palette, DollarSign, Wallet, Coffee,
  Music, Plane, Shirt, Baby, Stethoscope, Laptop,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  format, subDays, addDays, isAfter, startOfDay,
  addMonths, subMonths, getDaysInMonth, getDay,
} from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { TransactionType, Category, CategoryType } from '../../src/types';
import { formatCurrency }      from '../../src/utils/currency';
import { Button }              from '../../src/components/ui/Button';
import { Input }               from '../../src/components/ui/Input';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { parseCurrencyInput }  from '../../src/utils/currency';
import { getExpenseCategories, getIncomeCategories, PAYMENT_METHODS } from '../../src/utils/categories';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { makeBudgetMonthTag, makeBudgetSplitTag, getBudgetMonthKey, getExpenseBudgetContributions } from '../../src/utils/budgetMonth';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const today = startOfDay(new Date());

type Screen = 'main' | 'category' | 'deduct';

const PAYMENT_ICONS: Record<string, LucideIcon> = {
  Banknote, CreditCard, ArrowRightLeft, Smartphone, MoreHorizontal,
};

// All Lucide icons available for category assignment
const ICON_REGISTRY: Record<string, LucideIcon> = {
  Utensils, Car, Heart, ShoppingBag, Film, BookOpen, Home, Zap,
  Briefcase, Building2, TrendingUp, RotateCcw, Gift, Banknote, Wallet,
  Package, DollarSign, Coffee, Music, Plane, Shirt, Baby, Stethoscope,
  Laptop, Smartphone, Landmark, HelpCircle,
};

// Icon names shown in the creator grid (ordered nicely)
const CREATOR_ICONS = [
  'Utensils', 'Car', 'Home', 'Heart', 'ShoppingBag', 'Film',
  'BookOpen', 'Zap', 'Briefcase', 'Building2', 'TrendingUp', 'RotateCcw',
  'Gift', 'Banknote', 'Wallet', 'DollarSign', 'Coffee', 'Music',
  'Plane', 'Shirt', 'Baby', 'Stethoscope', 'Laptop', 'Package',
];

const CREATOR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#6B7280', '#0EA5E9',
];

// Maps category name patterns → Lucide icon component
const CAT_ICON_RULES: { test: RegExp; icon: string }[] = [
  { test: /food|dining|restaurant|grocer|meal|cafe|coffee|eat/i, icon: 'Utensils'  },
  { test: /transport|car|fuel|petrol|grab|commute|bus|train/i,   icon: 'Car'       },
  { test: /health|medical|pharma|gym|fitness|doctor|clinic/i,    icon: 'Heart'     },
  { test: /bill|utilit|electr|water|internet|phone|telco/i,      icon: 'Zap'       },
  { test: /shop|cloth|fashion|retail|apparel/i,                  icon: 'ShoppingBag'},
  { test: /entertain|movie|game|hobbie|subscri|stream/i,         icon: 'Film'      },
  { test: /edu|book|course|learn|school|tuition/i,               icon: 'BookOpen'  },
  { test: /hous|rent|home|apart/i,                               icon: 'Home'      },
  { test: /salary|wage|employ/i,                                  icon: 'Briefcase' },
  { test: /side.hustle|gig|part.time/i,                          icon: 'Zap'       },
  { test: /freelan|project/i,                                     icon: 'Landmark'  },
  { test: /business|revenue/i,                                    icon: 'Building2' },
  { test: /invest|return|dividend/i,                              icon: 'TrendingUp'},
  { test: /refund/i,                                              icon: 'RotateCcw' },
  { test: /gift/i,                                                icon: 'Gift'      },
  { test: /loan|borrow/i,                                         icon: 'Banknote'  },
  { test: /sav|goal/i,                                            icon: 'Wallet'    },
  { test: /coffee|cafe/i,                                         icon: 'Coffee'    },
  { test: /travel|trip|flight|plane/i,                            icon: 'Plane'     },
  { test: /cloth|wear|shirt|fashion/i,                            icon: 'Shirt'     },
];

/** Resolve a stored icon name OR category name → icon component */
function resolveCatIcon(cat: Category): LucideIcon {
  // If the stored icon is a known Lucide name, use it directly
  if (cat.icon && ICON_REGISTRY[cat.icon]) return ICON_REGISTRY[cat.icon];
  // Otherwise match by name
  for (const rule of CAT_ICON_RULES) {
    if (rule.test.test(cat.name)) {
      const ic = ICON_REGISTRY[rule.icon];
      if (ic) return ic;
    }
  }
  return cat.type === 'income' ? DollarSign : Package;
}

// ── Semantic category slot (for deduplication) ──────────────────────────────
// Maps a category name to a canonical slot so semantically-equivalent categories
// (e.g. "Food" vs "Food & Dining", "Bills" vs "Utilities") are treated as the
// same slot and only the personal/user version is shown.
function catSlot(name: string): string {
  const l = name.toLowerCase();
  if (/food|dine|dini|rest|grocer|meal|cafe|coff|eat/.test(l))  return 'food';
  if (/transport|car|fuel|petrol|grab|commute|bus|train/.test(l)) return 'transport';
  if (/health|medical|pharma|gym|fitne|doctor|clinic|care/.test(l)) return 'health';
  if (/bill|util|electr|water|internet|phone|telco/.test(l))     return 'bills';
  if (/shop|cloth|fashion|retail|apparel/.test(l))               return 'shopping';
  if (/entertain|movie|game|hobbi|subscri|stream/.test(l))       return 'entertainment';
  if (/edu|book|course|learn|school|tuition/.test(l))            return 'education';
  if (/hous|rent|home|apart/.test(l))                            return 'housing';
  if (/salary|wage|employ/.test(l))                              return 'salary';
  if (/invest|return|dividend/.test(l))                          return 'investment';
  if (/refund/.test(l))                                          return 'refund';
  if (/gift/.test(l))                                            return 'gift';
  if (/loan|borrow/.test(l))                                     return 'loan';
  if (/freelan|project/.test(l))                                 return 'freelance';
  if (/business|revenue/.test(l))                                return 'business';
  if (/sav|goal/.test(l))                                        return 'savings';
  if (/other|misc|general/.test(l))                              return `other:${name.toLowerCase()}`; // keep distinct
  return name.toLowerCase().replace(/\s+/g, '_');
}

// ── Obligation payment scanner ────────────────────────────────────────────────
// Returns the Set of recurring item IDs that have already had an obligation
// expense recorded for the given month key (format: 'YYYY-MM').
function getPaidObligationIds(transactions: import('../../src/types').Transaction[], monthKey: string): Set<string> {
  const paid = new Set<string>();
  for (const t of transactions) {
    if (!t.is_recurring || t.type !== 'expense') continue;
    if (!t.tags.includes(`obligation_month:${monthKey}`)) continue;
    for (const tag of t.tags) {
      if (tag.startsWith('obligation:') && !tag.startsWith('obligation_month:')) {
        paid.add(tag.replace('obligation:', ''));
      }
    }
  }
  return paid;
}

function isFutureDay(d: Date) { return isAfter(startOfDay(d), today); }

function friendlyDate(d: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === -2) return '2 days ago';
  return format(d, 'MMM d, yyyy');
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AddTransactionModal() {
  const C  = useTheme();
  const { t: tFn } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, profile } = useAuthStore();
  const {
    categories, transactions,
    addTransaction, editTransaction, removeTransaction,
    addCategory, editCategory, removeCategory,
    syncFromServer, isSyncing,
  } = useTransactionStore();
  const { items: recurringItems, load: loadRecurring, toggleDeduct } = useRecurringStore();

  const existing  = id ? transactions.find(t => t.id === id) : null;
  const isEditing = !!existing;

  // ── Core state ───────────────────────────────────────────────────────────────
  const [screen,        setScreen]        = useState<Screen>('main');
  const [type,          setType]          = useState<TransactionType>(existing?.type ?? 'expense');
  const [amountStr,     setAmountStr]     = useState(existing ? String(existing.amount) : '');
  const [categoryId,    setCategoryId]    = useState<string>(existing?.category_id ?? '');
  const [note,          setNote]          = useState(existing?.note ?? '');
  const [date,          setDate]          = useState<Date>(
    existing ? startOfDay(new Date(existing.date)) : today
  );
  const [paymentMethod, setPaymentMethod] = useState<string | null>(
    existing?.payment_method ?? null
  );
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [isDismissing,  setIsDismissing]  = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState(false);

  // ── Overdraft sheet state ────────────────────────────────────────────────────
  const [showOverdraftSheet,      setShowOverdraftSheet]      = useState(false);
  // Future-month warning: expense would draw from next-month's earmarked income
  const [showFutureMonthWarning,  setShowFutureMonthWarning]  = useState(false);
  // Once the user taps "Continue anyway", skip re-showing the warning until amount changes
  const [futureMoneyConfirmed,    setFutureMoneyConfirmed]    = useState(false);
  // budget_split tags computed when user confirms over-budget spend; threaded into doSave
  const [confirmedSplitTags,      setConfirmedSplitTags]      = useState<string[]>([]);

  // ── Date picker sheet state ──────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Month attribution modal (always shown for income before saving) ──────────
  const [showMonthSheet, setShowMonthSheet] = useState(false);

  // ── Obligation deduct-step state ──────────────────────────────────────────────
  // The date string of the income that just triggered the deduct step.
  // Used to determine which month to check for already-paid obligations.
  const [savedIncomeDate,     setSavedIncomeDate]     = useState<string | null>(null);
  // The budget month key (YYYY-MM) the income was assigned to (may differ from receipt date month).
  const [savedBudgetMonthKey, setSavedBudgetMonthKey] = useState<string | null>(null);
  // Local checkbox map: itemId → checked (true = will be deducted)
  const [localChecked,     setLocalChecked]     = useState<Record<string, boolean>>({});
  // Whether to show the "pre-pay next month" offer after current month is settled
  const [showPrePay,       setShowPrePay]       = useState(false);
  // Balance error shown in the deduct step
  const [deductError,      setDeductError]      = useState('');

  // ── Category creator/editor sheet ────────────────────────────────────────────
  const [showCreator,    setShowCreator]    = useState(false);
  const [editingCat,     setEditingCat]     = useState<Category | null>(null);
  const [catSearch,      setCatSearch]      = useState('');
  const [creatorName,    setCreatorName]    = useState('');
  const [creatorIcon,    setCreatorIcon]    = useState('Package');
  const [creatorColor,   setCreatorColor]   = useState('#6366F1');
  const [creatorSaving,  setCreatorSaving]  = useState(false);
  const [creatorDeleting, setCreatorDeleting] = useState(false);

  const slideAnim = useRef(
    new Animated.Value(existing?.type === 'income' ? 1 : 0)
  ).current;

  useEffect(() => { loadRecurring(); }, []);
  useEffect(() => {
    if (user && categories.length === 0) syncFromServer(user.id);
  }, [user?.id]);

  // Reset future-month confirmation and any stored split tags whenever the
  // amount or type changes — a different amount may have a different overflow.
  useEffect(() => {
    setFutureMoneyConfirmed(false);
    setConfirmedSplitTags([]);
  }, [amountStr, type]);

  // ── Filtered + semantically-deduplicated categories ──────────────────────────
  // The DB returns both global (user_id=null) and personal (user_id=userId) cats.
  // We sort personal-first then deduplicate by catSlot() so semantically equivalent
  // pairs (e.g. "Food" vs "Food & Dining", "Bills" vs "Utilities") only appear once.
  const availableCategories = useMemo(() => {
    const raw = type === 'expense'
      ? getExpenseCategories(categories)
      : getIncomeCategories(categories);
    // personal (user_id set) before global (user_id null)
    const sorted = [...raw].sort((a, b) =>
      (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1)
    );
    const seenSlots = new Set<string>();
    return sorted.filter(c => {
      const slot = catSlot(c.name);
      if (seenSlots.has(slot)) return false;
      seenSlots.add(slot);
      return true;
    });
  }, [type, categories]);

  // Auto-select first category when type or list changes (only if nothing selected)
  useEffect(() => {
    if (availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, availableCategories.length]);

  const selectedCat = categories.find(c => c.id === categoryId);

  // ── Balance calculations ──────────────────────────────────────────────────────
  const typedAmount = parseCurrencyInput(amountStr);

  // 1. All-time cash balance — what the user physically has right now.
  //    Includes early-received future-month salary so it's spendable today.
  const cashBalance = useMemo(() => {
    let bal = 0;
    for (const t of transactions) {
      if (t.type === 'income')  bal += t.amount;
      else                      bal -= t.amount;
    }
    return bal;
  }, [transactions]);

  // 2. Budget-month available for the selected expense date.
  //    BOTH income and expenses use their budget-month attribution:
  //    • Income  → budget_month tag (or date)
  //    • Expense → obligation_month tag (or date)
  //    This ensures pre-paid June obligations don't reduce May's available budget.
  const monthBudgetAvailable = useMemo(() => {
    const expenseMonthKey = format(date, 'yyyy-MM');
    let income = 0, spent = 0;
    for (const t of transactions) {
      // Skip the transaction being edited so we don't double-count
      if (isEditing && existing && t.id === existing.id) continue;
      if (t.type === 'income' && getBudgetMonthKey(t) === expenseMonthKey) {
        income += t.amount;
      } else if (t.type === 'expense') {
        // Use contributions so budget_split tags correctly apportion existing
        // over-budget expenses — avoids showing false negative remaining budget.
        spent += getExpenseBudgetContributions(t)[expenseMonthKey] ?? 0;
      }
    }
    return income - spent;
  }, [date, transactions, isEditing, existing]);

  // 2b. NET budget for all months STRICTLY AFTER the expense date's month.
  //     = future-month income  −  future-month pre-paid expenses (obligations)
  //     Example: expense is in May, June salary = RM3810, June obligations = RM1900
  //     → futureBudgetMonthNet = RM1910 (what's actually left for future months)
  //
  //     Used to detect whether the expense would tap future-month money, AND to
  //     display the "Future assigned" figure in the warning modal.
  const futureBudgetMonthIncome = useMemo(() => {
    const expenseMonthKey = format(date, 'yyyy-MM');
    let net = 0;
    for (const t of transactions) {
      if (t.type === 'income') {
        const key = getBudgetMonthKey(t);
        if (key > expenseMonthKey) net += t.amount;
      } else if (t.type === 'expense') {
        // Each contribution key may be in a future month (split overflow or pre-paid obligation).
        for (const [key, amount] of Object.entries(getExpenseBudgetContributions(t))) {
          if (key > expenseMonthKey) net -= amount;
        }
      }
    }
    return Math.max(net, 0);  // clamp at 0 (negative net means obligations exceed income)
  }, [date, transactions]);

  // 3. Three-case logic (only applies when adding a new expense).
  //    Amounts are rounded to 2 decimal places to avoid floating-point edge cases
  //    where e.g. 1910.000001 > 1910 would falsely trigger an overdraft.
  //
  //    Case 1 — cashBalance < amount          → block (wouldOverdraft)
  //    Case 2 — monthBudgetAvailable >= amount → allow normally (no warning)
  //    Case 3 — monthBudgetAvailable < amount
  //             AND cashBalance >= amount      → warn: spending future-month money
  const roundCents = (n: number) => Math.round(n * 100) / 100;
  const available        = Math.max(roundCents(cashBalance), 0);
  const wouldOverdraft   = !isEditing && type === 'expense' && typedAmount > 0
    && roundCents(typedAmount) > available;
  const overdraftBy      = wouldOverdraft ? typedAmount - available : 0;
  // How much of this expense spills over the current-month budget into a future month.
  // Only meaningful when usesFutureMonthMoney is true.
  const budgetRemaining  = Math.max(roundCents(monthBudgetAvailable), 0);
  const overBudgetAmount = roundCents(Math.max(typedAmount - budgetRemaining, 0));
  // Show warning only once per amount — cleared by futureMoneyConfirmed after user taps "Continue".
  // Also requires futureBudgetMonthIncome > 0: the deficit must actually tap FUTURE-month income,
  // not just past-month leftover.  Example: spending RM200 in June when May has RM100 surplus
  // and June has RM1,910 → futureBudgetMonthIncome for a June expense = July+ income = 0
  // → no warning (the surplus comes from past savings, not a future budget).
  const usesFutureMonthMoney = !isEditing && type === 'expense' && typedAmount > 0
    && !wouldOverdraft
    && !futureMoneyConfirmed
    && roundCents(typedAmount) > Math.max(roundCents(monthBudgetAvailable), 0)
    && futureBudgetMonthIncome > 0;   // only warn when future-month income is actually at risk

  const currency       = profile?.currency ?? 'MYR';
  const currencySymbol = currency === 'MYR' ? 'RM' : currency;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const switchType = (t: TransactionType) => {
    hapticSelect();
    setType(t);
    setCategoryId('');
    Animated.spring(slideAnim, {
      toValue: t === 'expense' ? 0 : 1,
      useNativeDriver: false, tension: 80, friction: 12,
    }).start();
  };

  const openCategoryPicker = () => {
    setError('');
    setCatSearch('');
    setScreen('category');
  };

  // ── doSave ────────────────────────────────────────────────────────────────────
  const doSave = useCallback(async (opts?: {
    catId?:          string;
    extraTags?:      string[];
    budgetMonthKey?: string;   // YYYY-MM — which month the income is assigned to
    incomeSource?:   { label: string; tags: string[] };
  }) => {
    if (!user) return;
    setIsSaving(true);
    setError('');
    const amount     = parseCurrencyInput(amountStr);
    const finalCatId = opts?.catId ?? categoryId;
    const dateStr    = format(date, 'yyyy-MM-dd');  // always the real receipt date
    try {
      if (opts?.incomeSource) {
        const incomeCat = categories.find(c => c.type === 'income' || c.type === 'both') ?? categories[0];
        await addTransaction(user.id, {
          type: 'income', amount, date: dateStr,
          category_id: incomeCat?.id ?? null,
          note: opts.incomeSource.label,
          payment_method: null,
          tags: opts.incomeSource.tags,
          is_recurring: false, group_id: null, user_id: user.id,
        });
      }
      if (isEditing && existing) {
        await editTransaction(existing.id, {
          type, amount, date: dateStr,
          category_id: finalCatId,
          note: note.trim() || null,
          payment_method: (paymentMethod as any) ?? null,
        });
      } else {
        await addTransaction(user.id, {
          type, amount, date: dateStr,
          category_id: finalCatId,
          note: note.trim() || null,
          payment_method: (paymentMethod as any) ?? null,
          tags: [...(opts?.extraTags ?? [])],
          is_recurring: false, group_id: null, user_id: user.id,
        });
      }
      hapticSuccess();
      setSuccess(true);
      setShowOverdraftSheet(false);
      setScreen('main');
      if (!isEditing && type === 'income' && recurringItems.length > 0) {
        // Record the receipt date and budget month so the deduct step knows
        // which obligations have already been paid for the assigned month.
        setSavedIncomeDate(dateStr);
        setSavedBudgetMonthKey(opts?.budgetMonthKey ?? dateStr.slice(0, 7));
        // Initialise local checkbox state from persistent preferences
        const initChecked: Record<string, boolean> = {};
        recurringItems.forEach(it => { initChecked[it.id] = it.deductFromIncome; });
        setLocalChecked(initChecked);
        setShowPrePay(false);
        setDeductError('');
        setTimeout(() => setScreen('deduct'), 400);
      } else {
        setTimeout(() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }, 600);
      }
    } catch (err: any) {
      setError(err.message ?? 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user, amountStr, categoryId, date, note, paymentMethod, type, isEditing, existing, categories, recurringItems]);

  // ── handleSave (from main form) ───────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) { setError('Please enter an amount greater than 0.'); return; }
    if (!user)       { setError('You must be logged in.'); return; }

    if (type === 'expense') {
      // Case 1: not enough actual cash → overdraft source sheet
      if (wouldOverdraft)          { setShowOverdraftSheet(true);     return; }
      // Case 3: cash is available but draws on future-month earmarked income → warn first
      if (usesFutureMonthMoney)    { setShowFutureMonthWarning(true); return; }
      // Case 2: normal spend (or confirmed over-budget spend — split tags already stored)
      if (!categoryId) { openCategoryPicker(); return; }
      await doSave({ extraTags: confirmedSplitTags.length > 0 ? confirmedSplitTags : undefined });
      return;
    }

    // Income — always ask which month before saving (skip in edit mode)
    if (!isEditing) {
      if (!categoryId) { openCategoryPicker(); return; }
      setShowMonthSheet(true);
      return;
    }
    await doSave();
  };

  // ── handleCategorySelect (from category picker) ───────────────────────────────
  // Always returns to main form — month attribution happens at save time, not here
  const handleCategorySelect = (catId: string) => {
    hapticSelect();
    setCategoryId(catId);
    setScreen('main');  // always go back to main so user can fill note/date/etc.
  };

  // ── handleMonthChoice (from month attribution sheet) ─────────────────────────
  // The actual transaction date is ALWAYS the real receipt date (today / user-selected date).
  // We only add a `budget_month:YYYY-MM` tag when the income should count toward a
  // different month than the receipt date. No overrideDate is used any more.
  const handleMonthChoice = (forNextMonth: boolean, customMonthKey?: string) => {
    setShowMonthSheet(false);

    const receiptMonthKey = format(date, 'yyyy-MM');

    let budgetMonthKey: string;
    if (customMonthKey) {
      budgetMonthKey = customMonthKey;
    } else if (forNextMonth) {
      const m = today.getMonth() + 1;       // 1-based
      const y = today.getFullYear();
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      budgetMonthKey = `${nextY}-${String(nextM).padStart(2, '0')}`;
    } else {
      budgetMonthKey = receiptMonthKey;     // current month — no tag needed
    }

    // Only add the tag when it differs from the receipt date month
    const extraTags: string[] = budgetMonthKey !== receiptMonthKey
      ? [makeBudgetMonthTag(budgetMonthKey)]
      : [];

    doSave({ extraTags: extraTags.length > 0 ? extraTags : undefined, budgetMonthKey });
  };

  // ── createObligationExpenses ──────────────────────────────────────────────────
  // Core helper: creates real expense transactions for a list of recurring items,
  // tagged so we can detect them later and avoid double-deduction.
  const createObligationExpenses = async (
    itemIds: string[],
    monthKey: string,         // 'YYYY-MM'
    dateStr:  string,         // 'YYYY-MM-DD' to stamp on the transaction
  ): Promise<boolean> => {
    if (!user || itemIds.length === 0) return true;
    const expenseCats = getExpenseCategories(categories);
    const billCat = expenseCats.find(c => /bill|util|hous|fixed|rent|sub/i.test(c.name)) ?? expenseCats[0];
    const items = recurringItems.filter(i => itemIds.includes(i.id));
    for (const item of items) {
      await addTransaction(user.id, {
        type: 'expense', amount: item.amount, date: dateStr,
        category_id: billCat?.id ?? null,
        note: `${item.name} (fixed obligation)`,
        payment_method: null,
        // ── CRITICAL TAGS ──────────────────────────────────────────────
        // obligation:<itemId>       → lets us detect which items are paid
        // obligation_month:<YYYY-MM> → lets us detect which month is paid
        tags: ['recurring', 'fixed', item.category,
               `obligation:${item.id}`, `obligation_month:${monthKey}`],
        is_recurring: true, group_id: null, user_id: user.id,
      });
    }
    return true;
  };

  // ── handleDeductConfirm ──────────────────────────────────────────────────────
  // Called from the deduct step "Done" button. Records obligation expenses for
  // items the user has checked (that aren't already paid), validates balance, and
  // optionally offers pre-paying the next month.
  const handleDeductConfirm = async () => {
    if (!user || !savedIncomeDate) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
      return;
    }
    // Use the budget month (which month this income is *for*), not the physical receipt date month
    const monthKey     = savedBudgetMonthKey ?? savedIncomeDate.slice(0, 7); // 'YYYY-MM'
    const paidIds      = getPaidObligationIds(transactions, monthKey);
    // Items the user has checked AND that aren't already paid
    const toPay        = recurringItems.filter(i => localChecked[i.id] && !paidIds.has(i.id));
    const totalToPay   = toPay.reduce((s, i) => s + i.amount, 0);

    // ── Balance guard ──────────────────────────────────────────────────────────
    // All-time balance: income transactions - expense transactions (optimistic updates
    // already include the income we just saved).
    let currentBal = 0;
    for (const t of transactions) {
      if (t.type === 'income') currentBal += t.amount;
      else currentBal -= t.amount;
    }
    if (toPay.length > 0 && totalToPay > currentBal) {
      const canPayAmt = currentBal;
      setDeductError(
        `Insufficient balance. You have ${formatCurrency(Math.max(currentBal, 0), currency)} available ` +
        `but selected ${formatCurrency(totalToPay, currency)} in obligations. ` +
        `Uncheck some items or add more income first.`
      );
      return;
    }
    setDeductError('');

    if (toPay.length > 0 && user) {
      setIsDismissing(true);
      try {
        await createObligationExpenses(toPay.map(i => i.id), monthKey, savedIncomeDate);
      } catch (_) {/* swallow — income already saved */} finally {
        setIsDismissing(false);
      }
    }

    // ── Check if ALL obligations are now paid for this month ────────────────────
    // Re-scan transactions (optimistic updates already in store)
    const freshPaidIds = getPaidObligationIds(
      useTransactionStore.getState().transactions, monthKey
    );
    const activeItems = recurringItems.filter(i => i.deductFromIncome);
    const allPaidNow  = activeItems.length > 0 && activeItems.every(i => freshPaidIds.has(i.id));

    if (allPaidNow) {
      // Offer to pre-pay next month — but only if there's balance remaining
      let balAfter = 0;
      for (const t of useTransactionStore.getState().transactions) {
        if (t.type === 'income') balAfter += t.amount;
        else balAfter -= t.amount;
      }
      const nextMonthTotal = activeItems.reduce((s, i) => s + i.amount, 0);
      if (balAfter >= nextMonthTotal) {
        setShowPrePay(true);
        return; // Stay on screen to offer pre-pay
      }
    }

    // Navigate home
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // ── handlePrePayConfirm ───────────────────────────────────────────────────────
  const handlePrePayConfirm = async (confirm: boolean) => {
    if (confirm && user && savedIncomeDate) {
      const curMonthKey  = savedIncomeDate.slice(0, 7);
      const [y, m] = curMonthKey.split('-').map(Number);
      const nextM   = m === 12 ? 1 : m + 1;
      const nextY   = m === 12 ? y + 1 : y;
      const nextMonthKey = `${nextY}-${String(nextM).padStart(2, '0')}`;
      const nextDateStr  = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

      const alreadyNextPaid = getPaidObligationIds(transactions, nextMonthKey);
      const toPrePay = recurringItems.filter(i => i.deductFromIncome && !alreadyNextPaid.has(i.id));

      if (toPrePay.length > 0) {
        // Balance check for pre-pay
        let bal = 0;
        for (const t of useTransactionStore.getState().transactions) {
          if (t.type === 'income') bal += t.amount;
          else bal -= t.amount;
        }
        const total = toPrePay.reduce((s, i) => s + i.amount, 0);
        if (total <= bal) {
          setIsDismissing(true);
          try {
            await createObligationExpenses(toPrePay.map(i => i.id), nextMonthKey, nextDateStr);
          } catch (_) {/* swallow */} finally {
            setIsDismissing(false);
          }
        }
      }
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    try {
      await removeTransaction(existing.id);
      hapticSuccess();
      setShowDeleteConfirm(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Could not delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Category creator helpers ──────────────────────────────────────────────────
  const openCreator = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCreatorName(cat.name);
      setCreatorIcon(cat.icon && ICON_REGISTRY[cat.icon] ? cat.icon : 'Package');
      setCreatorColor(cat.color ?? '#6366F1');
    } else {
      setEditingCat(null);
      setCreatorName('');
      setCreatorIcon('Package');
      setCreatorColor('#6366F1');
    }
    setShowCreator(true);
  };

  const saveCreator = async () => {
    if (!user || !creatorName.trim()) return;
    setCreatorSaving(true);
    try {
      if (editingCat) {
        await editCategory(editingCat.id, {
          name: creatorName.trim(), icon: creatorIcon, color: creatorColor,
        });
      } else {
        await addCategory({
          user_id: user.id, name: creatorName.trim(), icon: creatorIcon,
          color: creatorColor, type: type as CategoryType,
          is_default: false, sort_order: 99,
        });
      }
      setShowCreator(false);
    } catch (e: any) {
      setError(e.message ?? 'Could not save category.');
    } finally {
      setCreatorSaving(false);
    }
  };

  const deleteCreator = async () => {
    if (!editingCat) return;
    setCreatorDeleting(true);
    try {
      await removeCategory(editingCat.id);
      setShowCreator(false);
    } catch (e: any) {
      setError(e.message ?? 'Could not delete category.');
    } finally {
      setCreatorDeleting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Screen: CATEGORY PICKER ───────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'category') {
    const lower    = catSearch.toLowerCase();
    const filtered = availableCategories.filter(c => c.name.toLowerCase().includes(lower));
    const systemCats = filtered.filter(c => !c.user_id || c.is_default);
    const customCats = filtered.filter(c => c.user_id && !c.is_default);

    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => setScreen('main')}
            style={[s.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <ChevronLeft size={16} color={C.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.textPrimary }]}>
            {type === 'income' ? tFn('addTransaction.income') : tFn('addTransaction.category')}
          </Text>
          <TouchableOpacity
            onPress={() => openCreator()}
            style={[s.closeBtn, { backgroundColor: C.primaryLight }]}
          >
            <Plus size={16} color={C.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
          <Search size={16} color={C.textTertiary} strokeWidth={2} />
          <TextInput
            value={catSearch}
            onChangeText={setCatSearch}
            placeholder={tFn('addTransaction.searchPlaceholder')}
            placeholderTextColor={C.textTertiary}
            style={[s.searchInput, { color: C.textPrimary }]}
            autoCorrect={false}
          />
          {catSearch.length > 0 && (
            <TouchableOpacity onPress={() => setCatSearch('')}>
              <X size={14} color={C.textTertiary} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.catPickerContent}>
          {/* System / default categories */}
          {systemCats.length > 0 && (
            <>
              <Text style={[s.catGroupLabel, { color: C.textTertiary }]}>
                {type === 'income' ? tFn('addTransaction.income') : tFn('addTransaction.category')}
              </Text>
              <View style={s.catGrid}>
                {systemCats.map(cat => (
                  <CategoryGridItem
                    key={cat.id}
                    cat={cat}
                    selected={categoryId === cat.id}
                    onPress={() => handleCategorySelect(cat.id)}
                    C={C}
                  />
                ))}
              </View>
            </>
          )}

          {/* Custom categories */}
          {customCats.length > 0 && (
            <>
              <Text style={[s.catGroupLabel, { color: C.textTertiary, marginTop: Spacing[4] }]}>
                {tFn('addTransaction.myCategories')}
              </Text>
              <View style={s.catGrid}>
                {customCats.map(cat => (
                  <CategoryGridItem
                    key={cat.id}
                    cat={cat}
                    selected={categoryId === cat.id}
                    onPress={() => handleCategorySelect(cat.id)}
                    onLongPress={() => openCreator(cat)}
                    C={C}
                  />
                ))}
              </View>
            </>
          )}

          {filtered.length === 0 && (
            <View style={s.emptySearch}>
              <Package size={32} color={C.textTertiary} strokeWidth={1.5} />
              <Text style={[s.emptySearchText, { color: C.textTertiary }]}>{tFn('addTransaction.noCategories')}</Text>
              <TouchableOpacity onPress={() => { setCatSearch(''); openCreator(); }} style={[s.emptySearchBtn, { backgroundColor: C.primaryLight }]}>
                <Plus size={14} color={C.primary} strokeWidth={2.5} />
                <Text style={[s.emptySearchBtnText, { color: C.primary }]}>Create "{catSearch}"</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Create new category */}
          <TouchableOpacity
            onPress={() => openCreator()}
            style={[s.createCatBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            activeOpacity={0.75}
          >
            <View style={[s.createCatIconBox, { backgroundColor: C.primaryLight }]}>
              <Plus size={18} color={C.primary} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.createCatLabel, { color: C.textPrimary }]}>{tFn('addTransaction.createCustomCat')}</Text>
              <Text style={[s.createCatSub,   { color: C.textTertiary }]}>{tFn('addTransaction.createCustomCatSub')}</Text>
            </View>
            <ChevronRight size={16} color={C.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <View style={{ height: Spacing[6] }} />
        </ScrollView>

        {/* Category Creator Sheet */}
        <CategoryCreatorSheet
          visible={showCreator}
          editing={editingCat}
          name={creatorName}
          icon={creatorIcon}
          color={creatorColor}
          saving={creatorSaving}
          deleting={creatorDeleting}
          onChangeName={setCreatorName}
          onChangeIcon={setCreatorIcon}
          onChangeColor={setCreatorColor}
          onSave={saveCreator}
          onDelete={editingCat ? deleteCreator : undefined}
          onClose={() => setShowCreator(false)}
          C={C}
        />
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Screen: DEDUCT FIXED EXPENSES ─────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'deduct') {
    // Use the budget month key (which month the income is *for*), not the receipt date month.
    // e.g. June salary received May 29 → budget month is June → obligations are June's bills.
    const monthKey     = savedBudgetMonthKey ?? savedIncomeDate?.slice(0, 7) ?? format(today, 'yyyy-MM');
    const monthLabel   = (() => {
      const [y, m] = monthKey.split('-').map(Number);
      return format(new Date(y, m - 1, 1), 'MMMM yyyy');
    })();
    const paidIds      = getPaidObligationIds(transactions, monthKey);
    const trackedItems = recurringItems.filter(i => i.deductFromIncome);
    const paidItems    = trackedItems.filter(i => paidIds.has(i.id));
    const unpaidItems  = trackedItems.filter(i => !paidIds.has(i.id));
    const allPaid      = trackedItems.length > 0 && unpaidItems.length === 0;

    // Current all-time balance (optimistic — income was already saved)
    let currentBal = 0;
    for (const t of transactions) {
      if (t.type === 'income') currentBal += t.amount;
      else currentBal -= t.amount;
    }

    const checkedTotal = unpaidItems
      .filter(i => localChecked[i.id] !== false) // default-checked unless explicitly unchecked
      .reduce((s, i) => s + i.amount, 0);
    const canAfford    = checkedTotal <= currentBal;

    // ── PRE-PAY OFFER ───────────────────────────────────────────────────────────
    if (showPrePay) {
      const [y, m] = monthKey.split('-').map(Number);
      const nextM   = m === 12 ? 1 : m + 1;
      const nextY   = m === 12 ? y + 1 : y;
      const nextMonthKey  = `${nextY}-${String(nextM).padStart(2, '0')}`;
      const nextMonthLabel = format(new Date(nextY, nextM - 1, 1), 'MMMM yyyy');
      const nextPaidIds    = getPaidObligationIds(transactions, nextMonthKey);
      const toPrePay       = trackedItems.filter(i => !nextPaidIds.has(i.id));
      const prePaidAlready = trackedItems.filter(i => nextPaidIds.has(i.id));
      const prePayTotal    = toPrePay.reduce((s, i) => s + i.amount, 0);

      let balNow = 0;
      for (const t of transactions) {
        if (t.type === 'income') balNow += t.amount;
        else balNow -= t.amount;
      }
      const canPrePay = prePayTotal <= balNow;

      return (
        <SafeAreaView style={[s.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
          <View style={[s.header, { borderBottomColor: C.border }]}>
            <View style={{ width: 36 }} />
            <Text style={[s.headerTitle, { color: C.textPrimary }]}>Pre-pay Next Month?</Text>
            <TouchableOpacity
              onPress={() => handlePrePayConfirm(false)}
              style={[s.closeBtn, { backgroundColor: C.surfaceRaised }]}
            >
              <X size={16} color={C.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.deductContent} showsVerticalScrollIndicator={false}>
            {/* All-paid banner */}
            <View style={[s.allPaidBanner, { backgroundColor: C.successLight }]}>
              <CheckCircle2 size={18} color={C.success} strokeWidth={2} />
              <Text style={[s.allPaidText, { color: C.success }]}>
                All {monthLabel} obligations are covered!
              </Text>
            </View>

            <Text style={[s.deductSubtitle, { color: C.textSecondary }]}>
              Would you like to pre-pay {nextMonthLabel} obligations now?
              You have {formatCurrency(Math.max(balNow, 0), currency)} available.
            </Text>

            {prePaidAlready.length > 0 && (
              <View style={s.paidSection}>
                <Text style={[s.paidSectionLabel, { color: C.textTertiary }]}>Already pre-paid</Text>
                {prePaidAlready.map(item => (
                  <View key={item.id} style={[s.paidRow, { backgroundColor: C.surfaceRaised }]}>
                    <CheckCircle2 size={16} color={C.success} strokeWidth={2} />
                    <Text style={[s.deductName, { color: C.textSecondary }]}>{item.name}</Text>
                    <Text style={[s.deductAmount, { color: C.textTertiary }]}>
                      {formatCurrency(item.amount, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {toPrePay.map(item => (
              <View key={item.id} style={[s.deductRow, { backgroundColor: C.surfaceRaised }]}>
                <View style={s.deductRowLeft}>
                  <Wallet size={18} color={C.textTertiary} strokeWidth={2} />
                  <View style={s.deductInfo}>
                    <Text style={[s.deductName, { color: C.textPrimary }]}>{item.name}</Text>
                    <Text style={[s.deductFreq, { color: C.textTertiary }]}>
                      {formatCurrency(item.amount, currency)} / {item.frequency}
                    </Text>
                  </View>
                </View>
                <Text style={[s.deductAmount, { color: C.textSecondary }]}>
                  {formatCurrency(item.amount, currency)}
                </Text>
              </View>
            ))}

            {!canPrePay && toPrePay.length > 0 && (
              <View style={[s.deductWarning, { backgroundColor: '#FEF3C7' }]}>
                <AlertTriangle size={16} color="#92400E" strokeWidth={2} />
                <Text style={[s.deductWarningText, { color: '#92400E' }]}>
                  Insufficient balance for pre-payment. Need {formatCurrency(prePayTotal, currency)}, have {formatCurrency(Math.max(balNow, 0), currency)}.
                </Text>
              </View>
            )}

            <View style={[s.deductSummary, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.deductSummaryLabel, { color: C.textSecondary }]}>Pre-pay total</Text>
              <Text style={[s.deductSummaryValue, { color: C.textPrimary }]}>
                {formatCurrency(prePayTotal, currency)}
              </Text>
            </View>

            {canPrePay && toPrePay.length > 0 && (
              <Button
                label={isDismissing ? 'Pre-paying…' : `Pre-pay ${nextMonthLabel}`}
                onPress={() => handlePrePayConfirm(true)}
                loading={isDismissing}
                fullWidth size="lg"
                style={{ marginTop: Spacing[2] }}
              />
            )}
            <TouchableOpacity
              onPress={() => handlePrePayConfirm(false)}
              style={[s.skipBtn, { borderColor: C.border }]}
              activeOpacity={0.7}
            >
              <Text style={[s.skipBtnText, { color: C.textSecondary }]}>
                No thanks — go to home
              </Text>
            </TouchableOpacity>
            <View style={{ height: Spacing[6] }} />
          </ScrollView>
        </SafeAreaView>
      );
    }

    // ── STANDARD DEDUCT VIEW ────────────────────────────────────────────────────
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <View style={{ width: 36 }} />
          <Text style={[s.headerTitle, { color: C.textPrimary }]}>Fixed Obligations</Text>
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}
            style={[s.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <X size={16} color={C.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.deductContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.deductSubtitle, { color: C.textSecondary }]}>
            Record {monthLabel} obligations as expenses so your balance reflects real available funds.
          </Text>

          {/* Already-paid section */}
          {paidItems.length > 0 && (
            <View style={s.paidSection}>
              <Text style={[s.paidSectionLabel, { color: C.textTertiary }]}>
                Already covered — {monthLabel}
              </Text>
              {paidItems.map(item => (
                <View key={item.id} style={[s.paidRow, { backgroundColor: C.surfaceRaised }]}>
                  <CheckCircle2 size={16} color={C.success} strokeWidth={2} />
                  <View style={s.deductInfo}>
                    <Text style={[s.deductName, { color: C.textSecondary }]}>{item.name}</Text>
                    <Text style={[s.deductFreq, { color: C.textTertiary }]}>
                      {formatCurrency(item.amount, currency)} / {item.frequency}
                    </Text>
                  </View>
                  <Text style={[s.deductAmount, { color: C.success }]}>Paid ✓</Text>
                </View>
              ))}
            </View>
          )}

          {/* All paid — show summary */}
          {allPaid ? (
            <View style={[s.allPaidBanner, { backgroundColor: C.successLight }]}>
              <CheckCircle2 size={18} color={C.success} strokeWidth={2} />
              <Text style={[s.allPaidText, { color: C.success }]}>
                All {monthLabel} obligations already covered!
              </Text>
            </View>
          ) : (
            <>
              {unpaidItems.length > 0 && (
                <Text style={[s.paidSectionLabel, { color: C.textTertiary, marginTop: paidItems.length > 0 ? Spacing[4] : 0 }]}>
                  To record now
                </Text>
              )}
              {unpaidItems.map(item => {
                const checked = localChecked[item.id] !== false; // default true
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      hapticSelect();
                      setDeductError('');
                      setLocalChecked(prev => ({ ...prev, [item.id]: !checked }));
                    }}
                    style={[
                      s.deductRow,
                      { backgroundColor: C.surfaceRaised },
                      checked && { backgroundColor: C.primaryLight },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={s.deductRowLeft}>
                      <View style={[
                        s.checkbox,
                        { borderColor: checked ? C.primary : C.border },
                        checked && { backgroundColor: C.primary },
                      ]}>
                        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
                      </View>
                      <View style={s.deductInfo}>
                        <Text style={[s.deductName, { color: C.textPrimary }]}>{item.name}</Text>
                        <Text style={[s.deductFreq, { color: C.textTertiary }]}>
                          {formatCurrency(item.amount, currency)} / {item.frequency}
                        </Text>
                      </View>
                    </View>
                    <Text style={[s.deductAmount, { color: checked ? C.primary : C.textSecondary }]}>
                      {checked ? '− ' : ''}{formatCurrency(item.amount, currency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Balance warning */}
          {!canAfford && checkedTotal > 0 && (
            <View style={[s.deductWarning, { backgroundColor: '#FEF3C7' }]}>
              <AlertTriangle size={16} color="#92400E" strokeWidth={2} />
              <Text style={[s.deductWarningText, { color: '#92400E' }]}>
                Selected total ({formatCurrency(checkedTotal, currency)}) exceeds available balance ({formatCurrency(Math.max(currentBal, 0), currency)}). Uncheck some items.
              </Text>
            </View>
          )}
          {!!deductError && (
            <View style={[s.deductWarning, { backgroundColor: C.dangerLight }]}>
              <AlertTriangle size={16} color={C.danger} strokeWidth={2} />
              <Text style={[s.deductWarningText, { color: C.danger }]}>{deductError}</Text>
            </View>
          )}

          {/* Summary */}
          {!allPaid && (
            <View style={[s.deductSummary, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.deductSummaryLabel, { color: C.textSecondary }]}>Total to record</Text>
              <Text style={[s.deductSummaryValue, { color: canAfford ? C.danger : '#EF4444' }]}>
                − {formatCurrency(checkedTotal, currency)}
              </Text>
            </View>
          )}

          <Button
            label={isDismissing ? 'Recording…' : allPaid ? 'Continue' : 'Record Obligations'}
            onPress={handleDeductConfirm}
            loading={isDismissing}
            disabled={!allPaid && (!canAfford || checkedTotal === 0)}
            fullWidth size="lg"
            style={{ marginTop: Spacing[2] }}
          />
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}
            style={[s.skipBtn, { borderColor: C.border }]}
            activeOpacity={0.7}
          >
            <Text style={[s.skipBtnText, { color: C.textSecondary }]}>Skip — do this later</Text>
          </TouchableOpacity>
          <View style={{ height: Spacing[6] }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Screen: MAIN FORM ─────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            style={[s.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <X size={16} color={C.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? tFn('addTransaction.titleEdit') : tFn('addTransaction.titleAdd')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Status banners */}
          {success && (
            <View style={[s.successBox, { backgroundColor: C.successLight }]}>
              <CheckCircle2 size={16} color={C.success} strokeWidth={2} />
              <Text style={[s.successText, { color: C.success }]}>{isEditing ? tFn('addTransaction.update') : tFn('common.save')}</Text>
            </View>
          )}
          {!!error && (
            <View style={[s.errorBox, { backgroundColor: C.dangerLight }]}>
              <AlertTriangle size={16} color={C.danger} strokeWidth={2} />
              <Text style={[s.errorText, { color: C.danger }]}>{error}</Text>
            </View>
          )}

          {/* Type toggle */}
          <View style={[s.typeToggleTrack, { backgroundColor: C.surfaceRaised }]}>
            <Animated.View
              style={[
                s.typeToggleThumb,
                { backgroundColor: C.surface },
                { left: slideAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '52%'] }) },
              ]}
            />
            {(['expense', 'income'] as TransactionType[]).map((t, i) => (
              <TouchableOpacity key={t} onPress={() => switchType(t)} style={s.typeToggleBtn}>
                <View style={s.typeToggleInner}>
                  {t === 'expense'
                    ? <ArrowDown size={14} color={type === t ? C.textPrimary : C.textTertiary} strokeWidth={2.5} />
                    : <ArrowUp   size={14} color={type === t ? C.textPrimary : C.textTertiary} strokeWidth={2.5} />
                  }
                  <Text style={[s.typeToggleText, { color: type === t ? C.textPrimary : C.textTertiary }]}>
                    {t === 'expense' ? tFn('addTransaction.expense') : tFn('addTransaction.income')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <View style={s.amountBlock}>
            <Text style={[s.currencySymbol, { color: C.textSecondary }]}>{currencySymbol}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.textTertiary}
              style={[s.amountInput, { color: wouldOverdraft ? '#EF4444' : usesFutureMonthMoney ? '#F59E0B' : C.textPrimary }]}
              autoFocus={!isEditing}
              maxLength={12}
            />
          </View>

          {/* Overdraft warning (Case 1) */}
          {wouldOverdraft && (
            <TouchableOpacity
              onPress={() => setShowOverdraftSheet(true)}
              style={s.overdraftBanner}
              activeOpacity={0.8}
            >
              <AlertTriangle size={20} color="#92400E" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={s.overdraftBannerTitle}>Over your balance by {formatCurrency(overdraftBy, currency)}</Text>
                <Text style={s.overdraftBannerSub}>Tap to tell us where this money is coming from</Text>
              </View>
              <ChevronRight size={18} color="#92400E" strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Future-month money hint (Case 3) */}
          {!wouldOverdraft && usesFutureMonthMoney && (
            <TouchableOpacity
              onPress={() => setShowFutureMonthWarning(true)}
              style={[s.overdraftBanner, { backgroundColor: '#FEF3C720', borderColor: '#F59E0B30' }]}
              activeOpacity={0.8}
            >
              <AlertCircle size={20} color="#F59E0B" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[s.overdraftBannerTitle, { color: '#F59E0B' }]}>
                  {formatCurrency(overBudgetAmount, currency)} over your {format(date, 'MMMM')} budget
                </Text>
                <Text style={[s.overdraftBannerSub, { color: '#B45309' }]}>
                  {formatCurrency(budgetRemaining, currency)} left in {format(date, 'MMM')} · {formatCurrency(overBudgetAmount, currency)} from next month · tap to review
                </Text>
              </View>
              <ChevronRight size={18} color="#F59E0B" strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Category selector row */}
          <TouchableOpacity
            onPress={openCategoryPicker}
            style={[s.fieldRow, { backgroundColor: C.surfaceRaised }]}
            activeOpacity={0.75}
          >
            <View style={s.fieldRowLeft}>
              {selectedCat ? (
                <>
                  <View style={[s.fieldRowIcon, { backgroundColor: selectedCat.color + '25' }]}>
                    {(() => { const IC = resolveCatIcon(selectedCat); return <IC size={18} color={selectedCat.color} strokeWidth={2} />; })()}
                  </View>
                  <Text style={[s.fieldRowValue, { color: C.textPrimary }]}>{selectedCat.name}</Text>
                </>
              ) : (
                <>
                  <View style={[s.fieldRowIcon, { backgroundColor: C.border }]}>
                    <Package size={18} color={C.textTertiary} strokeWidth={2} />
                  </View>
                  <Text style={[s.fieldRowPlaceholder, { color: C.textTertiary }]}>{tFn('addTransaction.selectCategory')}</Text>
                </>
              )}
            </View>
            <ChevronRight size={16} color={C.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          {/* Date selector row */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[s.fieldRow, { backgroundColor: C.surfaceRaised }]}
            activeOpacity={0.75}
          >
            <View style={s.fieldRowLeft}>
              <View style={[s.fieldRowIcon, { backgroundColor: C.primaryLight }]}>
                <Calendar size={18} color={C.primary} strokeWidth={2} />
              </View>
              <View>
                <Text style={[s.fieldRowValue, { color: C.textPrimary }]}>{friendlyDate(date)}</Text>
                <Text style={[s.fieldRowSubValue, { color: C.textTertiary }]}>{format(date, 'EEEE, MMMM d yyyy')}</Text>
              </View>
            </View>
            <ChevronRight size={16} color={C.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          {/* Note */}
          <Input
            label={tFn('addTransaction.note')}
            value={note}
            onChangeText={setNote}
            placeholder={tFn('addTransaction.notePlaceholder')}
            maxLength={200}
          />

          {/* Advanced toggle */}
          <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} style={s.advancedToggle}>
            <View style={s.advancedToggleInner}>
              {showAdvanced
                ? <ChevronUp   size={14} color={C.primary} strokeWidth={2.5} />
                : <ChevronDown size={14} color={C.primary} strokeWidth={2.5} />
              }
              <Text style={[s.advancedToggleText, { color: C.primary }]}>
                {showAdvanced ? tFn('addTransaction.hideOptions') : tFn('addTransaction.moreOptions')}
              </Text>
            </View>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={s.advanced}>
              <Text style={[s.sectionLabel, { color: C.textPrimary }]}>{tFn('addTransaction.paymentMethod')}</Text>
              <View style={s.paymentRow}>
                {PAYMENT_METHODS.map(m => {
                  const PMIcon = PAYMENT_ICONS[m.icon];
                  const active = paymentMethod === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      onPress={() => setPaymentMethod(prev => prev === m.value ? null : m.value)}
                      style={[
                        s.paymentChip,
                        { backgroundColor: C.surfaceRaised, borderColor: 'transparent' },
                        active && { backgroundColor: C.primaryLight, borderColor: C.primary },
                      ]}
                    >
                      {PMIcon && <PMIcon size={15} color={active ? C.primary : C.textSecondary} strokeWidth={2} />}
                      <Text style={[s.paymentLabel, { color: active ? C.primary : C.textSecondary }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <Button
            label={isSaving ? tFn('finances.saving') : (isEditing ? tFn('addTransaction.update') : tFn('addTransaction.save'))}
            onPress={handleSave}
            loading={isSaving}
            fullWidth size="lg"
            style={s.saveBtn}
          />

          {isEditing && (
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              style={[s.deleteBtn, { borderColor: C.danger + '40' }]}
              activeOpacity={0.7}
            >
              <Text style={[s.deleteBtnText, { color: C.danger }]}>{tFn('addTransaction.delete')}</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: Spacing[6] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Date Picker Sheet ──────────────────────────────────────────────────── */}
      <DatePickerSheet
        visible={showDatePicker}
        value={date}
        onSelect={d => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        C={C}
      />

      {/* ── Month Attribution Sheet (income only) ─────────────────────────────── */}
      {(() => {
        const now      = new Date();
        const curMonth = format(now, 'MMMM yyyy');
        const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nxtMonth = format(nextDate, 'MMMM yyyy');
        return (
          <Modal visible={showMonthSheet} transparent animationType="slide" onRequestClose={() => setShowMonthSheet(false)}>
            <View style={s.sheetOverlay}>
              <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowMonthSheet(false)} />
              <View style={[s.sheetPanel, { backgroundColor: C.isDark ? '#1E293B' : '#FFFFFF' }]}>
                <View style={s.sheetHandle} />
                {/* Title */}
                <View style={{ paddingHorizontal: Spacing[5], paddingBottom: Spacing[1] }}>
                  <Text style={[s.headerTitle, { color: C.textPrimary, textAlign: 'center' }]}>{tFn('addTransaction.incomeForTitle')}</Text>
                  <Text style={[{ ...Typography.bodySmall, color: C.textSecondary, textAlign: 'center', marginTop: Spacing[2], lineHeight: 20 }]}>
                    {tFn('addTransaction.incomeForSub')}
                  </Text>
                </View>
                {/* Options */}
                <View style={{ padding: Spacing[5], gap: Spacing[3] }}>
                  {[
                    { forNext: false, title: tFn('addTransaction.thisMonth'),  sub: curMonth,                               bg: C.primaryLight,  iconColor: C.primary   },
                    { forNext: true,  title: tFn('addTransaction.nextMonth'),  sub: `${nxtMonth} — ${tFn('addTransaction.advancePay')}`, bg: '#FEF3C720', iconColor: '#92400E'   },
                  ].map(({ forNext, title, sub, bg, iconColor }) => (
                    <TouchableOpacity
                      key={String(forNext)}
                      onPress={() => handleMonthChoice(forNext)}
                      disabled={isSaving}
                      style={[s.monthBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                      activeOpacity={0.75}
                    >
                      <View style={[s.monthBtnIcon, { backgroundColor: bg }]}>
                        <Calendar size={22} color={iconColor} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.monthBtnTitle, { color: C.textPrimary }]}>{title}</Text>
                        <Text style={[s.monthBtnSub,   { color: C.textSecondary }]}>{sub}</Text>
                      </View>
                      {isSaving
                        ? <ActivityIndicator color={C.primary} size="small" />
                        : <ChevronRight size={18} color={C.textTertiary} strokeWidth={2} />
                      }
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ── Delete Confirm Sheet ───────────────────────────────────────────────── */}
      <Modal visible={showDeleteConfirm} transparent animationType="slide" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowDeleteConfirm(false)} />
          <View style={[s.sheetPanel, { backgroundColor: C.isDark ? '#2D3B50' : '#FFFFFF' }]}>
            <View style={s.sheetHandle} />
            <View style={{ padding: Spacing[5], gap: Spacing[4] }}>
              <View style={[s.deleteConfirmHeader, { backgroundColor: C.dangerLight }]}>
                <Trash2 size={26} color={C.danger} strokeWidth={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.deleteConfirmTitle, { color: C.danger }]}>{tFn('addTransaction.deleteConfirm')}</Text>
                  <Text style={[s.deleteConfirmSub, { color: C.textSecondary }]}>
                    {existing?.note
                      ? `"${existing.note}" · ${formatCurrency(existing?.amount ?? 0, currency)}`
                      : `${formatCurrency(existing?.amount ?? 0, currency)} — this cannot be undone`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleDelete} disabled={isDeleting} style={[s.deleteConfirmBtn, { backgroundColor: C.danger }]} activeOpacity={0.8}>
                <Text style={s.deleteConfirmBtnText}>{isDeleting ? tFn('addTransaction.deleting') : tFn('addTransaction.deleteConfirmBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={[s.deleteCancelBtn, { backgroundColor: C.surfaceRaised }]} activeOpacity={0.7}>
                <Text style={[s.deleteCancelBtnText, { color: C.textSecondary }]}>{tFn('addTransaction.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Future-Month Money Warning Sheet ──────────────────────────────────── */}
      {/* Case 3: user has the cash, but it's earmarked for a future budget month */}
      <Modal
        visible={showFutureMonthWarning}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFutureMonthWarning(false)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity
            style={s.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowFutureMonthWarning(false)}
          />
          <View style={[s.sheetPanel, { backgroundColor: C.isDark ? '#1E2D3D' : '#FFFFFF' }]}>
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={[s.futureWarnHeader, { backgroundColor: '#FEF3C720', borderColor: '#FCD34D30' }]}>
              <View style={[s.futureWarnIconBox, { backgroundColor: '#FEF3C740' }]}>
                <AlertCircle size={26} color="#F59E0B" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.futureWarnTitle, { color: '#F59E0B' }]}>
                  Over {format(date, 'MMMM')} budget
                </Text>
                <Text style={[s.futureWarnSub, { color: C.textSecondary }]}>
                  You have {formatCurrency(budgetRemaining, currency)} left in your {format(date, 'MMMM')} budget.
                  {' '}The extra {formatCurrency(overBudgetAmount, currency)} will come from money assigned to next month.
                </Text>
              </View>
            </View>

            {/* Stats row: month remaining | over by | this expense */}
            <View style={[s.futureWarnStats, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
              <View style={s.futureWarnStat}>
                <Text style={[s.futureWarnStatLabel, { color: C.textTertiary }]}>
                  {format(date, 'MMM')} {tFn('home.leftShort')}
                </Text>
                <Text style={[s.futureWarnStatVal, { color: C.success }]}>
                  {formatCurrency(budgetRemaining, currency)}
                </Text>
              </View>
              <View style={[s.futureWarnDivider, { backgroundColor: C.divider }]} />
              <View style={s.futureWarnStat}>
                <Text style={[s.futureWarnStatLabel, { color: C.textTertiary }]}>{tFn('addTransaction.overBy')}</Text>
                <Text style={[s.futureWarnStatVal, { color: '#F59E0B' }]}>
                  {formatCurrency(overBudgetAmount, currency)}
                </Text>
              </View>
              <View style={[s.futureWarnDivider, { backgroundColor: C.divider }]} />
              <View style={s.futureWarnStat}>
                <Text style={[s.futureWarnStatLabel, { color: C.textTertiary }]}>{tFn('addTransaction.thisExpense')}</Text>
                <Text style={[s.futureWarnStatVal, { color: C.textPrimary }]}>
                  {formatCurrency(typedAmount, currency)}
                </Text>
              </View>
            </View>

            <Text style={[s.futureWarnBody, { color: C.textSecondary }]}>
              {budgetRemaining > 0
                ? `Spending ${formatCurrency(typedAmount, currency)} will use ${formatCurrency(budgetRemaining, currency)} from your ${format(date, 'MMMM')} budget plus ${formatCurrency(overBudgetAmount, currency)} from a future month's budget. Your ${format(date, 'MMMM')} budget will reach RM0.`
                : `Your ${format(date, 'MMMM')} budget is already fully used. This entire ${formatCurrency(typedAmount, currency)} will be taken from your future month's budget.`}
            </Text>

            {/* Actions */}
            <View style={{ padding: Spacing[5], gap: Spacing[3] }}>
              <TouchableOpacity
                disabled={isSaving}
                onPress={async () => {
                  // Compute the budget_split tag: overflow → next calendar month
                  const expMonthKey = format(date, 'yyyy-MM');
                  const [ey, em]    = expMonthKey.split('-').map(Number);
                  const splitM      = em === 12 ? 1 : em + 1;
                  const splitY      = em === 12 ? ey + 1 : ey;
                  const splitMonthKey = `${splitY}-${String(splitM).padStart(2, '0')}`;
                  const splitTags   = overBudgetAmount > 0
                    ? [makeBudgetSplitTag(splitMonthKey, overBudgetAmount)]
                    : [];

                  // Store split tags & mark confirmed so warning won't re-fire
                  // after the user picks a category and taps Save.
                  setConfirmedSplitTags(splitTags);
                  setFutureMoneyConfirmed(true);
                  setShowFutureMonthWarning(false);

                  if (!categoryId) {
                    // User still needs to pick a category; handleSave will
                    // call doSave({ extraTags: confirmedSplitTags }) on return.
                    openCategoryPicker();
                    return;
                  }
                  await doSave({ extraTags: splitTags.length > 0 ? splitTags : undefined });
                }}
                style={[s.futureWarnConfirmBtn, { backgroundColor: '#F59E0B' }]}
                activeOpacity={0.8}
              >
                {isSaving
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={s.futureWarnConfirmText}>{tFn('addTransaction.continueAnyway')}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFutureMonthWarning(false)}
                style={[s.futureWarnCancelBtn, { backgroundColor: C.surfaceRaised }]}
                activeOpacity={0.7}
              >
                <Text style={[s.futureWarnCancelText, { color: C.textSecondary }]}>{tFn('addTransaction.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Overdraft Source Sheet ─────────────────────────────────────────────── */}
      <Modal visible={showOverdraftSheet} transparent animationType="slide" onRequestClose={() => setShowOverdraftSheet(false)}>
        <KeyboardAvoidingView style={s.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowOverdraftSheet(false)} />
          <View style={[s.sheetPanel, { backgroundColor: C.isDark ? '#2D3B50' : '#FFFFFF' }]}>
            <View style={s.sheetHandle} />
            <View style={[s.sheetWarningHeader, { backgroundColor: '#FEF3C7' }]}>
              <AlertTriangle size={22} color="#92400E" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[s.sheetWarningTitle, { color: '#92400E' }]}>
                  {formatCurrency(overdraftBy, currency)} over your balance
                </Text>
                <Text style={[s.sheetWarningBody, { color: '#B45309' }]}>
                  You have {formatCurrency(available, currency)} left. Where did this money come from?
                </Text>
              </View>
            </View>
            {([
              { Icon: Banknote,   iconColor: '#92400E', title: tFn('addTransaction.borrowedTitle'),    subtitle: tFn('addTransaction.borrowedSub'),    label: 'Borrowed money',      tags: ['borrowed', 'debt'] as string[] },
              { Icon: CreditCard, iconColor: '#1D4ED8', title: tFn('addTransaction.creditTitle'),     subtitle: tFn('addTransaction.creditSub'),     label: 'Credit / BNPL spend', tags: ['credit', 'debt']   as string[] },
              { Icon: Landmark,   iconColor: '#065F46', title: tFn('addTransaction.anotherAccTitle'), subtitle: tFn('addTransaction.anotherAccSub'), label: 'Transfer in',         tags: ['transfer']          as string[] },
              { Icon: Gift,       iconColor: '#7C3AED', title: tFn('addTransaction.giftTitle'),       subtitle: tFn('addTransaction.giftSub'),       label: 'Gift / money received',tags: ['gift']             as string[] },
            ]).map(src => (
              <TouchableOpacity
                key={src.title}
                disabled={isSaving}
                onPress={() => { hapticSelect(); doSave({ incomeSource: { label: src.label, tags: src.tags } }); }}
                style={[s.sheetOption, { borderBottomColor: C.divider }]}
                activeOpacity={0.7}
              >
                <View style={[s.sheetOptionIconBox, { backgroundColor: src.iconColor + '18' }]}>
                  <src.Icon size={20} color={src.iconColor} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sheetOptionTitle, { color: C.textPrimary }]}>{src.title}</Text>
                  <Text style={[s.sheetOptionSub,   { color: C.textTertiary }]}>{src.subtitle}</Text>
                </View>
                <ChevronRight size={18} color={C.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity disabled={isSaving} onPress={() => doSave()} style={s.sheetSkip} activeOpacity={0.7}>
              {isSaving
                ? <ActivityIndicator color={C.textTertiary} />
                : <Text style={[s.sheetSkipText, { color: C.textTertiary }]}>{tFn('addTransaction.justRecordIt')}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryGridItem({
  cat, selected, onPress, onLongPress, C,
}: {
  cat: Category; selected: boolean;
  onPress: () => void; onLongPress?: () => void; C: any;
}) {
  const Icon = resolveCatIcon(cat);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={[
        s.catGridItem,
        { backgroundColor: C.surfaceRaised },
        selected && { backgroundColor: cat.color + '18', borderColor: cat.color, borderWidth: 2 },
      ]}
    >
      <View style={[s.catGridIcon, { backgroundColor: selected ? cat.color + '25' : cat.color + '15' }]}>
        <Icon size={22} color={cat.color} strokeWidth={selected ? 2.2 : 1.8} />
      </View>
      <Text
        style={[s.catGridLabel, { color: selected ? cat.color : C.textPrimary }]}
        numberOfLines={2}
      >
        {cat.name}
      </Text>
      {selected && (
        <View style={[s.catGridCheck, { backgroundColor: cat.color }]}>
          <Check size={9} color="#fff" strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Calendar / Date picker sheet ──────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DatePickerSheet({
  visible, value, onSelect, onClose, C,
}: {
  visible: boolean; value: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  C: any;
}) {
  const [viewDate, setViewDate] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(value);

  useEffect(() => {
    if (visible) {
      setSelected(value);
      setViewDate(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }, [visible]);

  const goMonth = (dir: -1 | 1) => setViewDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));

  const cells = useMemo(() => {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = getDay(new Date(year, month, 1)); // 0=Sun
    const days  = getDaysInMonth(new Date(year, month, 1));
    const arr: (Date | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [viewDate]);

  const isSel  = (d: Date) => selected && format(d, 'yyyy-MM-dd') === format(selected, 'yyyy-MM-dd');
  const isToday = (d: Date) => format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  const isFuture = (d: Date) => isAfter(startOfDay(d), today);

  const PRESETS = [
    { label: 'Today',     d: today              },
    { label: 'Yesterday', d: subDays(today, 1)  },
    { label: 'Last week', d: subDays(today, 7)  },
    { label: '2 weeks',   d: subDays(today, 14) },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.dateSheetPanel, { backgroundColor: C.isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={s.sheetHandle} />

          {/* Month nav */}
          <View style={s.calHeader}>
            <TouchableOpacity onPress={() => goMonth(-1)} style={[s.calNavBtn, { backgroundColor: C.surfaceRaised }]}>
              <ChevronLeft size={18} color={C.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[s.calMonthLabel, { color: C.textPrimary }]}>
              {format(viewDate, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity onPress={() => goMonth(1)} style={[s.calNavBtn, { backgroundColor: C.surfaceRaised }]}>
              <ChevronRight size={18} color={C.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Quick presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.calPresets}>
            {PRESETS.map(p => {
              const active = format(p.d, 'yyyy-MM-dd') === format(selected, 'yyyy-MM-dd');
              return (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => { setSelected(p.d); setViewDate(new Date(p.d.getFullYear(), p.d.getMonth(), 1)); }}
                  style={[s.calPreset, { backgroundColor: C.surfaceRaised }, active && { backgroundColor: C.primary }]}
                >
                  <Text style={[s.calPresetText, { color: active ? '#fff' : C.textSecondary }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Weekday headers */}
          <View style={s.calWeekRow}>
            {WEEKDAYS.map(w => (
              <Text key={w} style={[s.calWeekDay, { color: C.textTertiary }]}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={s.calGrid}>
            {cells.map((cell, idx) => {
              if (!cell) return <View key={`e${idx}`} style={s.calCell} />;
              const sel    = isSel(cell);
              const tod    = isToday(cell);
              const future = isFuture(cell);
              return (
                <TouchableOpacity
                  key={format(cell, 'yyyy-MM-dd')}
                  onPress={() => !future && setSelected(cell)}
                  disabled={future}
                  style={[
                    s.calCell,
                    tod   && !sel && { borderWidth: 1.5, borderColor: C.primary, borderRadius: 99 },
                    sel   && { backgroundColor: C.primary, borderRadius: 99 },
                    future && { opacity: 0.25 },
                  ]}
                >
                  <Text style={[
                    s.calCellText,
                    { color: sel ? '#fff' : tod ? C.primary : C.textPrimary },
                    sel && { fontWeight: '700' },
                  ]}>
                    {cell.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm */}
          <View style={{ paddingHorizontal: Spacing[5], paddingBottom: Spacing[6], paddingTop: Spacing[2] }}>
            <TouchableOpacity
              onPress={() => onSelect(selected)}
              style={[s.calConfirmBtn, { backgroundColor: C.primary }]}
              activeOpacity={0.85}
            >
              <Text style={s.calConfirmText}>Set {format(selected, 'MMMM d, yyyy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Category Creator / Editor Sheet ──────────────────────────────────────────

function CategoryCreatorSheet({
  visible, editing, name, icon, color,
  saving, deleting,
  onChangeName, onChangeIcon, onChangeColor,
  onSave, onDelete, onClose, C,
}: {
  visible: boolean;
  editing: Category | null;
  name: string; icon: string; color: string;
  saving: boolean; deleting: boolean;
  onChangeName: (v: string) => void;
  onChangeIcon:  (v: string) => void;
  onChangeColor: (v: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  C: any;
}) {
  const preview = ICON_REGISTRY[icon] ?? Package;
  const PreviewIcon = preview;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.creatorPanel, { backgroundColor: C.isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={s.sheetHandle} />

          {/* Header */}
          <View style={[s.creatorHeader, { borderBottomColor: C.border }]}>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: C.surfaceRaised }]}>
              <X size={16} color={C.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: C.textPrimary }]}>
              {editing ? 'Edit Category' : 'New Category'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing[5], gap: Spacing[4] }}>
            {/* Preview */}
            <View style={s.creatorPreviewRow}>
              <View style={[s.creatorPreview, { backgroundColor: color + '25', borderColor: color }]}>
                <PreviewIcon size={28} color={color} strokeWidth={2} />
              </View>
              <Text style={[s.creatorPreviewName, { color: C.textPrimary }]}>
                {name || 'Category name'}
              </Text>
            </View>

            {/* Name input */}
            <View>
              <Text style={[s.creatorFieldLabel, { color: C.textSecondary }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={onChangeName}
                placeholder="e.g. Coffee & Snacks"
                placeholderTextColor={C.textTertiary}
                style={[s.creatorNameInput, { backgroundColor: C.surfaceRaised, color: C.textPrimary, borderColor: C.border }]}
                maxLength={30}
              />
            </View>

            {/* Color picker */}
            <View>
              <Text style={[s.creatorFieldLabel, { color: C.textSecondary }]}>Colour</Text>
              <View style={s.colorGrid}>
                {CREATOR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => onChangeColor(c)}
                    style={[s.colorSwatch, { backgroundColor: c }, color === c && s.colorSwatchSelected]}
                    activeOpacity={0.8}
                  >
                    {color === c && <Check size={12} color="#fff" strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Icon picker */}
            <View>
              <Text style={[s.creatorFieldLabel, { color: C.textSecondary }]}>Icon</Text>
              <View style={s.iconGrid}>
                {CREATOR_ICONS.map(ic => {
                  const Ic = ICON_REGISTRY[ic] ?? Package;
                  const active = icon === ic;
                  return (
                    <TouchableOpacity
                      key={ic}
                      onPress={() => onChangeIcon(ic)}
                      style={[s.iconSwatch, { backgroundColor: active ? color + '25' : C.surfaceRaised }, active && { borderColor: color, borderWidth: 2 }]}
                      activeOpacity={0.75}
                    >
                      <Ic size={20} color={active ? color : C.textSecondary} strokeWidth={active ? 2.2 : 1.8} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={onSave}
              disabled={saving || !name.trim()}
              style={[s.creatorSaveBtn, { backgroundColor: C.primary, opacity: (!name.trim() || saving) ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <Text style={s.creatorSaveBtnText}>{saving ? 'Saving…' : (editing ? 'Update Category' : 'Create Category')}</Text>
            </TouchableOpacity>

            {/* Delete */}
            {editing && onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                disabled={deleting}
                style={[s.creatorDeleteBtn, { borderColor: C.danger + '50' }]}
                activeOpacity={0.7}
              >
                {deleting
                  ? <ActivityIndicator color={C.danger} size="small" />
                  : <Text style={[s.creatorDeleteText, { color: C.danger }]}>Delete category</Text>
                }
              </TouchableOpacity>
            )}
            <View style={{ height: Spacing[4] }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const CAT_COLS = 3;
const CAT_ITEM_W = (SCREEN_W - Spacing[5] * 2 - Spacing[3] * (CAT_COLS - 1)) / CAT_COLS;

const s = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderBottomWidth: 1,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleMedium },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[4] },

  successBox:  { borderRadius: BorderRadius.lg, padding: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  successText: { ...Typography.bodySmall },
  errorBox:    { borderRadius: BorderRadius.lg, padding: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  errorText:   { ...Typography.bodySmall, flex: 1 },

  typeToggleTrack: {
    flexDirection: 'row', borderRadius: BorderRadius.xl, height: 46,
    position: 'relative', overflow: 'hidden',
  },
  typeToggleThumb: {
    position: 'absolute', top: '8%', width: '46%', height: '84%',
    borderRadius: BorderRadius.lg, ...Shadow.sm,
  },
  typeToggleBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  typeToggleInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeToggleText:  { ...Typography.labelLarge },

  amountBlock: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', paddingVertical: Spacing[2], gap: Spacing[2],
  },
  currencySymbol: { fontSize: 28, fontWeight: '600', marginBottom: 6 },
  amountInput:    { fontSize: 56, fontWeight: '700', letterSpacing: -2, minWidth: 120, textAlign: 'center' },

  overdraftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: '#FEF3C7', borderRadius: BorderRadius.xl,
    padding: Spacing[3.5],
  },
  overdraftBannerTitle: { ...Typography.labelLarge, color: '#92400E' },
  overdraftBannerSub:   { ...Typography.caption, color: '#B45309', marginTop: 2 },

  // Field rows (category + date)
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  fieldRowLeft:        { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  fieldRowIcon:        { width: 40, height: 40, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  fieldRowValue:       { ...Typography.labelLarge },
  fieldRowSubValue:    { ...Typography.caption, marginTop: 2 },
  fieldRowPlaceholder: { ...Typography.labelLarge },

  sectionLabel:  { ...Typography.labelLarge, marginBottom: Spacing[2.5] },
  advancedToggle:      { alignItems: 'center', paddingVertical: Spacing[1] },
  advancedToggleInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  advancedToggleText:  { ...Typography.bodySmall },
  advanced:            { gap: Spacing[3] },
  paymentRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full, borderWidth: 1.5,
  },
  paymentLabel: { ...Typography.labelSmall },
  saveBtn:      { marginTop: Spacing[2] },

  deleteBtn:     { marginTop: Spacing[1], paddingVertical: Spacing[3.5], borderRadius: BorderRadius.full, alignItems: 'center', borderWidth: 1.5 },
  deleteBtnText: { ...Typography.labelLarge, fontWeight: '700' },

  // Month attribution
  monthBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1,
  },
  monthBtnIcon:  { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  monthBtnTitle: { ...Typography.labelLarge, fontWeight: '700' },
  monthBtnSub:   { ...Typography.bodySmall, marginTop: 2 },

  // Category picker
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    margin: Spacing[4], borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderWidth: 1,
  },
  searchInput:     { flex: 1, ...Typography.bodyMedium, padding: 0 },
  catPickerContent:{ paddingHorizontal: Spacing[4], gap: Spacing[3], paddingBottom: Spacing[8] },
  catGroupLabel:   { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -Spacing[1] },
  catGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  catGridItem: {
    width: CAT_ITEM_W, alignItems: 'center', gap: Spacing[2],
    borderRadius: BorderRadius.xl, padding: Spacing[3],
    position: 'relative',
  },
  catGridIcon:  { width: 52, height: 52, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  catGridLabel: { ...Typography.labelSmall, textAlign: 'center', lineHeight: 16 },
  catGridCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  emptySearch: { alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[8] },
  emptySearchText:    { ...Typography.bodyMedium },
  emptySearchBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[2.5], borderRadius: BorderRadius.full },
  emptySearchBtnText: { ...Typography.labelSmall },
  createCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1,
    marginTop: Spacing[2],
  },
  createCatIconBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  createCatLabel:   { ...Typography.labelLarge, fontWeight: '600' },
  createCatSub:     { ...Typography.caption, marginTop: 2 },

  // Bottom sheets (shared)
  sheetOverlay:  { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetPanel: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    paddingTop: Spacing[2], paddingBottom: Spacing[8], overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#94A3B8',
    alignSelf: 'center', marginBottom: Spacing[3], opacity: 0.5,
  },
  sheetWarningHeader: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    margin: Spacing[4], borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  sheetWarningTitle: { ...Typography.labelLarge },
  sheetWarningBody:  { ...Typography.bodySmall, lineHeight: 20, marginTop: 3 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionIconBox: { width: 40, height: 40, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  sheetOptionTitle:   { ...Typography.labelLarge },
  sheetOptionSub:     { ...Typography.caption, marginTop: 2 },
  sheetSkip: { marginHorizontal: Spacing[5], marginTop: Spacing[3], paddingVertical: Spacing[3.5], alignItems: 'center' },
  sheetSkipText: { ...Typography.bodySmall, textAlign: 'center' },

  deleteConfirmHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderRadius: BorderRadius.xl, padding: Spacing[4] },
  deleteConfirmTitle:  { ...Typography.labelLarge, fontWeight: '700' },
  deleteConfirmSub:    { ...Typography.bodySmall, marginTop: 3, lineHeight: 18 },
  deleteConfirmBtn:    { borderRadius: BorderRadius.full, paddingVertical: Spacing[4], alignItems: 'center' },
  deleteConfirmBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteCancelBtn:     { borderRadius: BorderRadius.full, paddingVertical: Spacing[4], alignItems: 'center' },
  deleteCancelBtnText: { fontWeight: '600', fontSize: 15 },

  // Date picker sheet
  dateSheetPanel: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    paddingTop: Spacing[2], overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  calHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },
  calNavBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calMonthLabel: { ...Typography.titleSmall },
  calPresets:    { paddingHorizontal: Spacing[4], gap: Spacing[2], paddingBottom: Spacing[3] },
  calPreset:     { paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[2], borderRadius: BorderRadius.full },
  calPresetText: { ...Typography.labelSmall },
  calWeekRow:    { flexDirection: 'row', paddingHorizontal: Spacing[3] },
  calWeekDay:    { flex: 1, textAlign: 'center', ...Typography.caption, paddingBottom: Spacing[2] },
  calGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing[3], paddingBottom: Spacing[2] },
  calCell:       { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellText:   { ...Typography.bodyMedium, fontSize: 14 },
  calConfirmBtn: { borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center' },
  calConfirmText:{ color: '#fff', fontWeight: '700', fontSize: 16 },

  // Category creator sheet
  creatorPanel: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    paddingTop: Spacing[2], maxHeight: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  creatorHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1 },
  creatorPreviewRow:  { alignItems: 'center', gap: Spacing[2], paddingVertical: Spacing[2] },
  creatorPreview:     { width: 64, height: 64, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  creatorPreviewName: { ...Typography.titleSmall },
  creatorFieldLabel:  { ...Typography.labelSmall, marginBottom: Spacing[2] },
  creatorNameInput: {
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    ...Typography.bodyMedium, borderWidth: 1,
  },
  colorGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2.5] },
  colorSwatch:       { width: 32, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  colorSwatchSelected: { transform: [{ scale: 1.2 }] },
  iconGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  iconSwatch:        { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  creatorSaveBtn:    { borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  creatorSaveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  creatorDeleteBtn:  { borderRadius: BorderRadius.xl, paddingVertical: Spacing[3.5], alignItems: 'center', borderWidth: 1.5, marginTop: Spacing[1] },
  creatorDeleteText: { fontWeight: '600', fontSize: 15 },

  // Deduct step
  deductContent:      { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[3], paddingBottom: Spacing[10] },
  deductSubtitle:     { ...Typography.bodyMedium, lineHeight: 22 },
  deductRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: BorderRadius.xl, padding: Spacing[4] },
  deductRowLeft:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  checkbox:           { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  deductInfo:         { flex: 1, gap: 2 },
  deductName:         { ...Typography.labelLarge },
  deductFreq:         { ...Typography.caption },
  deductAmount:       { ...Typography.labelLarge },
  deductSummary:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1 },
  deductSummaryLabel: { ...Typography.bodyMedium },
  deductSummaryValue: { ...Typography.titleSmall },

  // Already-paid / covered state
  paidSection:        { gap: Spacing[2] },
  paidSectionLabel:   { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.8 },
  paidRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  allPaidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  allPaidText: { ...Typography.labelLarge },

  // Balance warning inside deduct step
  deductWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2],
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  deductWarningText: { ...Typography.bodySmall, flex: 1, lineHeight: 20 },

  // Skip / secondary action
  skipBtn: {
    marginTop: Spacing[2], borderRadius: BorderRadius.full,
    paddingVertical: Spacing[3.5], alignItems: 'center', borderWidth: 1,
  },
  skipBtnText: { ...Typography.bodySmall },

  // ── Future-month money warning sheet ──────────────────────────────────────
  futureWarnHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    marginHorizontal: Spacing[5], marginTop: Spacing[2], marginBottom: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.xl, borderWidth: 1,
  },
  futureWarnIconBox: {
    width: 48, height: 48, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  futureWarnTitle: {
    fontSize: 16, fontWeight: '700', marginBottom: 4,
  },
  futureWarnSub: {
    ...Typography.bodySmall, lineHeight: 18,
  },
  futureWarnStats: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing[5], borderRadius: BorderRadius.lg, borderWidth: 1,
    padding: Spacing[4], marginBottom: Spacing[3],
  },
  futureWarnStat: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  futureWarnStatLabel: {
    fontSize: 11, fontWeight: '500', textAlign: 'center',
  },
  futureWarnStatVal: {
    fontSize: 15, fontWeight: '700', textAlign: 'center',
  },
  futureWarnDivider: {
    width: 1, height: 36, marginHorizontal: Spacing[2],
  },
  futureWarnBody: {
    ...Typography.bodySmall, lineHeight: 20,
    paddingHorizontal: Spacing[5], marginBottom: Spacing[2],
  },
  futureWarnConfirmBtn: {
    borderRadius: BorderRadius.full, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  futureWarnConfirmText: {
    fontSize: 16, fontWeight: '700', color: '#000',
  },
  futureWarnCancelBtn: {
    borderRadius: BorderRadius.full, paddingVertical: 14,
    alignItems: 'center',
  },
  futureWarnCancelText: {
    fontSize: 15, fontWeight: '600',
  },
});
