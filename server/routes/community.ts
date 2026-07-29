import express from 'express';
import { AuthenticatedRequest, authenticateToken, GUEST_ID } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && req.user?.id !== GUEST_ID);
}

// Relative "N цаг/өдөр" label from a timestamp (Mongolian).
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Дөнгөж сая';
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} цаг`;
  return `${Math.floor(hr / 24)} өдөр`;
}

interface Comment {
  user: string;
  text: string;
}
interface FeedPost {
  id: string;
  user: { name: string; avatar: string };
  image: string | null;
  caption: string;
  recipe: null;
  likes: number;
  liked: boolean;
  saved: boolean;
  time: string;
  comments: Comment[];
}

// ── In-memory demo feed (shared, used only when Supabase is unconfigured) ──────
const memoryPosts: FeedPost[] = [];

// ── GET /api/community/posts ──────────────────────────────────────────────────
router.get('/posts', async (req: AuthenticatedRequest, res) => {
  if (!usesDb(req)) {
    return res.json({ posts: memoryPosts, source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const uid = req.user!.id;

  const { data: posts, error } = await db
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[Community Feed Error]', error.message);
    return res.status(502).json({ error: 'Failed to load feed' });
  }

  const ids = (posts || []).map((p) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    db.from('post_likes').select('post_id, user_id').in('post_id', ids.length ? ids : ['none']),
    db
      .from('post_comments')
      .select('post_id, author_name, text')
      .in('post_id', ids.length ? ids : ['none'])
      .order('created_at', { ascending: true }),
  ]);

  const feed: FeedPost[] = (posts || []).map((p) => {
    const postLikes = (likes || []).filter((l) => l.post_id === p.id);
    return {
      id: p.id,
      user: { name: p.author_name, avatar: p.author_avatar || '' },
      image: p.image_url,
      caption: p.caption,
      recipe: null,
      likes: postLikes.length,
      liked: postLikes.some((l) => l.user_id === uid),
      saved: false,
      time: relativeTime(p.created_at),
      comments: (comments || [])
        .filter((c) => c.post_id === p.id)
        .map((c) => ({ user: c.author_name, text: c.text })),
    };
  });

  return res.json({ posts: feed, source: 'supabase' });
});

// ── POST /api/community/posts ─────────────────────────────────────────────────
router.post('/posts', async (req: AuthenticatedRequest, res) => {
  const { caption = '', imageUrl = null, authorName = 'Zity Chef', authorAvatar = '' } = req.body;
  const uid = req.user!.id;

  if (!usesDb(req)) {
    const post: FeedPost = {
      id: `mem-${Date.now()}`,
      user: { name: authorName, avatar: authorAvatar },
      image: imageUrl,
      caption,
      recipe: null,
      likes: 0,
      liked: false,
      saved: false,
      time: 'Дөнгөж сая',
      comments: [],
    };
    memoryPosts.unshift(post);
    return res.status(201).json({ post, source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const { data, error } = await db
    .from('community_posts')
    .insert({
      user_id: uid,
      author_name: authorName,
      author_avatar: authorAvatar,
      image_url: imageUrl,
      caption,
    })
    .select()
    .single();
  if (error) {
    console.error('[Community Create Error]', error.message);
    return res.status(502).json({ error: 'Failed to create post' });
  }

  const post: FeedPost = {
    id: data.id,
    user: { name: data.author_name, avatar: data.author_avatar || '' },
    image: data.image_url,
    caption: data.caption,
    recipe: null,
    likes: 0,
    liked: false,
    saved: false,
    time: 'Дөнгөж сая',
    comments: [],
  };
  return res.status(201).json({ post, source: 'supabase' });
});

// ── POST /api/community/posts/:id/like ───────────────────────────────────────
router.post('/posts/:id/like', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { liked } = req.body as { liked: boolean };
  const uid = req.user!.id;

  if (!usesDb(req)) {
    const post = memoryPosts.find((p) => p.id === id);
    if (post) {
      post.liked = liked;
      post.likes = Math.max(0, post.likes + (liked ? 1 : -1));
    }
    return res.json({ success: true, source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  if (liked) {
    await db.from('post_likes').upsert({ post_id: id, user_id: uid });
  } else {
    await db.from('post_likes').delete().eq('post_id', id).eq('user_id', uid);
  }
  return res.json({ success: true, source: 'supabase' });
});

// ── POST /api/community/posts/:id/comments ───────────────────────────────────
router.post('/posts/:id/comments', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { text, authorName = 'Хэрэглэгч' } = req.body;
  const uid = req.user!.id;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  if (!usesDb(req)) {
    const post = memoryPosts.find((p) => p.id === id);
    if (post) post.comments.push({ user: authorName, text });
    return res.status(201).json({ comment: { user: authorName, text }, source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const { error } = await db
    .from('post_comments')
    .insert({ post_id: id, user_id: uid, author_name: authorName, text });
  if (error) {
    console.error('[Community Comment Error]', error.message);
    return res.status(502).json({ error: 'Failed to add comment' });
  }
  return res.status(201).json({ comment: { user: authorName, text }, source: 'supabase' });
});

export default router;
