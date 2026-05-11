import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform,
  TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';

const TABS = [
  { name: 'index',        label: 'Dashboard'    },
  { name: 'budgets',      label: 'Categories'   },
  { name: 'transactions', label: 'Transactions' },
  { name: 'goals',        label: 'Savings'      },
];

function TabButton({
  label, focused, tabWidth, onPress,
}: {
  label: string; focused: boolean; tabWidth: number; onPress: () => void;
}) {
  const C     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.tab, { width: tabWidth }]}
      activeOpacity={1}
      onPress={press}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text
          style={[
            styles.label,
            { color: focused ? C.primary : C.textTertiary },
            focused && styles.labelFocused,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const C   = useTheme();
  const sw  = Dimensions.get('window').width;
  const BAR = sw - 32;
  const TW  = BAR / TABS.length;

  const pillX    = useRef(new Animated.Value(state.index * TW)).current;
  const barScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide the active pill
    Animated.spring(pillX, {
      toValue:         state.index * TW,
      useNativeDriver: true,
      speed:           22,
      bounciness:      7,
    }).start();
    // Tiny squeeze-and-release on the whole bar so it feels alive
    Animated.sequence([
      Animated.spring(barScale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(barScale, { toValue: 1,    useNativeDriver: true, speed: 18, bounciness: 10 }),
    ]).start();
  }, [state.index, TW]);

  const bottom = Platform.OS === 'ios' ? 28 : 16;
  const barBg  = C.isDark ? '#1E2D3D' : '#FFFFFF';

  return (
    // Outer shell: carries the glow + drop shadow (no overflow:hidden so shadows render)
    <Animated.View
      style={[
        styles.barShell,
        {
          width:           BAR,
          bottom,
          left:            16,
          transform:       [{ scale: barScale }],
          backgroundColor: barBg,
          // Primary-coloured glow (iOS renders coloured shadows)
          shadowColor:     C.primary,
          shadowOpacity:   C.isDark ? 0.45 : 0.28,
          shadowRadius:    18,
          shadowOffset:    { width: 0, height: 4 },
          // Crisp border for frosted separation
          borderColor:     C.isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(255,255,255,0.95)',
        },
      ]}
    >
      {/* Android glow layer (elevation only does black; fake green glow with a tinted halo) */}
      {Platform.OS === 'android' && (
        <View style={[styles.androidGlow, { backgroundColor: C.primary, opacity: C.isDark ? 0.18 : 0.12 }]} />
      )}

      {/* Inner clipping view — overflow:hidden clips the sliding pill without killing the outer glow */}
      <View style={[styles.barInner, { backgroundColor: barBg }]}>
        {/* Sliding active pill */}
        <Animated.View
          style={[
            styles.activePill,
            {
              width:           TW - 8,
              backgroundColor: C.primary + '28',
              transform:       [{ translateX: Animated.add(pillX, new Animated.Value(4)) }],
            },
          ]}
        />

        {TABS.map((tab, i) => (
          <TabButton
            key={tab.name}
            label={tab.label}
            focused={state.index === i}
            tabWidth={TW}
            onPress={() => {
              const ev = navigation.emit({
                type:              'tabPress',
                target:            state.routes[i].key,
                canPreventDefault: true,
              });
              if (state.index !== i && !ev.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"        />
      <Tabs.Screen name="budgets"      />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="goals"        />
      <Tabs.Screen name="plan"         options={{ href: null }} />
      <Tabs.Screen name="profile"      options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Outer shell — NO overflow:hidden so the coloured glow shadow is visible
  barShell: {
    position:      'absolute',
    height:        56,
    borderRadius:  28,
    borderWidth:   1,
    // Android drop shadow (black only, handled via elevation)
    elevation:     18,
  },
  // Android tinted halo sits behind the inner bar
  androidGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  // Inner view — clips the sliding pill, matches shell exactly
  barInner: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    borderRadius:  28,
    overflow:      'hidden',
  },
  activePill: {
    position:     'absolute',
    top:          6,
    bottom:       6,
    borderRadius: 20,
  },
  tab: {
    height:         '100%',
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0.1,
  },
  labelFocused: {
    fontWeight: '800',
  },
});
