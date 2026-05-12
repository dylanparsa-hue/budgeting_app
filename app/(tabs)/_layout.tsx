import { Tabs } from 'expo-router';
import { useRef } from 'react';
import {
  View, Text, StyleSheet, Platform,
  TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { House, BarChart2, Target, User, Plus } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';

const TABS = [
  { name: 'index',   label: 'Home',     Icon: House    },
  { name: 'budgets', label: 'Insights', Icon: BarChart2 },
  { name: 'goals',   label: 'Goals',    Icon: Target   },
  { name: 'profile', label: 'You',      Icon: User     },
];

function TabButton({
  label, focused, tabWidth, onPress, Icon,
}: {
  label: string; focused: boolean; tabWidth: number; onPress: () => void;
  Icon: React.ComponentType<any>;
}) {
  const C     = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
    onPress();
  };

  const iconColor = focused ? (C.isDark ? C.primary : C.black) : C.textTertiary;

  return (
    <TouchableOpacity
      style={[styles.tab, { width: tabWidth }]}
      activeOpacity={1}
      onPress={press}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center', gap: 3 }}>
        <Icon size={20} color={iconColor} strokeWidth={focused ? 2.5 : 2} />
        <Text
          style={[
            styles.label,
            { color: iconColor },
            focused && styles.labelFocused,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {focused && (
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const LEFT_TABS  = [TABS[0], TABS[1]]; // Home, Insights
const RIGHT_TABS = [TABS[2], TABS[3]]; // Goals, You

function CustomTabBar({ state, navigation }: any) {
  const C      = useTheme();
  const sw     = Dimensions.get('window').width;
  const BAR    = sw - 32;
  const FAB_W  = 64;  // gap reserved for FAB in the center
  const SIDE_W = (BAR - FAB_W) / 2;  // width of each half
  const TW     = SIDE_W / 2;          // width per tab (2 per side)

  const bottom = Platform.OS === 'ios' ? 28 : 16;
  const barBg  = C.isDark ? C.surface : '#FFFFFF';

  const makeTabBtn = (tab: typeof TABS[0], i: number) => (
    <TabButton
      key={tab.name}
      label={tab.label}
      focused={state.index === i}
      tabWidth={TW}
      Icon={tab.Icon}
      onPress={() => {
        const ev = navigation.emit({
          type: 'tabPress',
          target: state.routes[i].key,
          canPreventDefault: true,
        });
        if (state.index !== i && !ev.defaultPrevented) {
          navigation.navigate(tab.name);
        }
      }}
    />
  );

  return (
    <View style={[styles.wrapper, { bottom, left: 16, width: BAR }]}>
      {/* Left pill: Home + Insights */}
      <View
        style={[
          styles.halfBar,
          {
            width: SIDE_W,
            left: 0,
            backgroundColor: barBg,
            shadowColor: '#0E2417',
            shadowOpacity: C.isDark ? 0.30 : 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            borderColor: C.isDark ? C.border : 'rgba(14,36,23,0.06)',
          },
        ]}
      >
        <View style={[styles.halfInner, { backgroundColor: barBg }]}>
          {LEFT_TABS.map((tab, i) => makeTabBtn(tab, i))}
        </View>
      </View>

      {/* Right pill: Goals + You */}
      <View
        style={[
          styles.halfBar,
          {
            width: SIDE_W,
            right: 0,
            backgroundColor: barBg,
            shadowColor: '#0E2417',
            shadowOpacity: C.isDark ? 0.30 : 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            borderColor: C.isDark ? C.border : 'rgba(14,36,23,0.06)',
          },
        ]}
      >
        <View style={[styles.halfInner, { backgroundColor: barBg }]}>
          {RIGHT_TABS.map((tab, i) => makeTabBtn(tab, i + 2))}
        </View>
      </View>

      {/* Floating FAB — centered between the two halves */}
      <TouchableOpacity
        onPress={() => router.push('/modals/add-transaction')}
        style={[styles.fab, { backgroundColor: C.primary }]}
        activeOpacity={0.85}
      >
        <Plus size={26} color={C.black} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
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
      <Tabs.Screen name="goals"        />
      <Tabs.Screen name="profile"      />
      <Tabs.Screen name="transactions" options={{ href: null }} />
      <Tabs.Screen name="plan"         options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    height:   64,
  },
  halfBar: {
    position:     'absolute',
    height:       60,
    borderRadius: 30,
    borderWidth:  1,
    elevation:    12,
    overflow:     'hidden',
  },
  halfInner: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    height:         '100%',
    borderRadius:   30,
    overflow:       'hidden',
    paddingHorizontal: 4,
  },
  tab: {
    height:         '100%',
    alignItems:     'center',
    justifyContent: 'center',
    paddingBottom:  2,
  },
  label: {
    ...Typography.labelSmall,
    fontSize: 11,
  },
  labelFocused: {
    fontWeight: '700',
  },
  dot: {
    width:        4,
    height:       4,
    borderRadius: 2,
    marginTop:    1,
  },
  fab: {
    position:       'absolute',
    bottom:         6,
    alignSelf:      'center',
    left:           '50%',
    marginLeft:     -28,
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#9FE870',
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.5,
    shadowRadius:   14,
    elevation:      10,
  },
});
