import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAppToday, useHouseholds, usePlants, useProfile } from '../../../api/hooks';
import { useStartScan } from '../../../components';
import { MyPlantsScreen } from '../../../screens/plants/MyPlantsScreen';

export default function PlantsRoute() {
  const router = useRouter();
  const households = useHouseholds();
  const profile = useProfile();
  const today = useAppToday();
  const startScan = useStartScan();
  const [chosen, setChosen] = useState<string | null>(null);
  const householdId = chosen ?? households.data?.[0]?.id ?? '';
  const plants = usePlants(householdId);

  if (!households.data || !plants.data) return null;
  return (
    <MyPlantsScreen
      households={households.data}
      householdId={householdId}
      plants={plants.data}
      today={today}
      avatarLetter={profile.data?.displayName.charAt(0).toUpperCase() ?? ''}
      onSwitch={setChosen}
      onOpen={(id) => router.push(`/plants/${id}`)}
      onAdd={startScan}
      onScan={startScan}
      onScanLabel={() => router.push('/camera?mode=label')}
      onAvatar={() => router.push('/profile')}
    />
  );
}
