import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useEmergency, usePlant } from '../api/hooks';
import { mapsUrl, telUrl } from '../lib/links';
import { PetEmergencyScreen } from '../screens/emergency/PetEmergencyScreen';

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Opens a link, and shrugs when the device has nothing to open it with (a tablet with no phone). */
const open = (url: string | null) => {
  if (url) void Linking.openURL(url).catch(() => {});
};

/**
 * Never blank: with a missing pet, a failed lookup or a lookup still running, the screen shows the
 * safe actions (find a vet nearby) instead of waiting for the data.
 */
export default function PetEmergencyRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ petId: string; plantId?: string; speciesId?: string }>();
  const petId = first(params.petId);
  const plantId = first(params.plantId);
  const speciesId = first(params.speciesId);
  const emergency = useEmergency(
    {
      petId: petId ?? '',
      ...(plantId ? { plantId } : null),
      ...(speciesId ? { speciesId } : null),
    },
    petId != null,
  );
  // The plant's nickname when it came from a plant; the species name when it came from a label.
  const plant = usePlant(plantId ?? '', plantId != null);
  const info = emergency.data ?? null;
  const backLabel = plant.data?.nickname ?? (info ? capitalise(info.speciesName) : undefined);
  return (
    <PetEmergencyScreen
      info={info}
      loading={emergency.isLoading}
      backLabel={backLabel}
      onCallVet={() => open(info?.vet ? telUrl(info.vet.phone) : null)}
      onCallPoisonLine={() => open(info?.poisonLine ? telUrl(info.poisonLine.phone) : null)}
      onFindVet={() => open(mapsUrl('vet'))}
      onSaveVet={() => router.push('/settings/household')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
