import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, FlatList, KeyboardAvoidingView, Platform, TextInput,
  Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { format, subMonths, startOfMonth, parseISO } from 'date-fns';

import { useAuthStore }          from '../../src/stores/authStore';
import { useTransactionStore }   from '../../src/stores/transactionStore';
import { useAppSettingsStore }   from '../../src/stores/appSettingsStore';
import { useTheme }              from '../../src/theme/ThemeContext';
import { Typography }            from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import {
  DollarSign, Calendar, Bell, UserCircle, Users, Download,
  HelpCircle, Star, FileText, LogOut, Trash2,
} from 'lucide-react-native';
import { Storage } from '../../src/services/storage';
import { useRecurringStore } from '../../src/stores/recurringStore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'MYR', label: 'Malaysian Ringgit',    symbol: 'RM'  },
  { code: 'USD', label: 'US Dollar',             symbol: '$'   },
  { code: 'EUR', label: 'Euro',                  symbol: '€'   },
  { code: 'GBP', label: 'British Pound',         symbol: '£'   },
  { code: 'SGD', label: 'Singapore Dollar',      symbol: 'S$'  },
  { code: 'AUD', label: 'Australian Dollar',     symbol: 'A$'  },
  { code: 'JPY', label: 'Japanese Yen',          symbol: '¥'   },
  { code: 'CNY', label: 'Chinese Yuan',          symbol: '¥'   },
  { code: 'INR', label: 'Indian Rupee',          symbol: '₹'   },
  { code: 'IDR', label: 'Indonesian Rupiah',     symbol: 'Rp'  },
  { code: 'THB', label: 'Thai Baht',             symbol: '฿'   },
  { code: 'PHP', label: 'Philippine Peso',       symbol: '₱'   },
  { code: 'KRW', label: 'South Korean Won',      symbol: '₩'   },
  { code: 'HKD', label: 'Hong Kong Dollar',      symbol: 'HK$' },
  { code: 'CAD', label: 'Canadian Dollar',       symbol: 'CA$' },
  { code: 'AED', label: 'UAE Dirham',            symbol: 'د.إ' },
  { code: 'SAR', label: 'Saudi Riyal',           symbol: '﷼'   },
  { code: 'BRL', label: 'Brazilian Real',        symbol: 'R$'  },
];

const FAQ_ITEMS = [
  {
    q: 'How does the Smart Savings Planner work?',
    a: 'It averages your income and expenses over the last 3 months, subtracts a safety buffer, then distributes what\'s left across your goals — deadline goals get funded first.',
  },
  {
    q: 'Why is my "Saved" amount different from my bank balance?',
    a: '"Saved" shows only money intentionally allocated to savings goals. Your available balance is tracked separately in the Dashboard.',
  },
  {
    q: 'How do I add a recurring bill?',
    a: 'Go to the Plan tab and tap "+ Add", or open any goal and check the Savings Planner for a shortcut. Recurring items are used to calculate your true disposable income.',
  },
  {
    q: 'What does the Safety Buffer do?',
    a: 'It reserves a percentage of your income (10–25%) as a cushion before allocating to goals. This prevents you from over-committing and running short for unexpected expenses.',
  },
  {
    q: 'Can I track multiple currencies?',
    a: 'All transactions are stored in your chosen currency. You can change your currency in Settings — existing amounts won\'t be converted.',
  },
  {
    q: 'How do I delete a transaction?',
    a: 'Open the Transactions tab, find the entry, and swipe left or tap the edit icon to delete it.',
  },
  {
    q: 'What is "Tracking since" used for?',
    a: 'It tells the Savings Planner when you started using the app, so old empty months before you began tracking don\'t drag down your income and expense averages.',
  },
];

function buildMonthOptions() {
  const now = new Date();
  return Array.from({ length: 37 }, (_, i) => {
    const d = startOfMonth(subMonths(now, i));
    return {
      label: i === 0 ? `This month (${format(d, 'MMM yyyy')})` : format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM-dd'),
    };
  });
}
const MONTH_OPTIONS = buildMonthOptions();

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

type ActiveSheet =
  | 'currency'
  | 'tracking'
  | 'editProfile'
  | 'faq'
  | null;

export default function ProfileScreen() {
  const C = useTheme();
  const { profile, user, logout, saveProfile }             = useAuthStore();
  const { transactions }                                   = useTransactionStore();
  const {
    trackingStartDate, setTrackingStartDate,
    notificationsEnabled, setNotificationsEnabled,
    load: loadSettings,
  } = useAppSettingsStore();

  const [activeSheet,   setActiveSheet]   = useState<ActiveSheet>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  // Edit-profile form state
  const [nameInput,    setNameInput]    = useState('');
  const [savingName,   setSavingName]   = useState(false);
  const [nameError,    setNameError]    = useState('');

  // Currency saving state
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const currency    = profile?.currency ?? 'MYR';
  const displayName = profile?.full_name ?? user?.email ?? 'User';
  const initials    = displayName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  const trackingLabel = trackingStartDate
    ? format(parseISO(trackingStartDate), 'MMMM yyyy')
    : 'Not set';

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openEditProfile = () => {
    setNameInput(profile?.full_name ?? '');
    setNameError('');
    setActiveSheet('editProfile');
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('Name cannot be empty.'); return; }
    setSavingName(true);
    setNameError('');
    try {
      await saveProfile({ full_name: trimmed });
      setActiveSheet(null);
    } catch {
      setNameError('Could not save. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectCurrency = async (code: string) => {
    if (code === currency) { setActiveSheet(null); return; }
    setSavingCurrency(true);
    try {
      await saveProfile({ currency: code });
    } catch {
      Alert.alert('Error', 'Could not update currency. Please try again.');
    } finally {
      setSavingCurrency(false);
      setActiveSheet(null);
    }
  };

  const handleExportData = async () => {
    if (transactions.length === 0) {
      Alert.alert('No data', 'You have no transactions to export yet.');
      return;
    }
    const header = 'Date,Type,Amount,Category,Note,Payment Method,Tags';
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.amount.toFixed(2),
      t.category?.name ?? '',
      `"${(t.note ?? '').replace(/"/g, '""')}"`,
      t.payment_method ?? '',
      (t.tags ?? []).join(';'),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({
        message: csv,
        title:   'Budget Transactions Export',
      });
    } catch {
      // user dismissed — no-op
    }
  };

  const handleRateApp = () => {
    // Replace with your actual App Store / Play Store ID when published
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/idYOUR_APP_ID'
      : 'https://play.google.com/store/apps/details?id=com.yourcompany.budgetapp';
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open store', 'Please search for the app manually.'),
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://yourcompany.com/privacy').catch(() =>
      Alert.alert('Could not open link', 'Visit yourcompany.com/privacy in your browser.'),
    );
  };

  const handleFamilyGroups = () => {
    Alert.alert(
      '👨‍👩‍👧‍👦 Family Groups',
      'Shared budgets and group expense tracking is coming in a future update. Stay tuned!',
      [{ text: 'Got it' }],
    );
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Clear all local data?',
      'This wipes all cached transactions, categories, recurring items, and goals from this device. Your cloud data (Supabase) is not affected — pull-to-refresh after clearing to sync a fresh copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear cache',
          style: 'destructive',
          onPress: async () => {
            // Wipe every @budget:* key in AsyncStorage
            await Storage.clear();
            // Reset in-memory Zustand stores so UI reflects the cleared state
            useTransactionStore.setState({ transactions: [], categories: [], lastSyncAt: null });
            useRecurringStore.setState({ items: [], loaded: false });
            Alert.alert(
              '✅ Local cache cleared',
              'Go to the Dashboard and pull down to refresh — it will sync your latest data from the server.',
            );
          },
        },
      ],
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Page title */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: C.textPrimary }]}>Account</Text>
          <Text style={[styles.pageSub, { color: C.textSecondary }]}>Profile & settings.</Text>
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, Shadow.sm, { backgroundColor: C.surface }]}>
          <View style={[styles.initialsCircle, { backgroundColor: C.primaryLight }]}>
            <Text style={[styles.initialsText, { color: '#4F8D2D' }]}>{initials || '👤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: C.textPrimary }]}>
              {profile?.full_name ?? 'Your Name'}
            </Text>
            <Text style={[styles.profileEmail, { color: C.textTertiary }]}>
              {user?.email ?? ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={openEditProfile}
            style={[styles.editBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.editBtnText, { color: C.textPrimary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <SettingsGroup title="Preferences" C={C}>
          <SettingRow
            icon={DollarSign}
            label="Currency"
            value={currency}
            onPress={() => setActiveSheet('currency')}
            C={C}
          />
          <SettingRow
            icon={Calendar}
            label="Tracking since"
            value={trackingLabel}
            onPress={() => setActiveSheet('tracking')}
            C={C}
          />
          <SettingRow
            icon={Bell}
            label="Budget alerts"
            C={C}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: C.primary, false: C.border }}
                thumbColor="#fff"
              />
            }
          />
        </SettingsGroup>

        {/* Account */}
        <SettingsGroup title="Account" C={C}>
          <SettingRow icon={UserCircle} label="Edit profile"   onPress={openEditProfile}      C={C} />
          <SettingRow icon={Users}     label="Family groups"  onPress={handleFamilyGroups}    C={C} />
          <SettingRow icon={Download}  label="Export data"    onPress={handleExportData}      C={C} />
        </SettingsGroup>

        {/* Data */}
        <SettingsGroup title="Data" C={C}>
          <SettingRow
            icon={Trash2}
            label="Clear local cache"
            onPress={handleClearLocalData}
            C={C}
          />
        </SettingsGroup>

        {/* Support */}
        <SettingsGroup title="Support" C={C}>
          <SettingRow icon={HelpCircle} label="Help & FAQ"     onPress={() => setActiveSheet('faq')} C={C} />
          <SettingRow icon={Star}      label="Rate the app"   onPress={handleRateApp}               C={C} />
          <SettingRow icon={FileText}  label="Privacy policy" onPress={handlePrivacyPolicy}          C={C} />
        </SettingsGroup>

        {/* Logout */}
        {logoutPending ? (
          <View style={[styles.logoutConfirm, { backgroundColor: C.dangerLight }]}>
            <Text style={[styles.logoutConfirmText, { color: C.danger }]}>Sign out of your account?</Text>
            <View style={styles.logoutConfirmActions}>
              <TouchableOpacity onPress={() => setLogoutPending(false)} style={styles.logoutConfirmBtn}>
                <Text style={[styles.logoutConfirmBtnText, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={styles.logoutConfirmBtn}>
                <Text style={[styles.logoutConfirmBtnText, { color: C.danger }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setLogoutPending(true)}
            style={[styles.logoutBtn, { backgroundColor: C.dangerLight }]}
          >
            <Text style={[styles.logoutText, { color: C.danger }]}>Sign out</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.version, { color: C.textTertiary }]}>Budget v1.0.0</Text>
        <View style={{ height: Spacing[10] }} />
      </ScrollView>

      {/* ── Currency picker ────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'currency'}
        onClose={() => setActiveSheet(null)}
        title="Select Currency"
        subtitle="All amounts stay in their current value — only the symbol changes"
      >
        <FlatList
          data={CURRENCIES}
          keyExtractor={item => item.code}
          style={styles.sheetList}
          renderItem={({ item }) => {
            const selected = item.code === currency;
            return (
              <TouchableOpacity
                onPress={() => handleSelectCurrency(item.code)}
                disabled={savingCurrency}
                style={[styles.sheetItem, selected && { backgroundColor: C.primaryLight }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetItemTitle, selected && { color: C.primary }]}>
                    {item.symbol}  {item.code}
                  </Text>
                  <Text style={styles.sheetItemSub}>{item.label}</Text>
                </View>
                {selected && <Text style={[styles.sheetCheck, { color: C.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheet>

      {/* ── Tracking-since picker ──────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'tracking'}
        onClose={() => setActiveSheet(null)}
        title="When did you start tracking?"
        subtitle="Averages only use data from this month onwards"
      >
        <TouchableOpacity
          onPress={() => { setTrackingStartDate(null); setActiveSheet(null); }}
          style={[styles.sheetItem, !trackingStartDate && { backgroundColor: C.primaryLight }]}
        >
          <Text style={[styles.sheetItemTitle, !trackingStartDate && { color: C.primary }]}>
            Use all available data
          </Text>
          {!trackingStartDate && <Text style={[styles.sheetCheck, { color: C.primary }]}>✓</Text>}
        </TouchableOpacity>
        <FlatList
          data={MONTH_OPTIONS}
          keyExtractor={item => item.value}
          style={styles.sheetList}
          renderItem={({ item }) => {
            const selected = trackingStartDate === item.value;
            return (
              <TouchableOpacity
                onPress={() => { setTrackingStartDate(item.value); setActiveSheet(null); }}
                style={[styles.sheetItem, selected && { backgroundColor: C.primaryLight }]}
              >
                <Text style={[styles.sheetItemTitle, selected && { color: C.primary }]}>
                  {item.label}
                </Text>
                {selected && <Text style={[styles.sheetCheck, { color: C.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheet>

      {/* ── Edit profile ──────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'editProfile'}
        onClose={() => setActiveSheet(null)}
        title="Edit Profile"
        subtitle="Your display name shown across the app"
      >
        <View style={styles.editProfileBody}>
          {!!nameError && (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>{nameError}</Text>
            </View>
          )}
          <Text style={[styles.inputLabel, { color: C.textPrimary }]}>Display Name</Text>
          <TextInput
            value={nameInput}
            onChangeText={v => { setNameInput(v); setNameError(''); }}
            placeholder="Your name"
            placeholderTextColor={C.textTertiary}
            style={[styles.nameInput, {
              color: C.textPrimary,
              backgroundColor: C.surfaceRaised,
              borderColor: C.border,
            }]}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              onPress={() => setActiveSheet(null)}
              style={[styles.editCancelBtn, { backgroundColor: C.surfaceRaised }]}
            >
              <Text style={[styles.editCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveName}
              disabled={savingName}
              style={[styles.editSaveBtn, { backgroundColor: C.primary }]}
            >
              <Text style={styles.editSaveText}>{savingName ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* ── Help & FAQ ────────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'faq'}
        onClose={() => setActiveSheet(null)}
        title="Help & FAQ"
        subtitle="Common questions about the app"
      >
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
          <View style={{ height: Spacing[8] }} />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bottom-sheet wrapper
// ─────────────────────────────────────────────────────────────────────────────

function BottomSheet({
  visible, onClose, title, subtitle, children,
}: {
  visible: boolean; onClose: () => void;
  title: string; subtitle?: string;
  children: React.ReactNode;
}) {
  const C = useTheme();
  // In dark mode surface (#1E293B) blends into background (#0F172A) —
  // use surfaceRaised (#334155) so the sheet clearly lifts off the page.
  const sheetBg      = C.isDark ? '#2D3B50' : '#FFFFFF';
  const sheetItemBg  = C.isDark ? '#374357' : '#F8FAFC';
  const closeBtnBg   = C.isDark ? '#3D4F66' : '#F1F5F9';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheetPanel, {
          backgroundColor: sheetBg,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: C.isDark ? 0.5 : 0.12,
          shadowRadius: 16,
          elevation: 24,
        }]}>
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          <View style={[styles.sheetHeader, { borderBottomColor: C.isDark ? '#3D4F66' : C.divider }]}>
            <View style={{ flex: 1, gap: Spacing[1] }}>
              <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>{title}</Text>
              {subtitle && <Text style={[styles.sheetSub, { color: C.textSecondary }]}>{subtitle}</Text>}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.sheetCloseBtn, { backgroundColor: closeBtnBg }]}
            >
              <Text style={[styles.sheetCloseBtnText, { color: C.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ item (expand / collapse)
// ─────────────────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setOpen(v => !v)}
      style={[styles.faqItem, { borderBottomColor: C.divider }]}
      activeOpacity={0.7}
    >
      <View style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: C.textPrimary, flex: 1 }]}>{q}</Text>
        <Text style={[styles.faqChevron, { color: C.textTertiary }]}>{open ? '▲' : '▼'}</Text>
      </View>
      {open && <Text style={[styles.faqA, { color: C.textSecondary }]}>{a}</Text>}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SettingsGroup({ title, children, C }: { title: string; children: React.ReactNode; C: any }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: C.textSecondary }]}>{title}</Text>
      <View style={[styles.groupCard, Shadow.sm, { backgroundColor: C.surface }]}>{children}</View>
    </View>
  );
}

interface RowProps {
  icon:     string | React.ComponentType<any>;
  label:    string;
  value?:   string;
  right?:   React.ReactNode;
  onPress?: () => void;
  C:        any;
}

function SettingRow({ icon, label, value, right, onPress, C }: RowProps) {
  const IconComp = typeof icon !== 'string' ? icon as any : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={0.7}
      style={[styles.settingRow, { borderBottomColor: C.divider }]}
    >
      <View style={[styles.rowIconBox, { backgroundColor: C.surfaceRaised }]}>
        {IconComp
          ? React.createElement(IconComp, { size: 18, color: C.textSecondary, strokeWidth: 2 })
          : <Text style={styles.rowIcon}>{icon as string}</Text>
        }
      </View>
      <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value  && <Text style={[styles.rowValue, { color: C.textSecondary }]}>{value}</Text>}
        {right}
        {onPress && !right && <Text style={[styles.chevron, { color: C.textTertiary }]}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[4], paddingBottom: Spacing[10] },

  // Page header
  pageHeader: { paddingTop: Spacing[2], paddingBottom: Spacing[1] },
  pageTitle:  { ...(Typography.headingLarge ?? {}), fontSize: 32, fontWeight: '800' },
  pageSub:    { fontSize: 15, marginTop: 4 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 20,
    padding: 20,
  },
  initialsCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  initialsText: {
    fontFamily: Typography.headingSmall.fontFamily,
    fontSize: 20, fontWeight: '700',
  },
  profileName: { ...Typography.titleMedium },
  profileEmail: { ...Typography.bodySmall, marginTop: 2 },
  editBtn: {
    borderWidth: 1.5, borderRadius: 9999,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  editBtnText: { fontSize: 13, fontWeight: '600' },

  // Settings groups
  group:      { gap: Spacing[2] },
  groupTitle: { ...Typography.labelLarge, paddingHorizontal: Spacing[1] },
  groupCard:  { borderRadius: BorderRadius.xl, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing[3.5], paddingHorizontal: Spacing[4],
    gap: Spacing[3], borderBottomWidth: 1,
  },
  rowIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  rowIcon:  { fontSize: 18 },
  rowLabel: { flex: 1, ...Typography.bodyMedium },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  rowValue: { ...Typography.bodySmall },
  chevron:  { fontSize: 20, fontWeight: '300' },

  // Logout
  logoutBtn:            { borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center' },
  logoutText:           { ...Typography.titleSmall },
  logoutConfirm:        { borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3] },
  logoutConfirmText:    { ...Typography.bodyMedium, textAlign: 'center' },
  logoutConfirmActions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing[8] },
  logoutConfirmBtn:     {},
  logoutConfirmBtnText: { ...Typography.titleSmall },

  version: { ...Typography.caption, textAlign: 'center' },

  // Shared bottom sheet
  sheetOverlay:   { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetPanel: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    maxHeight: '70%', overflow: 'hidden',
    paddingTop: Spacing[2],
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: Spacing[2],
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[5], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:        { ...Typography.titleSmall },
  sheetSub:          { ...Typography.caption },
  sheetCloseBtn:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetCloseBtnText: { fontSize: 14 },
  sheetList:         { flexGrow: 0 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemTitle: { ...Typography.bodyMedium },
  sheetItemSub:   { ...Typography.caption, marginTop: 2 },
  sheetCheck:     { fontSize: 18 },

  // Edit profile sheet
  editProfileBody: { padding: Spacing[5], gap: Spacing[4] },
  inputLabel:      { ...Typography.labelLarge },
  nameInput: {
    ...Typography.bodyLarge,
    borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
  editActions:    { flexDirection: 'row', gap: Spacing[3] },
  editCancelBtn:  { flex: 1, borderRadius: BorderRadius.xl, paddingVertical: Spacing[3.5], alignItems: 'center' },
  editCancelText: { ...Typography.labelLarge },
  editSaveBtn:    { flex: 1, borderRadius: BorderRadius.xl, paddingVertical: Spacing[3.5], alignItems: 'center' },
  editSaveText:   { ...Typography.labelLarge, color: '#fff' },
  errorBox:       { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:      { ...Typography.bodySmall },

  // FAQ
  faqItem: {
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    gap: Spacing[2], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  faqRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  faqQ:       { ...Typography.labelLarge, lineHeight: 22 },
  faqChevron: { fontSize: 11, marginTop: 4 },
  faqA:       { ...Typography.bodySmall, lineHeight: 21 },
});
