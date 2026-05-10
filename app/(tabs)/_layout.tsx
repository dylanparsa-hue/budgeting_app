import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';

interface TabIconProps {
  icon:     string;
  label:    string;
  focused:  boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Text style={styles.tabEmoji}>{icon}</Text>
      {focused && <Text style={styles.tabLabel}>{label}</Text>}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:    false,
        tabBarShowLabel: false,
        tabBarStyle:    styles.tabBar,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📋" label="Transactions" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🎯" label="Budgets" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="⭐" label="Goals" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height:          Platform.OS === 'ios' ? 88 : 68,
    paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
    paddingTop:      Spacing[2],
    backgroundColor: Colors.white,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       8,
  },
  tabItem: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[0.5],
    paddingHorizontal: Spacing[3],
    paddingVertical:   Spacing[1.5],
    borderRadius:   20,
    minWidth:       56,
  },
  tabItemActive: {
    backgroundColor: Colors.primaryLight,
    flexDirection:   'row',
    gap:             Spacing[1.5],
  },
  tabEmoji: {
    fontSize: 22,
  },
  tabLabel: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
});
