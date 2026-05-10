import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { session, isHydrated } = useAuthStore();

  if (!isHydrated) return null;

  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />;
}
