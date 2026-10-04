import { inviteShareMessage, leaguesCopy, normaliseHandle } from '@tendril/core';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { useCreateInvite, useFindHandle, useProfile, useSendFriendRequest } from '../../api/hooks';
import { AddFriendsScreen } from '../../screens/leagues/AddFriendsScreen';

const NOTICE_MS = 5000;

/**
 * Add friends. The search runs on submit with the handle normalised, and keeps only the one
 * match. A request or an invite that is in flight ignores a second tap.
 */
export default function AddFriendsRoute() {
  const router = useRouter();
  const profile = useProfile();
  const find = useFindHandle();
  const send = useSendFriendRequest();
  const invite = useCreateInvite();
  // Handles asked this visit. Never cleared, so searching again can't offer Add twice.
  const [requested, setRequested] = useState<ReadonlySet<string>>(new Set());
  // Searching for yourself needs no lookup: the answer is already here.
  const [self, setSelf] = useState<{ handle: string; plantdexCount: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const adding = useRef(false);
  const inviting = useRef(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const search = (query: string) => {
    const handle = normaliseHandle(query);
    if (!handle) return;
    const own = profile.data;
    if (own && handle === own.handle.toLowerCase()) {
      setSelf({ handle: own.handle, plantdexCount: own.plantdexCount });
      return;
    }
    setSelf(null);
    find.mutate(handle, { onError: () => setNotice(leaguesCopy.searchFailed) });
  };

  const add = async (handle: string) => {
    if (adding.current) return;
    adding.current = true;
    try {
      await send.mutateAsync(handle);
      setRequested((prev) => new Set(prev).add(handle.toLowerCase()));
    } catch {
      setNotice(leaguesCopy.requestFailed);
    } finally {
      adding.current = false;
    }
  };

  const sendInvite = async () => {
    if (inviting.current) return;
    inviting.current = true;
    try {
      const { url } = await invite.mutateAsync();
      // Dismissing the share sheet can reject; that is not an error worth showing.
      await Share.share({ message: inviteShareMessage(url) }).catch(() => {});
    } catch {
      setNotice(leaguesCopy.inviteFailed);
    } finally {
      inviting.current = false;
    }
  };

  const looked = find.data === undefined ? null : find.data === null ? 'not_found' : find.data;
  const result = self ?? looked;
  return (
    <AddFriendsScreen
      query=""
      result={result}
      ownHandle={profile.data?.handle ?? ''}
      requested={
        result != null && result !== 'not_found' && requested.has(result.handle.toLowerCase())
      }
      notice={notice}
      onEdit={() => {
        setSelf(null);
        find.reset();
      }}
      onQuery={search}
      onAdd={(handle) => void add(handle)}
      onInvite={() => void sendInvite()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/leagues'))}
    />
  );
}
