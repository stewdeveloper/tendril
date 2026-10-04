import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Snackbar } from '../../components';
import { useSavePets } from '../../api/hooks';
import { PetsScreen } from '../../screens/onboarding/PetsScreen';

export default function PetsRoute() {
  const router = useRouter();
  const savePets = useSavePets();
  const [failed, setFailed] = useState(false);
  return (
    <>
      <PetsScreen
        saving={savePets.isPending}
        onBack={() => router.back()}
        onContinue={async (pets) => {
          setFailed(false);
          try {
            await savePets.mutateAsync(pets);
            router.push('/home-area');
          } catch {
            setFailed(true);
          }
        }}
      />
      {failed ? <Snackbar text="Couldn't save your pets. Try again." /> : null}
    </>
  );
}
