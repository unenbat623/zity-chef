import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const REALTIME_TABLES = [
  'profiles',
  'inventory_items',
  'orders',
  'meal_plans',
  'chat_sessions',
  'store_products',
  'community_posts',
  'post_likes',
  'post_comments',
  'stories',
  'direct_messages',
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number];
type RealtimeStatus = 'disabled' | 'connecting' | 'connected' | 'error';

const invalidateByTable: Record<RealtimeTable, string[][]> = {
  profiles: [['chef', 'dashboard']],
  inventory_items: [['inventory']],
  orders: [['orders'], ['chef', 'dashboard']],
  meal_plans: [['mealPlans']],
  chat_sessions: [['chat']],
  store_products: [
    ['store', 'products'],
    ['chef', 'dashboard'],
  ],
  community_posts: [['community', 'feed']],
  post_likes: [['community', 'feed']],
  post_comments: [['community', 'feed']],
  stories: [['community', 'stories']],
  direct_messages: [['directMessages']],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { user, configured } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('disabled');
  const userId = user?.id;

  useEffect(() => {
    if (!configured || !supabase || !userId) {
      setStatus('disabled');
      return;
    }

    setStatus('connecting');

    const channel = REALTIME_TABLES.reduce(
      (nextChannel, table) => {
        return nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          invalidateByTable[table].forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
        });
      },
      // `user` itself gets a new identity on every session refresh (including
      // silent token refreshes), which used to tear down and resubscribe this
      // 11-table channel on each one — depending on just the id avoids that.
      supabase.channel(`zity-live-${userId}`)
    );

    channel.subscribe((nextStatus) => {
      if (nextStatus === 'SUBSCRIBED') setStatus('connected');
      if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') setStatus('error');
      if (nextStatus === 'CLOSED') setStatus('disabled');
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, queryClient, userId]);

  return { tables: REALTIME_TABLES, status };
}
