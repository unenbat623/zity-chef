import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  sender: string; // display name of the author
  mine: boolean;
  text: string;
  time: string; // HH:MM
  createdAt: string; // ISO — drives the day separators
  status?: 'sending' | 'sent' | 'failed';
}

export interface ChatRecipient {
  /** Supabase user id. Absent only for a peer we know by name alone. */
  id?: string;
  name: string;
}

function hhmm(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

let tempSeq = 0;

/**
 * Realtime direct-message thread with a given recipient.
 * - With Supabase configured: messages persist and stream live over Supabase
 *   Realtime (works across tabs / real recipients).
 * - Without it (demo mode): a local thread with a canned reply, so the UI still
 *   works offline.
 */
export function useDirectMessages(recipient: ChatRecipient) {
  const { id: recipientId, name: recipientName } = recipient;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const uidRef = useRef<string | null>(null);
  const nameRef = useRef<string>('Би');
  const convRef = useRef<string>('');
  const seen = useRef<Set<string>>(new Set());
  // Mirrors `messages` so retry() can read the failed text without depending on
  // the state value (which would re-create every callback on each new message).
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    setMessages([]);
    setReady(false);
    seen.current = new Set();

    if (!supabase) {
      // Demo fallback — start empty so the empty state (not a fake thread) is
      // what a first-time conversation shows.
      setReady(true);
      return;
    }

    (async () => {
      const { data } = await supabase!.auth.getUser();
      if (!active) return;
      const uid = data.user?.id || '';
      // Signed out with Supabase configured: every insert would be rejected by
      // RLS (no uid to put in the conversation id), so leave convRef empty and
      // let send() take the local demo path instead of failing on each message.
      if (!uid) {
        setReady(true);
        return;
      }
      uidRef.current = uid;
      nameRef.current =
        (data.user?.user_metadata?.full_name as string) || data.user?.email?.split('@')[0] || 'Би';
      // Deterministic conversation id containing BOTH participants' uids — RLS
      // grants access to whoever appears in it. Keying it by the recipient's
      // *name* (as it used to be) put only the sender's uid in the id, so the
      // recipient could never read the thread and every chat was one-way.
      const peer = recipientId || `name:${recipientName}`;
      const conv = `dm:${[uid, peer].sort().join('|')}`;
      convRef.current = conv;

      // Load history.
      const { data: rows } = await supabase!
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conv)
        .order('created_at', { ascending: true });
      if (!active) return;
      const initial = (rows || []).map((r) => {
        seen.current.add(r.id);
        return {
          id: r.id,
          sender: r.sender_id === uid ? nameRef.current : r.sender_name,
          mine: r.sender_id === uid,
          text: r.text,
          time: hhmm(r.created_at),
          createdAt: r.created_at,
          status: 'sent' as const,
        };
      });
      setMessages(initial);
      setReady(true);

      // Subscribe to new inserts. RLS already limits delivery to this user's
      // conversations; we match conversation_id client-side because the id
      // contains characters (":", "|", Cyrillic) that break the server filter.
      channel = supabase!
        .channel(`dm-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'direct_messages' },
          (payload) => {
            const r = payload.new as any;
            if (r.conversation_id !== conv || seen.current.has(r.id)) return;
            seen.current.add(r.id);
            setMessages((prev) => [
              ...prev,
              {
                id: r.id,
                sender: r.sender_id === uid ? nameRef.current : r.sender_name,
                mine: r.sender_id === uid,
                text: r.text,
                time: hhmm(r.created_at),
                createdAt: r.created_at,
                status: 'sent',
              },
            ]);
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      // The channel is created after an await, so it may not exist yet when a
      // fast close runs this — tearing it down here still covers every case
      // where it does, and `active` stops the late subscribe from mattering.
      if (channel) supabase?.removeChannel(channel);
    };
  }, [recipientId, recipientName]);

  /** Writes a message that is already in local state, or marks it failed. */
  const deliver = useCallback(async (tempId: string, text: string) => {
    if (!supabase || !convRef.current) {
      // Local development without Supabase: the message stays on this device.
      // It used to be answered by a canned reply attributed to the recipient,
      // so the thread showed words the other person never wrote.
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' as const } : m))
      );
      return;
    }

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: convRef.current,
        sender_id: uidRef.current,
        sender_name: nameRef.current,
        text,
      })
      .select()
      .single();

    // A failed insert used to be swallowed: the bubble stayed on screen as if
    // it had been delivered and silently vanished on the next open.
    if (error || !data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m))
      );
      return;
    }

    seen.current.add(data.id);
    setMessages((prev) => {
      // Realtime can deliver our own INSERT before this promise resolves. If
      // it already did, drop the optimistic copy instead of renaming it onto
      // an id that is now on screen twice (duplicate React keys).
      if (prev.some((m) => m.id === data.id)) return prev.filter((m) => m.id !== tempId);
      return prev.map((m) =>
        m.id === tempId
          ? {
              ...m,
              id: data.id,
              time: hhmm(data.created_at),
              createdAt: data.created_at,
              status: 'sent',
            }
          : m
      );
    });
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const tempId = `tmp-${now}-${tempSeq++}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender: nameRef.current,
          mine: true,
          text: trimmed,
          time: hhmm(now),
          createdAt: now,
          status: 'sending',
        },
      ]);
      void deliver(tempId, trimmed);
    },
    [deliver]
  );

  /** Re-sends a message whose insert failed. */
  const retry = useCallback(
    (messageId: string) => {
      const target = messagesRef.current.find((m) => m.id === messageId);
      if (!target) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'sending' as const } : m))
      );
      void deliver(messageId, target.text);
    },
    [deliver]
  );

  return { messages, send, retry, ready };
}
