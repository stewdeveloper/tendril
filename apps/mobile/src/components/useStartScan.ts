import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useApi } from '../api/ApiProvider';
import { queryKeys } from '../api/hooks';

/**
 * Starts a scan: from the Scan tab button and from the empty states' "Scan" buttons. Reads the
 * identification quota fresh. At the cap it goes to the Scan tab screen, which shows "Limit
 * reached" instead of a camera that could not identify anything; otherwise it opens the camera.
 * If the quota can't be read it opens the camera, and the server refuses at the cap on its own.
 */
export function useStartScan(): () => Promise<void> {
  const router = useRouter();
  const client = useQueryClient();
  const api = useApi();
  return useCallback(async () => {
    let atCap = false;
    try {
      const quota = await client.fetchQuery({
        queryKey: queryKeys.quota('identification'),
        queryFn: () => api.getQuota('identification'),
        staleTime: 0,
      });
      atCap = quota.used >= quota.limit;
    } catch {
      atCap = false;
    }
    if (atCap) router.navigate('/(tabs)/scan');
    else router.push('/camera');
  }, [api, client, router]);
}
