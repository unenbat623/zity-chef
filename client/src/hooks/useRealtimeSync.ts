import { useEffect, useMemo, useState } from 'react';
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

  const realtimeTables = useMemo(() => REALTIME_TABLES, []);

  useEffect(() => {
    if (!configured || !supabase || !user) {
      setStatus('disabled');
      return;
    }

    setStatus('connecting');

    const channel = realtimeTables.reduce(
      (nextChannel, table) => {
        return nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          invalidateByTable[table].forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
        });
      },
      supabase.channel(`zity-live-${user.id}`)
    );

    channel.subscribe((nextStatus) => {
      if (nextStatus === 'SUBSCRIBED') setStatus('connected');
      if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') setStatus('error');
      if (nextStatus === 'CLOSED') setStatus('disabled');
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, queryClient, realtimeTables, user]);

  return { tables: realtimeTables, status };
}
