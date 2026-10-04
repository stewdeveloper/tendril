import { setShareMessage } from '@tendril/core';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Share } from 'react-native';
import { useSets } from '../../../../api/hooks';
import { SetCompleteScreen } from '../../../../screens/collection/SetCompleteScreen';

/** A completed set (4al): Share carries a line about it, Continue goes to the Collection. */
export default function SetCompleteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sets = useSets();
  if (sets.isError) return <Redirect href="/collection" />;
  const set = sets.data?.find((s) => s.id === id);
  if (!sets.data) return null;
  if (!set) return <Redirect href="/collection" />;
  return (
    <>
      <StatusBar style="dark" />
      <SetCompleteScreen
        setName={set.name}
        total={set.total}
        onShare={() => void Share.share({ message: setShareMessage(set.name, set.total) })}
        onContinue={() => router.replace('/collection')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/collection'))}
      />
    </>
  );
}
