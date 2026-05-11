import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button } from '../../src/components/ui/Button';
import { Input }  from '../../src/components/ui/Input';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';

export default function RegisterScreen() {
  const C = useTheme();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? 'Registration failed. Please try again.');
    }
  };

  if (success) {
    return (
      <View style={[styles.successScreen, { backgroundColor: C.background }]}>
        <Text style={styles.successEmoji}>📬</Text>
        <Text style={[styles.successTitle, { color: C.textPrimary }]}>Check your email!</Text>
        <Text style={[styles.successText, { color: C.textSecondary }]}>
          We sent a confirmation link. Verify your email then sign in.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={[styles.successBtn, { backgroundColor: C.primary }]}
        >
          <Text style={styles.successBtnText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: C.textPrimary }]}>Create account</Text>
          <Text style={[styles.sub, { color: C.textSecondary }]}>Start your journey to financial freedom ✨</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>⚠️  {error}</Text>
            </View>
          ) : null}

          <View style={styles.fields}>
            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Jane Smith"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="jane@example.com"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholder="Min. 6 characters"
              hint="At least 6 characters"
              rightIcon={<Text style={styles.togglePw}>{showPw ? '🙈' : '👁️'}</Text>}
              onRightPress={() => setShowPw(v => !v)}
            />
            <Input
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPw}
              placeholder="Re-enter password"
              error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
            />
          </View>

          <Button
            label={isLoading ? 'Creating account…' : 'Create Account'}
            onPress={handleRegister}
            loading={isLoading}
            fullWidth
            size="lg"
          />

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
            <Text style={[styles.loginText, { color: C.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.link, { color: C.primary }]}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { flexGrow: 1 },
  header: {
    paddingTop: 60, paddingHorizontal: Spacing[5], paddingBottom: Spacing[2],
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon:  { fontSize: 20, fontWeight: '600' },
  body: {
    paddingHorizontal: Spacing[6], paddingTop: Spacing[4],
    paddingBottom: Spacing[10], gap: Spacing[5],
  },
  title:    { ...Typography.headingLarge },
  sub:      { ...Typography.bodyMedium, marginTop: -Spacing[3] },
  errorBox: { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:{ ...Typography.bodySmall },
  fields:   { gap: Spacing[4] },
  togglePw: { fontSize: 18 },
  loginLink:{ alignItems: 'center' },
  loginText:{ ...Typography.bodyMedium },
  link:     { fontWeight: '600' },

  successScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing[8], gap: Spacing[4],
  },
  successEmoji: { fontSize: 64 },
  successTitle: { ...Typography.headingMedium, textAlign: 'center' },
  successText:  { ...Typography.bodyMedium, textAlign: 'center', lineHeight: 24 },
  successBtn: {
    paddingHorizontal: Spacing[8], paddingVertical: Spacing[4],
    borderRadius: BorderRadius.full, marginTop: Spacing[2],
  },
  successBtnText: { ...Typography.titleSmall, color: '#fff' },
});
