-- ════════════════════════════════════════════════════════════════════════════
-- direct_messages: pin the conversation_id format and match on it exactly.
--
-- The read policy was `position(auth.uid()::text in conversation_id) > 0` — a
-- substring test against a free-text column. It happens to be safe for the ids
-- the client generates today (`dm:<uuidA>|<uuidB>`, sorted), but nothing
-- enforced that shape, so any future writer could craft a conversation_id that
-- merely *contains* another user's uuid and pull their messages into scope.
--
-- This makes the format a constraint and the policy an exact comparison
-- against the two participant slots.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Enforce the id shape ───────────────────────────────────────────────────
-- NOT VALID: new and updated rows are checked from now on; pre-existing rows
-- are left alone so the migration cannot fail on legacy data.
DO $$ BEGIN
  ALTER TABLE public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_format
    CHECK (
      conversation_id ~ '^dm:[0-9a-fA-F-]{36}\|[0-9a-fA-F-]{36}$'
      -- Participants are stored in sorted order, so one pair of users maps to
      -- exactly one conversation id rather than two.
      AND split_part(substring(conversation_id from 4), '|', 1)
          < split_part(substring(conversation_id from 4), '|', 2)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Exact-match policies ───────────────────────────────────────────────────
-- The caller must BE one of the two participants, not merely appear somewhere
-- in the string.
DROP POLICY IF EXISTS "dm_read" ON public.direct_messages;
CREATE POLICY "dm_read" ON public.direct_messages
  FOR SELECT USING (
    auth.uid()::text IN (
      split_part(substring(conversation_id from 4), '|', 1),
      split_part(substring(conversation_id from 4), '|', 2)
    )
  );

DROP POLICY IF EXISTS "dm_insert" ON public.direct_messages;
CREATE POLICY "dm_insert" ON public.direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND auth.uid()::text IN (
      split_part(substring(conversation_id from 4), '|', 1),
      split_part(substring(conversation_id from 4), '|', 2)
    )
  );
