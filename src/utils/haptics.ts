import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const hapticLight    = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const hapticSelect   = () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); };
export const hapticSuccess  = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
