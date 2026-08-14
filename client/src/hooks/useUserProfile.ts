import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';
import type { FeedPost } from './useCommunity';

export interface PublicProfile {
  user: { id: string; name: string; avatar: string };
  stats: { posts: number; followers: number; following: number; likes: number };
  isFollowing: boolean;
  isMe: boolean;
  posts: FeedPost[];
}

export interface ProfileTarget {
  /** Supabase user id, or "me" for the signed-in user. */
  id?: string;
  name: string;
  avatar?: string;
}

async function fetchProfile(target: ProfileTarget): Promise<PublicProfile> {
  const params = new URLSearchParams({ name: target.name });
  if (target.avatar) params.set('avatar', target.avatar);
  const res = await authedFetch(`/api/community/users/${encodeURIComponent(target.id!)}?${params}`);
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

/**
 * A chef's public profile — their posts, follower counts and whether the
 * signed-in user follows them. Disabled (and left in `isLoading`) for a peer we
 * only know by name, e.g. a legacy post with no author id.
 */
export function useUserProfile(target: ProfileTarget | null, onFollowError?: () => void) {
  const queryClient = useQueryClient();
  const enabled = Boolean(target?.id);
  const queryKey = ['community', 'user', target?.id ?? ''];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchProfile(target!),
    enabled,
    staleTime: 15_000,
  });

  const followMutation = useMutation({
    mutationFn: async (follow: boolean) => {
      const res = await authedFetch(`/api/community/users/${encodeURIComponent(target!.id!)}/follow`, {
        method: 'POST',
        body: JSON.stringify({ follow }),
      });
      if (!res.ok) throw new Error('Failed to update follow');
      return res.json() as Promise<{ following: boolean; followers: number }>;
    },
    // Follow is a one-tap toggle, so it has to flip instantly and roll back on
    // failure rather than wait out a round-trip.
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PublicProfile>(queryKey);
      if (previous) {
        queryClient.setQueryData<PublicProfile>(queryKey, {
          ...previous,
          isFollowing: follow,
          stats: {
            ...previous.stats,
            followers: Math.max(0, previous.stats.followers + (follow ? 1 : -1)),
          },
        });
      }
      return { previous };
    },
    onError: (_err, _follow, context) => {
      // Roll the toggle back, and say so — a button that silently flips itself
      // back looks like the tap missed.
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      onFollowError?.();
    },
    onSuccess: (data) => {
      const current = queryClient.getQueryData<PublicProfile>(queryKey);
      if (current) {
        queryClient.setQueryData<PublicProfile>(queryKey, {
          ...current,
          isFollowing: data.following,
          stats: { ...current.stats, followers: data.followers },
        });
      }
      // The viewer's own "following" total changed too.
      queryClient.invalidateQueries({ queryKey: ['community', 'user', 'me'] });
    },
  });

  return {
    profile: query.data ?? null,
    loading: enabled && query.isLoading,
    error: query.isError,
    unavailable: !enabled,
    toggleFollow: () => {
      if (!query.data || query.data.isMe) return;
      followMutation.mutate(!query.data.isFollowing);
    },
    followPending: followMutation.isPending,
  };
}

/** The signed-in user's own social counters, for the profile screen. */
export function useMySocialStats(name: string) {
  const query = useQuery({
    queryKey: ['community', 'user', 'me'],
    queryFn: () => fetchProfile({ id: 'me', name }),
    staleTime: 15_000,
  });
  return query.data?.stats ?? null;
}
