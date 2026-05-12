/**
 * Waddl Lucide icon mapping for budget-app.
 * Install: npx expo install lucide-react-native react-native-svg
 */

import {
  UtensilsCrossed, Bus, Receipt, ShoppingBag, Sparkles, Heart, GraduationCap,
  Package, Wallet, Briefcase, TrendingUp, Gift,
  Smartphone, Zap, CreditCard, Shield, Car, Home,
  Bell, Settings, Search, X, Check, ChevronRight, Plus, ArrowUp, ArrowDown,
  Target, PiggyBank, Trophy, Calendar, FileText,
  HelpCircle, Star, Lock, LogOut, UserCircle, Users, Download, DollarSign,
} from 'lucide-react-native';

import type { LucideIcon } from 'lucide-react-native';

/** Category slug → Lucide icon */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  food:          UtensilsCrossed,
  transport:     Bus,
  bills:         Receipt,
  shopping:      ShoppingBag,
  entertainment: Sparkles,
  health:        Heart,
  education:     GraduationCap,
  others:        Package,
  salary:        Wallet,
  freelance:     Briefcase,
  investment:    TrendingUp,
  gift:          Gift,
};

/** Recurring-bill category → Lucide icon */
export const BILL_ICON: Record<string, LucideIcon> = {
  subscription: Smartphone,
  utilities:    Zap,
  debt:         CreditCard,
  insurance:    Shield,
  transport:    Car,
  rent:         Home,
  other:        Package,
};

export {
  Bell, Settings, Search, X, Check, ChevronRight, Plus, ArrowUp, ArrowDown,
  Target, PiggyBank, Trophy, Calendar, FileText,
  HelpCircle, Star, Lock, LogOut, UserCircle, Users, Download, DollarSign,
  Package,
};
