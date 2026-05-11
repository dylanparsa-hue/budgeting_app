import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button } from '../../src/components/ui/Button';
import { Input }  from '../../src/components/ui/Input';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';

export default function LoginScreen() {
  const C = useTheme();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Invalid email or password. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={C.gradients.hero as [string, string]}
          style={styles.hero}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        >
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
          <Text style={styles.heroEmoji}>💰</Text>
          <Text style={styles.heroTitle}>Budget</Text>
          <Text style={styles.heroSub}>Your money, simplified</Text>
        </LinearGradient>

        {/* Form card */}
        <View style={[styles.formCard, { backgroundColor: C.surface }]}>
          <Text style={[styles.formTitle, { color: C.textPrimary }]}>Welcome back</Text>
          <Text style={[styles.formSub, { color: C.textSecondary }]}>Sign in to continue tracking your money</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>⚠️  {error}</Text>
            </View>
          ) : null}

          <View style={styles.fields}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoComplete="password"
              placeholder="••••••••"
              rightIcon={<Text style={styles.togglePw}>{showPw ? '🙈' : '👁️'}</Text>}
              onRightPress={() => setShowPw(v => !v)}
            />
          </View>

          <Button label={isLoading ? 'Signing in…' : 'Sign In'} onPress={handleLogin} loading={isLoading} fullWidth size="lg" />

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: C.border }]} />
            <Text style={[styles.dividerText, { color: C.textTertiary }]}>or</Text>
            <View style={[styles.line, { backgroundColor: C.border }]} />
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.registerBtn}>
            <Text style={[styles.registerText, { color: C.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={[styles.registerLink, { color: C.primary }]}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { flexGrow: 1 },
  hero: {
    minHeight: 280, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', gap: Spacing[1], paddingBottom: Spacing[10],
  },
  heroCircle1: {
    position: 'absolute', top: -50, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroCircle2: {
    position: 'absolute', bottom: -30, left: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroEmoji: { fontSize: 52, marginBottom: Spacing[1] },
  heroTitle: { ...Typography.displayMedium, color: '#fff' },
  heroSub:   { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.85)' },
  formCard: {
    flex: 1,
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    marginTop: -Spacing[7],
    paddingHorizontal: Spacing[6], paddingTop: Spacing[8], paddingBottom: Spacing[10],
    gap: Spacing[5],
  },
  formTitle: { ...Typography.headingLarge },
  formSub:   { ...Typography.bodyMedium, marginTop: -Spacing[3] },
  errorBox:  { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText: { ...Typography.bodySmall },
  fields:    { gap: Spacing[4] },
  togglePw:  { fontSize: 18 },
  divider:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  line:      { flex: 1, height: 1 },
  dividerText: { ...Typography.caption },
  registerBtn: { alignItems: 'center' },
  registerText: { ...Typography.bodyMedium },
  registerLink: { fontWeight: '600' },
});
