import type { QuotaKind } from '@tendril/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiProvider';
import type { TendrilApi } from './types';

type Input<K extends keyof TendrilApi> = Parameters<TendrilApi[K]>[0];

/**
 * Query keys, one place so a mutation can name what it changes. A key is a prefix: invalidating
 * `['plant']` refreshes every plant's detail, `['plants']` every household's list.
 */
export const queryKeys = {
  today: ['today'],
  streaks: ['streaks'],
  plants: (householdId: string) => ['plants', householdId],
  plant: (id: string) => ['plant', id],
  quota: (kind: QuotaKind) => ['quota', kind],
  scanResult: (id: string) => ['scanResult', id],
  outcome: (id: string) => ['outcome', id],
  plantdex: (filter: string) => ['plantdex', filter],
  speciesCard: (id: string) => ['speciesCard', id],
  sets: ['sets'],
  finds: ['finds'],
  badges: ['badges'],
  league: ['league'],
  friends: ['friends'],
  weekResult: ['weekResult'],
  profile: ['profile'],
  household: ['household'],
  entitlement: ['entitlement'],
  label: (code: string) => ['label', code],
  emergency: (input: Input<'getEmergency'>) => ['emergency', input],
} as const;

export const useToday = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.today, queryFn: () => api.getToday() });
};
export const useStreaks = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.streaks, queryFn: () => api.getStreaks() });
};
export const usePlants = (householdId: string) => {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.plants(householdId),
    queryFn: () => api.getPlants(householdId),
  });
};
export const usePlant = (id: string) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.plant(id), queryFn: () => api.getPlant(id) });
};
export const useQuota = (kind: QuotaKind) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.quota(kind), queryFn: () => api.getQuota(kind) });
};
export const useScanResult = (id: string) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.scanResult(id), queryFn: () => api.getScanResult(id) });
};
export const useOutcome = (id: string) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.outcome(id), queryFn: () => api.getOutcome(id) });
};
export const usePlantdex = (filter: 'all' | 'houseplant' | 'wild') => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.plantdex(filter), queryFn: () => api.getPlantdex(filter) });
};
export const useSpeciesCard = (id: string) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.speciesCard(id), queryFn: () => api.getSpeciesCard(id) });
};
export const useSets = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.sets, queryFn: () => api.getSets() });
};
export const useFinds = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.finds, queryFn: () => api.getFinds() });
};
export const useBadges = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.badges, queryFn: () => api.getBadges() });
};
export const useLeague = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.league, queryFn: () => api.getLeague() });
};
export const useFriends = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.friends, queryFn: () => api.getFriends() });
};
export const useWeekResult = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.weekResult, queryFn: () => api.getWeekResult() });
};
export const useProfile = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => api.getProfile() });
};
export const useHousehold = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.household, queryFn: () => api.getHousehold() });
};
export const useEntitlement = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.entitlement, queryFn: () => api.getEntitlement() });
};
export const useLabel = (code: string) => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.label(code), queryFn: () => api.getLabel(code) });
};
export const useEmergency = (input: Input<'getEmergency'>) => {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.emergency(input),
    queryFn: () => api.getEmergency(input),
  });
};

/** Refreshes every key whose first segment is one of `roots`. */
function useInvalidate() {
  const client = useQueryClient();
  return (roots: readonly string[]) =>
    client.invalidateQueries({
      predicate: (query) => roots.includes(String(query.queryKey[0])),
    });
}

export const useCheckIn = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'checkIn'>) => api.checkIn(input),
    // A check-in moves the plant's next check, finishes its task, may add a watering task, and
    // extends the care streak.
    onSuccess: () => invalidate(['today', 'streaks', 'plants', 'plant', 'profile']),
  });
};

export const useConfirmScan = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'confirmScan'>) => api.confirmScan(input),
    // A find or a new plant lands in the Plantdex and sets, may score on the boards, and has its
    // own outcome. The scan also used one identification.
    onSuccess: () =>
      invalidate([
        'plants',
        'plant',
        'today',
        'plantdex',
        'speciesCard',
        'sets',
        'finds',
        'badges',
        'league',
        'friends',
        'weekResult',
        'profile',
        'outcome',
        'scanResult',
        'quota',
      ]),
  });
};

export const useAddPlant = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'addPlant'>) => api.addPlant(input),
    onSuccess: () => invalidate(['plants', 'plant', 'today']),
  });
};

export const useStartPreview = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.startPreview(),
    // The preview raises both monthly limits.
    onSuccess: () => invalidate(['entitlement', 'quota', 'today']),
  });
};
