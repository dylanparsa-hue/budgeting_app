import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { Colors }    from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';

const CURRENCIES = ['MYR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD'];

export default function ProfileScreen() {
  const { profile, user, logout } = useAuthStore();
  const { transactions }          = useTransactionStore();
  const [notifications, setNotifications] = useState(true);

  const totalTransactions = transactions.length;
  const totalExpenses     = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const displayName = profile?.full_name ?? user?.email ?? 'User';
  const initials    = displayName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar card */}
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          style={styles.avatarCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials || '👤'}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{totalTransactions}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.currency ?? 'MYR'}</Text>
              <Text style={styles.statLabel}>Currency</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Settings sections */}
        <SettingsGroup title="Preferences">
          <SettingRow
            icon="💱"
            label="Currency"
            value={profile?.currency ?? 'MYR'}
            onPress={() => Alert.alert(
              'Select Currency',
              undefined,
              CURRENCIES.map(c => ({
                text: c,
                onPress: () => {},
              }))
            )}
          />
          <SettingRow
            icon="🔔"
            label="Budget alerts"
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor={Colors.white}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingRow
            icon="👤"
            label="Edit profile"
            onPress={() => Alert.alert('Coming soon', 'Profile editing will be available soon.')}
          />
          <SettingRow
            icon="👨‍👩‍👧‍👦"
            label="Family groups"
            onPress={() => Alert.alert('Coming soon', 'Family groups will be available soon.')}
          />
          <SettingRow
            icon="📤"
            label="Export data"
            onPress={() => Alert.alert('Coming soon', 'Data export will be available soon.')}
          />
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingRow icon="❓" label="Help & FAQ"    onPress={() => {}} />
          <SettingRow icon="⭐" label="Rate the app"  onPress={() => {}} />
          <SettingRow icon="📜" label="Privacy policy" onPress={() => {}} />
        </SettingsGroup>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Budget v1.0.0</Text>
        <View style={{ height: Spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={[styles.groupCard, Shadow.sm]}>{children}</View>
    </View>
  );
}

interface RowProps {
  icon:    string;
  label:   string;
  value?:  string;
  right?:  React.ReactNode;
  onPress?: () => void;
}

function SettingRow({ icon, label, value, right, onPress }: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={0.7}
      style={styles.settingRow}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {right}
        {onPress && !right && <Text style={styles.chevron}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[4],
    gap:               Spacing[4],
    paddingBottom:     Spacing[10],
  },

  // Avatar card
  avatarCard: {
    borderRadius:  BorderRadius['2xl'],
    padding:       Spacing[6],
    alignItems:    'center',
    gap:           Spacing[2],
  },
  avatarCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing[1],
  },
  avatarInitials: {
    fontSize:   28,
    fontWeight: '700',
    color:      Colors.white,
  },
  displayName: {
    ...Typography.headingSmall,
    color: Colors.white,
  },
  emailText: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.75)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     Spacing[3],
    gap:           Spacing[6],
  },
  stat: {
    alignItems: 'center',
    gap:        Spacing[0.5],
  },
  statValue: {
    ...Typography.titleMedium,
    color: Colors.white,
  },
  statLabel: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  statDivider: {
    width:  1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Groups
  group: {
    gap: Spacing[2],
  },
  groupTitle: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing[1],
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius:    BorderRadius.xl,
    overflow:        'hidden',
  },
  settingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: Spacing[3.5],
    paddingHorizontal: Spacing[4],
    gap:            Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowIcon: { fontSize: 20 },
  rowLabel: {
    flex:   1,
    ...Typography.bodyMedium,
    color:  Colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[2],
  },
  rowValue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  chevron: {
    fontSize: 20,
    color:    Colors.textTertiary,
    fontWeight: '300',
  },

  // Logout
  logoutBtn: {
    backgroundColor: Colors.dangerLight,
    borderRadius:    BorderRadius.xl,
    paddingVertical: Spacing[4],
    alignItems:      'center',
  },
  logoutText: {
    ...Typography.titleSmall,
    color: Colors.danger,
  },
  version: {
    ...Typography.caption,
    color:     Colors.textTertiary,
    textAlign: 'center',
  },
});
