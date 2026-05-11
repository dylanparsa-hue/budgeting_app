/**
 * Push Notification Service
 *
 * This file wires the insight engine to Expo push notifications.
 *
 * HOW TO ACTIVATE:
 *   1. Install the package:   npx expo install expo-notifications
 *   2. Set `pushEnabled: true` in NotificationPrefs
 *   3. Call `initPushNotifications()` once at app startup (e.g. in _layout.tsx)
 *   4. Call `schedulePushFromInsights(insights)` after generating insights
 *
 * Until expo-notifications is installed, all functions are safe no-ops.
 * In-app insight cards work independently without this service.
 */

import { Platform } from 'react-native';
import { SmartInsight } from '../types';

// ── Graceful import — won't crash if package isn't installed ─────────────────
let Notifications: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch {
  // Package not installed — in-app insights still work perfectly fine
}

// ── Notification channel colours ─────────────────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  awareness:  '#3B82F6',
  budget:     '#F59E0B',
  protection: '#EF4444',
  motivation: '#10B981',
};

// ── Initialise ────────────────────────────────────────────────────────────────
export async function initPushNotifications(): Promise<string | null> {
  if (!Notifications || Platform.OS === 'web') return null;

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('financial-insights', {
      name:        'Financial Insights',
      importance:  Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:  '#10B981',
    });
  }

  // Request permissions
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Get push token (for future server-side notifications)
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

// ── Schedule local notifications from insights ────────────────────────────────
export async function schedulePushFromInsights(insights: SmartInsight[]): Promise<void> {
  if (!Notifications) return;

  // Cancel previously scheduled insight notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule the top 3 insights as local notifications
  const toSchedule = insights.filter(i => i.severity !== 'info').slice(0, 3);

  for (let i = 0; i < toSchedule.length; i++) {
    const ins = toSchedule[i];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: ins.title,
        body:  ins.message,
        color: CHANNEL_COLORS[ins.category] ?? '#10B981',
        data:  { route: ins.actionRoute, insightId: ins.id },
      },
      trigger: {
        seconds: (i + 1) * 5, // stagger by 5 seconds
      },
    });
  }
}

// ── Daily morning summary ─────────────────────────────────────────────────────
export async function scheduleDailySummary(
  message: string,
  hour = 9,
): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💰 Your daily financial summary',
      body:  message,
      color: '#10B981',
    },
    trigger: {
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

// ── Cancel all scheduled notifications ───────────────────────────────────────
export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Check permission status ───────────────────────────────────────────────────
export async function hasNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
