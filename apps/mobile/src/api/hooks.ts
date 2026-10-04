import type { IsoDate, PlantStatus, QuotaKind } from '@tendril/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiProvider';
import { FIXTURE_TODAY } from './fixture/FixtureApi';
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
  households: ['households'],
  household: ['household'],
  settings: ['settings'],
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
export const useHouseholds = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.households, queryFn: () => api.getHouseholds() });
};
export const useHousehold = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.household, queryFn: () => api.getHousehold() });
};
export const useSettings = () => {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.getSettings() });
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

export const useIdentify = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'identify'>) => api.identify(input),
    // A new scan result exists, and an identification (and with a health check a diagnosis) was used.
    onSuccess: () => invalidate(['quota', 'scanResult']),
  });
};

export const useSavePets = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (pets: Input<'savePets'>) => api.savePets(pets),
    // Every pet check reads the household's pets: the plant, a label, a scan result and a species
    // card, as does the emergency screen.
    onSuccess: () =>
      invalidate(['household', 'plant', 'label', 'scanResult', 'speciesCard', 'emergency']),
  });
};

export const useSetPlantStatus = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { id: string; status: PlantStatus; deathCause?: string }) =>
      api.setPlantStatus(input.id, input.status, input.deathCause),
    // A plant that has died or been given away leaves Today and keeps its place in the list.
    onSuccess: () => invalidate(['plants', 'plant', 'today']),
  });
};

export const useDiagnose = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'diagnose'>) => api.diagnose(input),
    onSuccess: () => invalidate(['plant', 'quota']),
  });
};

export const useApplyDiagnosis = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (diagnosisId: string) => api.applyDiagnosis(diagnosisId),
    // Applying changes the plant's care plan, and so Today's tasks.
    onSuccess: () => invalidate(['plant', 'plants', 'today', 'quota']),
  });
};

export const useSendFriendRequest = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (handle: string) => api.sendFriendRequest(handle),
    onSuccess: () => invalidate(['friends']),
  });
};

export const useDeleteAccount = () => {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAccount(),
    // Nothing cached belongs to the account any more.
    onSuccess: () => client.invalidateQueries(),
  });
};

export const useSaveHomeArea = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Input<'saveHomeArea'>) => api.saveHomeArea(input),
    onSuccess: () => invalidate(['settings']),
  });
};

export const useClearHomeArea = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.clearHomeArea(),
    onSuccess: () => invalidate(['settings']),
  });
};

export const useSetReminders = () => {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (on: boolean) => api.setReminders(on),
    onSuccess: () => invalidate(['settings']),
  });
};

/** Looks a handle up on demand: `mutateAsync(handle)` resolves to the account, or null. Nothing is cached. */
export const useFindHandle = () => {
  const api = useApi();
  return useMutation({ mutationFn: (handle: string) => api.findHandle(handle) });
};

/** Makes a friend invite link on demand. */
export const useCreateInvite = () => {
  const api = useApi();
  return useMutation({ mutationFn: () => api.createInvite() });
};

/**
 * Reads a scan's outcome once, fresh, for a container that must act on it (the new-species check
 * after a find is confirmed) rather than render it. Returns `(observationId) => Promise<Outcome>`.
 */
export const useFetchOutcome = () => {
  const api = useApi();
  const client = useQueryClient();
  return (observationId: string) =>
    client.fetchQuery({
      queryKey: queryKeys.outcome(observationId),
      queryFn: () => api.getOutcome(observationId),
    });
};

/**
 * The calendar date screens count from. The fixture API lives on the fixture's fixed day so frames
 * read the same on any date; against the real backend it is the device's local date, because
 * dates are calendar dates in the person's timezone, never UTC.
 */
export function useAppToday(): IsoDate {
  if (process.env.EXPO_PUBLIC_API_MODE !== 'supabase') return FIXTURE_TODAY;
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
