import { plantsCopy, type PlantStatus } from '@tendril/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Linking, Platform, View } from 'react-native';
import {
  useAppToday,
  useHousehold,
  usePlant,
  useSetPlantStatus,
  useToday,
} from '../../../../api/hooks';
import { Snackbar, useHideTabBar } from '../../../../components';
import { PlantDetailScreen } from '../../../../screens/plants/PlantDetailScreen';
import { DiedCauseSheet, PlantActionsSheet } from '../../../../screens/plants/PlantStatusSheets';

type Menu = 'actions' | 'cause' | null;

export default function PlantDetailRoute() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const plant = usePlant(id);
  const household = useHousehold();
  const today = useAppToday();
  const tasks = useToday();
  const setStatus = useSetPlantStatus();
  const [menu, setMenu] = useState<Menu>(null);
  const [failed, setFailed] = useState(false);

  // A plant that has died or been given away shows no tab bar (4k, 4l).
  useHideTabBar(plant.data != null && plant.data.status !== 'alive');

  const change = async (status: PlantStatus, deathCause?: string) => {
    setMenu(null);
    setFailed(false);
    try {
      await setStatus.mutateAsync({ id, status, deathCause });
    } catch {
      setFailed(true);
    }
  };

  const openMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [plantsCopy.markDied, plantsCopy.givenAway, plantsCopy.cancel],
          cancelButtonIndex: 2,
          destructiveButtonIndex: 0,
          title: plant.data?.nickname,
        },
        (index) => {
          if (index === 0) setMenu('cause');
          else if (index === 1) void change('given_away');
        },
      );
    } else {
      setMenu('actions');
    }
  };

  const checkIn = () => {
    const task = tasks.data?.tasks.find((t) => t.plantId === id && t.kind === 'check');
    router.navigate({ pathname: '/today', params: task ? { checkIn: task.id } : {} });
  };

  if (!plant.data || !household.data) return null;
  return (
    <View style={{ flex: 1 }}>
      <PlantDetailScreen
        plant={plant.data}
        pets={household.data.pets}
        today={today}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/plants'))}
        onMore={openMenu}
        onCheckIn={checkIn}
        onPetAte={(petId) =>
          router.push({ pathname: '/pet-emergency', params: { petId, plantId: id } })
        }
        onSourcePress={(url) => void Linking.openURL(url)}
      />
      <PlantActionsSheet
        visible={menu === 'actions'}
        nickname={plant.data.nickname}
        onDied={() => setMenu('cause')}
        onGivenAway={() => void change('given_away')}
        onClose={() => setMenu(null)}
      />
      {menu === 'cause' ? (
        <DiedCauseSheet
          visible
          saving={setStatus.isPending}
          onConfirm={(cause) => void change('dead', cause)}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {failed ? <Snackbar text={plantsCopy.statusFailed} withTabBar /> : null}
    </View>
  );
}
