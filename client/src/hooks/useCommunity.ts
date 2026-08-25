import { useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

/**
 * Turns HTTP errors into rejected mutations. Without this every mutationFn
 * resolved on a 500 — onSuccess fired, the optimistic UI stuck around, and the
 * change silently vanished on the next poll.
 */
async function okOrThrow(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res;
}

export interface FeedComment {
  user: string;
  text: string;
}
export interface FeedPost {
  id: string;
  /** `id` is the author's user id — opens their profile and addresses DMs. */
  user: { id?: string; name: string; avatar: string };
  image: string | null;
  caption: string;
  recipe: unknown;
  likes: number;
  liked: boolean;
  saved: boolean;
  time: string;
  comments: FeedComment[];
}

const FEED_PAGE_SIZE = 20;

interface FeedPage {
  posts: FeedPost[];
  nextOffset: number | null;
}

async function fetchFeedPage(offset: number): Promise<FeedPage> {
  const res = await authedFetch(`/api/community/posts?limit=${FEED_PAGE_SIZE}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to load feed');
  const data = await res.json();
  const posts: FeedPost[] = data.posts || [];
  return {
    posts,
    nextOffset: data.hasMore ? Number(data.nextOffset ?? offset + posts.length) : null,
  };
}

async function fetchStories(): Promise<any[]> {
  const res = await authedFetch('/api/community/stories');
  if (!res.ok) throw new Error('Failed to load stories');
  const data = await res.json();
  return data.groups || [];
}

// Shared frozen fallbacks. Returning a fresh `[]` while a query is loading or
// errored gives every render a new array identity, which makes consumers'
// `useEffect([feedPosts])` re-fire forever ("Maximum update depth exceeded").
const NO_POSTS: FeedPost[] = [];
const NO_STORY_GROUPS: any[] = [];

export function useCommunity() {
  const queryClient = useQueryClient();

  // Paged rather than "the newest 50, for ever": older posts were unreachable,
  // and every poll re-fetched the whole feed.
  const query = useInfiniteQuery({
    queryKey: ['community', 'feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextOffset,
    // A poll refetches *every* loaded page, so a reader five pages deep was
    // pulling five requests every ten seconds. Realtime already invalidates
    // this query on new posts, likes and comments, so the timer is only a
    // fallback — and `maxPages` caps what any refetch can cost.
    refetchInterval: 60_000,
    maxPages: 5,
    refetchOnWindowFocus: true,
  });
  const storiesQuery = useQuery({
    queryKey: ['community', 'stories'],
    queryFn: fetchStories,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const createStoryMutation = useMutation({
    mutationFn: (payload: {
      imageUrl?: string | null;
      caption?: string | null;
      sticker?: string | null;
      authorName: string;
      authorAvatar?: string;
    }) =>
      authedFetch('/api/community/stories', { method: 'POST', body: JSON.stringify(payload) }).then(
        okOrThrow
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', 'stories'] }),
  });

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      authedFetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        body: JSON.stringify({ liked }),
      }).then(okOrThrow),
    // A failed like must not look applied — refetch snaps the UI back.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
  });

  const commentMutation = useMutation({
    mutationFn: ({
      postId,
      text,
      authorName,
    }: {
      postId: string;
      text: string;
      authorName: string;
    }) =>
      authedFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, authorName }),
      }).then(okOrThrow),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
  });

  const createPostMutation = useMutation({
    mutationFn: (payload: {
      caption: string;
      imageUrl?: string | null;
      authorName: string;
      authorAvatar?: string;
    }) =>
      authedFetch('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then(okOrThrow),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
  });

  const feedPosts = useMemo(
    () => query.data?.pages.flatMap((page) => page.posts) ?? NO_POSTS,
    [query.data]
  );

  return {
    feedPosts,
    feedLoading: query.isLoading,
    hasMorePosts: query.hasNextPage,
    loadingMorePosts: query.isFetchingNextPage,
    loadMorePosts: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    serverStoryGroups: storiesQuery.data ?? NO_STORY_GROUPS,
    persistStory: (payload: {
      imageUrl?: string | null;
      caption?: string | null;
      sticker?: string | null;
      authorName: string;
      authorAvatar?: string;
    }) => createStoryMutation.mutate(payload),
    // Fire-and-forget persistence — the component keeps optimistic local state.
    persistLike: (postId: string, liked: boolean) => likeMutation.mutate({ postId, liked }),
    persistComment: (postId: string, text: string, authorName: string) =>
      commentMutation.mutate({ postId, text, authorName }),
    persistPost: (payload: {
      caption: string;
      imageUrl?: string | null;
      authorName: string;
      authorAvatar?: string;
    }) => createPostMutation.mutate(payload),
  };
}
