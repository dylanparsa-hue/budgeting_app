import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, FlatList, KeyboardAvoidingView, Platform, TextInput,
  Alert, Share, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { format, subMonths, startOfMonth, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { useAuthStore }          from '../../src/stores/authStore';
import { useTransactionStore }   from '../../src/stores/transactionStore';
import { useAppSettingsStore }   from '../../src/stores/appSettingsStore';
import type { ThemeMode }        from '../../src/stores/appSettingsStore';
import { useTheme }              from '../../src/theme/ThemeContext';
import { Typography }            from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import {
  DollarSign, Calendar, Bell, UserCircle, Users, Download,
  HelpCircle, Star, FileText, LogOut, Trash2,
  Sun, Moon, SunMoon, Globe, Check, X,
} from 'lucide-react-native';
import { Storage } from '../../src/services/storage';
import { useRecurringStore } from '../../src/stores/recurringStore';
import { SUPPORTED_LANGUAGES, isRTL } from '../../src/i18n';
import type { LanguageCode } from '../../src/i18n';

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

function buildMonthOptions(thisMonthLabel: string) {
  const now = new Date();
  return Array.from({ length: 37 }, (_, i) => {
    const d = startOfMonth(subMonths(now, i));
    return {
      label: i === 0 ? thisMonthLabel.replace('{{date}}', format(d, 'MMM yyyy')) : format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM-dd'),
    };
  });
}

// Theme option definition
interface ThemeOption {
  mode:  ThemeMode;
  Icon:  React.ComponentType<any>;
  labelKey: string;
}
const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light',  Icon: Sun,     labelKey: 'appearance.light'  },
  { mode: 'dark',   Icon: Moon,    labelKey: 'appearance.dark'   },
  { mode: 'system', Icon: SunMoon, labelKey: 'appearance.system' },
];

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
  const C  = useTheme();
  const { t } = useTranslation();

  const { profile, user, logout, saveProfile }             = useAuthStore();
  const { transactions }                                   = useTransactionStore();
  const {
    trackingStartDate, setTrackingStartDate,
    notificationsEnabled, setNotificationsEnabled,
    themeMode, setThemeMode,
    language,  setLanguage,
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
  const displayName = profile?.full_name ?? user?.email ?? t('account.yourName');
  const initials    = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');

  const trackingLabel = trackingStartDate
    ? format(parseISO(trackingStartDate), 'MMMM yyyy')
    : t('preferences.trackingNotSet');

  const MONTH_OPTIONS = buildMonthOptions(t('preferences.thisMonth'));

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openEditProfile = () => {
    setNameInput(profile?.full_name ?? '');
    setNameError('');
    setActiveSheet('editProfile');
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError(t('account.nameEmpty')); return; }
    setSavingName(true);
    setNameError('');
    try {
      await saveProfile({ full_name: trimmed });
      setActiveSheet(null);
    } catch {
      setNameError(t('account.couldNotSave'));
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
      Alert.alert(t('common.error'), t('account.couldNotUpdateCurrency'));
    } finally {
      setSavingCurrency(false);
      setActiveSheet(null);
    }
  };

  const handleSelectLanguage = async (lang: LanguageCode) => {
    if (lang === language) return;
    await setLanguage(lang);
    // If RTL direction changes, apply RTL layout and prompt user to restart
    const willBeRTL = isRTL(lang);
    const isCurrentlyRTL = I18nManager.isRTL;
    if (willBeRTL !== isCurrentlyRTL) {
      I18nManager.allowRTL(willBeRTL);
      I18nManager.forceRTL(willBeRTL);
      Alert.alert(
        t('language.restartTitle'),
        t('language.restartMessage'),
        [{ text: t('common.gotIt') }],
      );
    }
  };

  const handleExportData = async () => {
    if (transactions.length === 0) {
      Alert.alert(t('account.noData'), t('account.noTransactions'));
      return;
    }
    const header = 'Date,Type,Amount,Category,Note,Payment Method,Tags';
    const rows = transactions.map(tx => [
      tx.date,
      tx.type,
      tx.amount.toFixed(2),
      tx.category?.name ?? '',
      `"${(tx.note ?? '').replace(/"/g, '""')}"`,
      tx.payment_method ?? '',
      (tx.tags ?? []).join(';'),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({ message: csv, title: 'Budget Transactions Export' });
    } catch {
      // user dismissed — no-op
    }
  };

  const handleRateApp = () => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/idYOUR_APP_ID'
      : 'https://play.google.com/store/apps/details?id=com.yourcompany.budgetapp';
    Linking.openURL(url).catch(() =>
      Alert.alert(t('account.couldNotOpenStore'), t('account.searchManually')),
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://yourcompany.com/privacy').catch(() =>
      Alert.alert(t('account.couldNotOpenLink'), t('account.visitPrivacy')),
    );
  };

  const handleFamilyGroups = () => {
    Alert.alert(
      t('account.familyGroupsTitle'),
      t('account.familyGroupsMessage'),
      [{ text: t('common.gotIt') }],
    );
  };

  const handleClearLocalData = () => {
    Alert.alert(
      t('account.clearCacheTitle'),
      t('account.clearCacheMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.clearCacheAction'),
          style: 'destructive',
          onPress: async () => {
            await Storage.clear();
            useTransactionStore.setState({ transactions: [], categories: [], lastSyncAt: null });
            useRecurringStore.setState({ items: [], loaded: false });
            Alert.alert(
              t('account.clearCacheSuccess'),
              t('account.clearCacheSuccessMsg'),
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
          <Text style={[styles.pageTitle, { color: C.textPrimary }]}>{t('account.title')}</Text>
          <Text style={[styles.pageSub, { color: C.textSecondary }]}>{t('account.subtitle')}</Text>
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, Shadow.sm, { backgroundColor: C.surface }]}>
          <View style={[styles.initialsCircle, { backgroundColor: C.primaryLight }]}>
            <Text style={[styles.initialsText, { color: '#4F8D2D' }]}>{initials || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: C.textPrimary }]}>
              {profile?.full_name ?? t('account.yourName')}
            </Text>
            <Text style={[styles.profileEmail, { color: C.textTertiary }]}>
              {user?.email ?? ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={openEditProfile}
            style={[styles.editBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.editBtnText, { color: C.textPrimary }]}>{t('common.edit')}</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <SettingsGroup title={t('appearance.title')} C={C}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(opt => {
              const selected = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  onPress={() => setThemeMode(opt.mode)}
                  activeOpacity={0.75}
                  style={[
                    styles.themeOption,
                    { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primaryLight : C.surfaceRaised },
                  ]}
                >
                  <opt.Icon
                    size={20}
                    color={selected ? C.primary : C.textTertiary}
                    strokeWidth={selected ? 2.5 : 1.8}
                  />
                  <Text style={[styles.themeLabel, { color: selected ? C.primary : C.textSecondary, fontWeight: selected ? '700' : '500' }]}>
                    {t(opt.labelKey)}
                  </Text>
                  {selected && (
                    <View style={[styles.themeCheck, { backgroundColor: C.primary }]}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsGroup>

        {/* Language */}
        <SettingsGroup title={t('language.title')} C={C}>
          <View style={styles.langGrid}>
            {SUPPORTED_LANGUAGES.map(lang => {
              const selected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleSelectLanguage(lang.code as LanguageCode)}
                  activeOpacity={0.75}
                  style={[
                    styles.langOption,
                    { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primaryLight : C.surfaceRaised },
                  ]}
                >
                  <Text style={[styles.langNative, { color: selected ? C.primary : C.textPrimary }]}>
                    {lang.nativeLabel}
                  </Text>
                  <Text style={[styles.langEnglish, { color: selected ? C.primary : C.textTertiary }]}>
                    {lang.label}
                  </Text>
                  {selected && (
                    <View style={[styles.langCheck, { backgroundColor: C.primary }]}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsGroup>

        {/* Preferences */}
        <SettingsGroup title={t('preferences.title')} C={C}>
          <SettingRow
            icon={DollarSign}
            label={t('preferences.currency')}
            value={currency}
            onPress={() => setActiveSheet('currency')}
            C={C}
          />
          <SettingRow
            icon={Calendar}
            label={t('preferences.trackingSince')}
            value={trackingLabel}
            onPress={() => setActiveSheet('tracking')}
            C={C}
          />
          <SettingRow
            icon={Bell}
            label={t('preferences.budgetAlerts')}
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
        <SettingsGroup title={t('sections.account')} C={C}>
          <SettingRow icon={UserCircle} label={t('rows.editProfile')}   onPress={openEditProfile}   C={C} />
          <SettingRow icon={Users}     label={t('rows.familyGroups')}  onPress={handleFamilyGroups} C={C} />
          <SettingRow icon={Download}  label={t('rows.exportData')}    onPress={handleExportData}   C={C} />
        </SettingsGroup>

        {/* Data */}
        <SettingsGroup title={t('sections.data')} C={C}>
          <SettingRow
            icon={Trash2}
            label={t('rows.clearCache')}
            onPress={handleClearLocalData}
            C={C}
          />
        </SettingsGroup>

        {/* Support */}
        <SettingsGroup title={t('sections.support')} C={C}>
          <SettingRow icon={HelpCircle} label={t('rows.helpFaq')}     onPress={() => setActiveSheet('faq')} C={C} />
          <SettingRow icon={Star}       label={t('rows.rateApp')}     onPress={handleRateApp}               C={C} />
          <SettingRow icon={FileText}   label={t('rows.privacyPolicy')} onPress={handlePrivacyPolicy}        C={C} />
        </SettingsGroup>

        {/* Logout */}
        {logoutPending ? (
          <View style={[styles.logoutConfirm, { backgroundColor: C.dangerLight }]}>
            <Text style={[styles.logoutConfirmText, { color: C.danger }]}>{t('account.signOutConfirm')}</Text>
            <View style={styles.logoutConfirmActions}>
              <TouchableOpacity onPress={() => setLogoutPending(false)} style={styles.logoutConfirmBtn}>
                <Text style={[styles.logoutConfirmBtnText, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={styles.logoutConfirmBtn}>
                <Text style={[styles.logoutConfirmBtnText, { color: C.danger }]}>{t('account.signOut')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setLogoutPending(true)}
            style={[styles.logoutBtn, { backgroundColor: C.dangerLight }]}
          >
            <Text style={[styles.logoutText, { color: C.danger }]}>{t('account.signOut')}</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.version, { color: C.textTertiary }]}>{t('account.version')}</Text>
        <View style={{ height: Spacing[10] }} />
      </ScrollView>

      {/* ── Currency picker ────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'currency'}
        onClose={() => setActiveSheet(null)}
        title={t('selectCurrency')}
        subtitle={t('preferences.currencySubtitle')}
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
                  <Text style={[styles.sheetItemTitle, { color: C.textPrimary }, selected && { color: C.primary }]}>
                    {item.symbol}  {item.code}
                  </Text>
                  <Text style={[styles.sheetItemSub, { color: C.textTertiary }]}>{item.label}</Text>
                </View>
                {selected && <Check size={18} color={C.primary} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheet>

      {/* ── Tracking-since picker ──────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'tracking'}
        onClose={() => setActiveSheet(null)}
        title={t('whenTracking')}
        subtitle={t('preferences.trackingSinceSub')}
      >
        <TouchableOpacity
          onPress={() => { setTrackingStartDate(null); setActiveSheet(null); }}
          style={[styles.sheetItem, !trackingStartDate && { backgroundColor: C.primaryLight }]}
        >
          <Text style={[styles.sheetItemTitle, { color: C.textPrimary }, !trackingStartDate && { color: C.primary }]}>
            {t('common.useAllData')}
          </Text>
          {!trackingStartDate && <Check size={18} color={C.primary} strokeWidth={2.5} />}
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
                <Text style={[styles.sheetItemTitle, { color: C.textPrimary }, selected && { color: C.primary }]}>
                  {item.label}
                </Text>
                {selected && <Check size={18} color={C.primary} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheet>

      {/* ── Edit profile ──────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'editProfile'}
        onClose={() => setActiveSheet(null)}
        title={t('account.editProfile')}
        subtitle={t('account.editProfileSub')}
      >
        <View style={styles.editProfileBody}>
          {!!nameError && (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>{nameError}</Text>
            </View>
          )}
          <Text style={[styles.inputLabel, { color: C.textPrimary }]}>{t('account.displayName')}</Text>
          <TextInput
            value={nameInput}
            onChangeText={v => { setNameInput(v); setNameError(''); }}
            placeholder={t('account.namePlaceholder')}
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
              <Text style={[styles.editCancelText, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveName}
              disabled={savingName}
              style={[styles.editSaveBtn, { backgroundColor: C.primary }]}
            >
              <Text style={styles.editSaveText}>{savingName ? t('common.saving') : t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* ── Help & FAQ ────────────────────────────────────────────────────── */}
      <BottomSheet
        visible={activeSheet === 'faq'}
        onClose={() => setActiveSheet(null)}
        title={t('faq.title')}
        subtitle={t('faq.subtitle')}
      >
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map(n => (
            <FaqItem key={n} q={t(`faq.q${n}`)} a={t(`faq.a${n}`)} />
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
  const sheetBg    = C.isDark ? '#2D3B50' : '#FFFFFF';
  const closeBtnBg = C.isDark ? '#3D4F66' : '#F1F5F9';

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
              <X size={14} color={C.textSecondary} strokeWidth={2.5} />
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
  icon:     React.ComponentType<any>;
  label:    string;
  value?:   string;
  right?:   React.ReactNode;
  onPress?: () => void;
  C:        any;
}

function SettingRow({ icon: IconComp, label, value, right, onPress, C }: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={0.7}
      style={[styles.settingRow, { borderBottomColor: C.divider }]}
    >
      <View style={[styles.rowIconBox, { backgroundColor: C.surfaceRaised }]}>
        <IconComp size={18} color={C.textSecondary} strokeWidth={2} />
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
  profileName:  { ...Typography.titleMedium },
  profileEmail: { ...Typography.bodySmall, marginTop: 2 },
  editBtn: {
    borderWidth: 1.5, borderRadius: 9999,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  editBtnText: { fontSize: 13, fontWeight: '600' },

  // Theme selector
  themeRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    padding: Spacing[3],
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1.5],
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    position: 'relative',
  },
  themeLabel: {
    ...Typography.labelSmall,
    textAlign: 'center',
  },
  themeCheck: {
    position: 'absolute',
    top: 6, right: 6,
    width: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Language selector
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    padding: Spacing[3],
  },
  langOption: {
    width: '47%',
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing[0.5],
    position: 'relative',
  },
  langNative: {
    ...Typography.titleSmall,
    fontSize: 15,
  },
  langEnglish: {
    ...Typography.caption,
  },
  langCheck: {
    position: 'absolute',
    top: 6, right: 6,
    width: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  sheetTitle:    { ...Typography.titleSmall },
  sheetSub:      { ...Typography.caption },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetList:     { flexGrow: 0 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemTitle: { ...Typography.bodyMedium },
  sheetItemSub:   { ...Typography.caption, marginTop: 2 },

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
