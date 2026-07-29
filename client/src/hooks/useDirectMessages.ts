import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  sender: string; // 'Би' for the current user, otherwise the sender's name
  text: string;
  time: string; // HH:MM
}

function hhmm(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Realtime direct-message thread with a given recipient.
 * - With Supabase configured: messages persist and stream live over Supabase
 *   Realtime (works across tabs / real recipients).
 * - Without it (demo mode): a local thread with a canned reply, so the UI still
 *   works offline.
 */
export function useDirectMessages(recipientName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const uidRef = useRef<string | null>(null);
  const nameRef = useRef<string>('Би');
  const convRef = useRef<string>('');
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    if (!supabase) {
      // Demo fallback — seed a short local thread.
      setMessages([
        { id: 'l1', sender: recipientName, text: 'Сайн уу! Өнөөдөр ямар амттай хоол хийж байна?', time: '14:20' },
      ]);
      setReady(true);
      return;
    }

    (async () => {
      const { data } = await supabase!.auth.getUser();
      if (!active) return;
      const uid = data.user?.id || '';
      uidRef.current = uid;
      nameRef.current =
        (data.user?.user_metadata?.full_name as string) || data.user?.email?.split('@')[0] || 'Би';
      // Deterministic conversation id embedding my uid (RLS checks for it).
      const conv = `dm:${[uid, `name:${recipientName}`].sort().join('|')}`;
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
          sender: r.sender_id === uid ? 'Би' : r.sender_name,
          text: r.text,
          time: hhmm(r.created_at),
        };
      });
      setMessages(initial);
      setReady(true);

      // Subscribe to new inserts. RLS already limits delivery to this user's
      // conversations; we match conversation_id client-side because the id
      // contains characters (":", "|", Cyrillic) that break the server filter.
      const channel = supabase!
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
              { id: r.id, sender: r.sender_id === uid ? 'Би' : r.sender_name, text: r.text, time: hhmm(r.created_at) },
            ]);
          }
        )
        .subscribe();

      return () => {
        supabase!.removeChannel(channel);
      };
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientName]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (!supabase || !convRef.current) {
        // Demo fallback: local echo + canned reply.
        setMessages((prev) => [...prev, { id: `l-${Date.now()}`, sender: 'Би', text: trimmed, time: hhmm() }]);
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `r-${Date.now()}`, sender: recipientName, text: 'Үнэхээр гоё! Жороо явуулаарай 👨‍🍳', time: hhmm() },
          ]);
        }, 1000);
        return;
      }

      const { data } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: convRef.current,
          sender_id: uidRef.current,
          sender_name: nameRef.current,
          text: trimmed,
        })
        .select()
        .single();
      if (data && !seen.current.has(data.id)) {
        seen.current.add(data.id);
        setMessages((prev) => [...prev, { id: data.id, sender: 'Би', text: data.text, time: hhmm(data.created_at) }]);
      }
    },
    [recipientName]
  );

  return { messages, send, ready };
}
