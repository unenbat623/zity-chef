-- One query for a page of the community feed.
--
-- The feed used to read the newest 50 posts, then *every* like row and *every*
-- comment row belonging to them, and count them in JavaScript. A single popular
-- post was enough to drag thousands of rows across the wire to produce one
-- number, and the feed could never show more than those 50 posts because there
-- was no way to ask for the next page.
--
-- SECURITY INVOKER on purpose: the caller's RLS policies still decide what is
-- visible, and `auth.uid()` is the signed-in reader, so `liked` is theirs.

CREATE OR REPLACE FUNCTION public.community_feed(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  author_name text,
  author_avatar text,
  image_url text,
  caption text,
  recipe_id text,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked boolean,
  recent_comments jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.author_name,
    p.author_avatar,
    p.image_url,
    p.caption,
    p.recipe_id,
    p.created_at,
    (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id) AS comment_count,
    EXISTS (
      SELECT 1 FROM public.post_likes l WHERE l.post_id = p.id AND l.user_id = auth.uid()
    ) AS liked,
    -- The three newest comments, oldest first so they read as a conversation.
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('user', c.author_name, 'text', c.text) ORDER BY c.created_at)
        FROM (
          SELECT c2.author_name, c2.text, c2.created_at
          FROM public.post_comments c2
          WHERE c2.post_id = p.id
          ORDER BY c2.created_at DESC
          LIMIT 3
        ) c
      ),
      '[]'::jsonb
    ) AS recent_comments
  FROM public.community_posts p
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.community_feed(integer, integer) TO authenticated, anon, service_role;

-- The feed reads likes and comments by post on every page.
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
