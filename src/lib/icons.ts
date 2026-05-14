/**
 * Central icon registry for the budget app.
 * Single source of truth for category, bill, goal, insight, and UI icons.
 */

import {
  Home, Utensils, Car, Zap, Film, Heart, ShoppingBag, GraduationCap,
  Briefcase, Laptop, TrendingUp, Package, Wallet, Receipt,
  Smartphone, CreditCard, Shield,
  Target, PiggyBank, Plane, Music, Gem, Baby, Dog, Trophy,
  AlertCircle, AlertTriangle, Info, Sparkles,
  Bell, Settings, Search, X, Check, ChevronRight, Plus, ArrowUp, ArrowDown,
  Calendar, FileText, HelpCircle, Star, Lock, LogOut, UserCircle, Users,
  Download, DollarSign, Pencil, Trash2, MoreHorizontal, BarChart2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

// ── Category icons ─────────────────────────────────────────────────────────────
// Keyed by stored icon name (written to DB) AND common name/slug variants.

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  // Icon-name keys stored in DB
  housing:           Home,
  food:              Utensils,
  transport:         Car,
  utilities:         Zap,
  entertainment:     Film,
  healthcare:        Heart,
  shopping:          ShoppingBag,
  education:         GraduationCap,
  salary:            Briefcase,
  freelance:         Laptop,
  investment:        TrendingUp,
  other:             Package,
  // Category name slug variants (lookup by name.toLowerCase())
  'housing & rent':  Home,
  'food & dining':   Utensils,
  health:            Heart,
  bills:             Receipt,
  'bills & utilities': Zap,
  groceries:         ShoppingBag,
};

// ── Bill / recurring-expense category meta ────────────────────────────────────

export interface BillMeta {
  label: string;
  Icon:  LucideIcon;
  color: string;
}

export const BILL_META: Record<string, BillMeta> = {
  rent:         { label: 'Rent / Housing', Icon: Home,       color: '#6366F1' },
  utilities:    { label: 'Utilities',      Icon: Zap,        color: '#F59E0B' },
  subscription: { label: 'Subscription',  Icon: Smartphone, color: '#8B5CF6' },
  debt:         { label: 'Debt / Loan',   Icon: CreditCard, color: '#EF4444' },
  insurance:    { label: 'Insurance',     Icon: Shield,     color: '#3B82F6' },
  transport:    { label: 'Transport',     Icon: Car,        color: '#10B981' },
  other:        { label: 'Other',         Icon: Package,    color: '#6B7280' },
};

export const BILL_ICON: Record<string, LucideIcon> = Object.fromEntries(
  Object.entries(BILL_META).map(([k, v]) => [k, v.Icon]),
) as Record<string, LucideIcon>;

// ── Goal icons ─────────────────────────────────────────────────────────────────

export const GOAL_ICON: Record<string, LucideIcon> = {
  target:    Target,
  car:       Car,
  travel:    Plane,
  home:      Home,
  ring:      Gem,
  phone:     Smartphone,
  education: GraduationCap,
  health:    Heart,
  savings:   PiggyBank,
  music:     Music,
  pet:       Dog,
  baby:      Baby,
};

export interface GoalIconOption {
  key:  string;
  Icon: LucideIcon;
}

export const GOAL_ICON_OPTIONS: GoalIconOption[] = [
  { key: 'target',    Icon: Target        },
  { key: 'car',       Icon: Car           },
  { key: 'travel',    Icon: Plane         },
  { key: 'home',      Icon: Home          },
  { key: 'ring',      Icon: Gem           },
  { key: 'phone',     Icon: Smartphone    },
  { key: 'education', Icon: GraduationCap },
  { key: 'health',    Icon: Heart         },
  { key: 'savings',   Icon: PiggyBank     },
  { key: 'music',     Icon: Music         },
  { key: 'pet',       Icon: Dog           },
  { key: 'baby',      Icon: Baby          },
];

// ── Insight icons (by severity) ────────────────────────────────────────────────

export const INSIGHT_SEVERITY_ICON: Record<string, LucideIcon> = {
  alert:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
  success: Sparkles,
};

// ── Re-exported UI icons ───────────────────────────────────────────────────────

export {
  Bell, Settings, Search, X, Check, ChevronRight, Plus, ArrowUp, ArrowDown,
  Target, PiggyBank, Trophy, Calendar, FileText,
  HelpCircle, Star, Lock, LogOut, UserCircle, Users, Download, DollarSign,
  Package, Pencil, Trash2, MoreHorizontal, BarChart2,
  AlertCircle, AlertTriangle, Info, Sparkles,
  Home, Car, Zap, Heart, ShoppingBag, Briefcase, TrendingUp,
};
