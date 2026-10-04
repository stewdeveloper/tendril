import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Snackbar } from '../../components';
import { DEFAULT_RADIUS_M, type MapCenter } from '../../components/HomeAreaParts';
import { useSaveHomeArea } from '../../api/hooks';
import { findTown } from '../../lib/geocode';
import { HomeAreaScreen } from '../../screens/onboarding/HomeAreaScreen';

export default function HomeAreaRoute() {
  const router = useRouter();
  const saveArea = useSaveHomeArea();
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);
  // Null until a search lands or the map is moved: Save never stores a place nobody picked.
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);
  const [failed, setFailed] = useState(false);
  const search = async () => {
    const found = await findTown(query);
    setNotFound(found === null);
    if (found) setCenter(found);
  };
  return (
    <>
      <HomeAreaScreen
        query={query}
        onQueryChange={(text) => {
          setQuery(text);
          setNotFound(false);
        }}
        onSearch={() => void search()}
        notFound={notFound}
        center={center ?? undefined}
        onCenterChange={setCenter}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        canSave={center !== null}
        saving={saveArea.isPending}
        onBack={() => router.back()}
        onSkip={() => router.push({ pathname: '/first-scan', params: { homeArea: 'skipped' } })}
        onSave={async () => {
          if (!center) return;
          setFailed(false);
          try {
            await saveArea.mutateAsync({ lat: center.lat, lng: center.lng, radiusM });
            router.push('/first-scan');
          } catch {
            setFailed(true);
          }
        }}
      />
      {failed ? <Snackbar text="Couldn't save your area. Try again." /> : null}
    </>
  );
}
