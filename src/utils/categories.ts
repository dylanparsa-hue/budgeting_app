import { Category } from '../types';
import { Colors } from '../theme/colors';

export const DEFAULT_GOAL_ICONS = ['target', 'car', 'travel', 'home', 'ring', 'phone', 'education', 'health', 'savings', 'music', 'pet', 'baby'];
// All values must be unique — no duplicates or React will warn about duplicate keys
export const DEFAULT_GOAL_COLORS = [
  '#10B981', // emerald (primary)
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
];

export const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Cash',      icon: 'Banknote'   },
  { value: 'card',     label: 'Card',      icon: 'CreditCard' },
  { value: 'transfer', label: 'Transfer',  icon: 'ArrowRightLeft' },
  { value: 'ewallet',  label: 'eWallet',   icon: 'Smartphone' },
  { value: 'other',    label: 'Other',     icon: 'MoreHorizontal' },
] as const;

export const getCategoryById = (categories: Category[], id: string | null) =>
  categories.find(c => c.id === id) ?? null;

export const getExpenseCategories = (categories: Category[]) =>
  categories.filter(c => c.type === 'expense' || c.type === 'both');

export const getIncomeCategories = (categories: Category[]) =>
  categories.filter(c => c.type === 'income' || c.type === 'both');

export const groupCategoriesByType = (categories: Category[]) => ({
  expense: getExpenseCategories(categories),
  income:  getIncomeCategories(categories),
});
