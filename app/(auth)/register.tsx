import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';

export default function RegisterScreen() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      Alert.alert(
        'Check your email! 📬',
        'We sent a confirmation link. Verify your email then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: any) {
      Alert.alert('Registration failed', err.message ?? 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Start your journey to financial freedom ✨</Text>

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

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex:            1,
    backgroundColor: Colors.white,
  },
  content: {
    flexGrow: 1,
  },
  header: {
    paddingTop:        60,
    paddingHorizontal: Spacing[5],
    paddingBottom:     Spacing[2],
  },
  backBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: Colors.surfaceRaised,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize:   20,
    color:      Colors.textPrimary,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: Spacing[6],
    paddingTop:        Spacing[4],
    paddingBottom:     Spacing[10],
    gap:               Spacing[5],
  },
  title: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
  },
  sub: {
    ...Typography.bodyMedium,
    color:     Colors.textSecondary,
    marginTop: -Spacing[3],
  },
  fields: {
    gap: Spacing[4],
  },
  togglePw: {
    fontSize: 18,
  },
  loginLink: {
    alignItems: 'center',
  },
  loginText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  link: {
    color:      Colors.primary,
    fontWeight: '600',
  },
});
