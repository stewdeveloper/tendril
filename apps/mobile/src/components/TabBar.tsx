import { typeScale } from '@tendril/core';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, fontFamilyFor, useTheme } from '../theme';
import {
  CalendarIcon,
  CollectionIcon,
  PlantsIcon,
  ScanCameraIcon,
  TrophyIcon,
  type IconProps,
} from './icons';

export type TabKey = 'today' | 'plants' | 'scan' | 'collection' | 'leagues';

const TABS: { key: TabKey; label: string; Icon: ComponentType<IconProps> }[] = [
  { key: 'today', label: 'Today', Icon: CalendarIcon },
  { key: 'plants', label: 'My Plants', Icon: PlantsIcon },
  { key: 'scan', label: 'Scan', Icon: ScanCameraIcon },
  { key: 'collection', label: 'Collection', Icon: CollectionIcon },
  { key: 'leagues', label: 'Leagues', Icon: TrophyIcon },
];

/** Inter 13/16, 600 for the active tab and 500 for the rest (2e). */
const LABEL_FONT = {
  active: fontFamilyFor({ ...typeScale.caption, weight: '600' }),
  inactive: fontFamilyFor(typeScale.caption),
};

export interface TabBarViewProps {
  active: TabKey;
  onTab: (tab: Exclude<TabKey, 'scan'>) => void;
  /** Scan opens the camera over the tabs; it never becomes the selected tab. */
  onScan: () => void;
}

/**
 * The design's tab bar (2e): 90 pt on the surface colour with a hairline above it, five equal
 * columns with labels always showing, and Scan as a raised 60 pt circle with a surface-coloured
 * ring. The hairline is drawn above the bar rather than as a border, as the frame draws it, so the
 * bar's own height stays 90.
 */
export function TabBarView({ active, onTab, onScan }: TabBarViewProps) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.surface }]}>
      <View style={[styles.hairline, { backgroundColor: c.hairline }]} />
      {TABS.map(({ key, label, Icon }) => {
        if (key === 'scan') {
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: false }}
              onPress={onScan}
              style={({ pressed }) => [styles.item, styles.raised, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.scanCircle,
                  {
                    backgroundColor: c.primary,
                    boxShadow: `0 0 0 5px ${c.surface}, 0 4px 12px rgba(29, 36, 32, 0.18)`,
                  },
                ]}
              >
                <ScanCameraIcon size={26} color={c.onPrimary} />
              </View>
              <AppText
                variant="caption"
                color="primary"
                style={[styles.label, styles.scanLabel, { fontFamily: LABEL_FONT.inactive }]}
              >
                {label}
              </AppText>
            </Pressable>
          );
        }
        const selected = key === active;
        const color = selected ? c.primary : c.textSecondary;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onTab(key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.iconSlot}>
              <Icon size={24} color={color} />
            </View>
            <AppText
              variant="caption"
              color={color}
              style={[
                styles.label,
                { fontFamily: selected ? LABEL_FONT.active : LABEL_FONT.inactive },
              ]}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The tab a route belongs to: `today/index` and `today/streaks` are both Today. */
function tabForRoute(routeName: string | undefined): TabKey | null {
  const first = routeName?.split('/')[0];
  return TABS.find((t) => t.key === first)?.key ?? null;
}

/** Maps the router's tab state onto `TabBarView`. Used as the `tabBar` of the (tabs) layout. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const active = tabForRoute(state.routes[state.index]?.name) ?? 'today';
  return (
    <TabBarView
      active={active}
      onTab={(tab) => {
        const route = state.routes.find((r) => tabForRoute(r.name) === tab);
        if (!route) return;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
      }}
      onScan={() => router.push('/camera')}
    />
  );
}

const styles = StyleSheet.create({
  bar: { height: 90, flexDirection: 'row', paddingTop: 6 },
  hairline: { position: 'absolute', top: -1, left: 0, right: 0, height: 1 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  // The Scan column sits 28 pt higher, so the circle rises out of the bar.
  raised: { marginTop: -28 },
  pressed: { opacity: 0.6 },
  iconSlot: { height: 30, alignItems: 'center', justifyContent: 'center' },
  scanCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { lineHeight: 16 },
  scanLabel: { marginTop: 2 },
});
