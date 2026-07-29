import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

export interface FeedComment {
  user: string;
  text: string;
}
export interface FeedPost {
  id: string;
  user: { name: string; avatar: string };
  image: string | null;
  caption: string;
  recipe: unknown;
  likes: number;
  liked: boolean;
  saved: boolean;
  time: string;
  comments: FeedComment[];
}

async function fetchFeed(): Promise<FeedPost[]> {
  const res = await authedFetch('/api/community/posts');
  if (!res.ok) throw new Error('Failed to load feed');
  const data = await res.json();
  return data.posts || [];
}

export function useCommunity() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['community', 'feed'], queryFn: fetchFeed });

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      authedFetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        body: JSON.stringify({ liked }),
      }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ postId, text, authorName }: { postId: string; text: string; authorName: string }) =>
      authedFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, authorName }),
      }),
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
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
  });

  return {
    feedPosts: query.data ?? [],
    feedLoading: query.isLoading,
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
