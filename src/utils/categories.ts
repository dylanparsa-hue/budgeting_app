import { Category } from '../types';
import { Colors } from '../theme/colors';

export const DEFAULT_GOAL_ICONS = ['🎯', '🚗', '✈️', '🏠', '💍', '📱', '🎓', '🏥', '💰', '🌴', '🎸', '🐶'];
export const DEFAULT_GOAL_COLORS = [
  Colors.primary, Colors.secondary, Colors.accent,
  Colors.info, '#EC4899', '#8B5CF6', '#F59E0B', '#EF4444',
];

export const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Cash',      icon: '💵' },
  { value: 'card',     label: 'Card',      icon: '💳' },
  { value: 'transfer', label: 'Transfer',  icon: '🔄' },
  { value: 'ewallet',  label: 'eWallet',   icon: '📱' },
  { value: 'other',    label: 'Other',     icon: '📦' },
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
