import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useHousehold, useSpeciesCard } from '../../../api/hooks';
import { SpeciesCardScreen } from '../../../screens/collection/SpeciesCardScreen';

/** A species in the Plantdex (4ai, 4aj). A species that cannot be loaded goes back to the Collection. */
export default function SpeciesCardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const card = useSpeciesCard(id);
  const household = useHousehold();
  if (card.isError) return <Redirect href="/collection" />;
  if (!card.data) return null;
  const speciesId = card.data.species.id;
  return (
    <>
      <StatusBar style="light" />
      <SpeciesCardScreen
        card={card.data}
        pets={household.data?.pets ?? []}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/collection'))}
        onSeeOnMap={() => router.navigate('/collection?segment=map')}
        // A confirmed species from the Plantdex: no `match`, so the emergency states its verdict.
        onPetAte={(petId) =>
          router.push({ pathname: '/pet-emergency', params: { petId, speciesId } })
        }
      />
    </>
  );
}
