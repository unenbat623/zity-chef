import express from 'express';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && !isGuestId(req.user?.id));
}

// Relative "N цаг/өдөр" label from a timestamp (Mongolian).
function avatarFor(name: string, url?: string | null): string {
  if (url) return url;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'chef')}`;
}

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
  // `id` is the author's user id — the client needs it to open their profile
  // and to address a direct-message thread at a person rather than a name.
  user: { id: string; name: string; avatar: string };
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
/** Demo-mode social graph: "<followerId>->:<followingId>". */
const memoryFollows = new Set<string>();
const followKey = (follower: string, following: string) => `${follower}->${following}`;

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
      user: { id: p.user_id, name: p.author_name, avatar: avatarFor(p.author_name, p.author_avatar) },
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
      user: { id: uid, name: authorName, avatar: avatarFor(authorName, authorAvatar) },
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
    user: { id: data.user_id, name: data.author_name, avatar: avatarFor(data.author_name, data.author_avatar) },
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

// ── Stories ───────────────────────────────────────────────────────────────────
interface MemStory {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  image: string | null;
  caption: string | null;
  sticker: string | null;
  createdAt: number;
}
const memoryStories: MemStory[] = [];

function groupStories(
  rows: { user_id: string; author_name: string; author_avatar: string | null; id: string; image_url: string | null; caption: string | null; sticker: string | null; created_at: string }[],
  meId: string
) {
  const groups = new Map<string, any>();
  for (const r of rows) {
    if (!groups.has(r.user_id)) {
      groups.set(r.user_id, {
        id: r.user_id,
        userName: r.author_name,
        userAvatar: avatarFor(r.author_name, r.author_avatar),
        isOwn: r.user_id === meId,
        seen: false,
        stories: [],
      });
    }
    groups.get(r.user_id).stories.push({
      id: r.id,
      img: r.image_url || undefined,
      caption: r.caption || undefined,
      sticker: r.sticker || undefined,
      createdAt: relativeTime(r.created_at),
    });
  }
  return [...groups.values()];
}

// ── GET /api/community/stories ────────────────────────────────────────────────
router.get('/stories', async (req: AuthenticatedRequest, res) => {
  const meId = req.user!.id;

  if (!usesDb(req)) {
    const rows = memoryStories.map((s) => ({
      user_id: s.userId,
      author_name: s.authorName,
      author_avatar: s.authorAvatar,
      id: s.id,
      image_url: s.image,
      caption: s.caption,
      sticker: s.sticker,
      created_at: new Date(s.createdAt).toISOString(),
    }));
    return res.json({ groups: groupStories(rows, meId), source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const { data, error } = await db
    .from('stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Community Stories Error]', error.message);
    return res.status(502).json({ error: 'Failed to load stories' });
  }
  return res.json({ groups: groupStories(data || [], meId), source: 'supabase' });
});

// ── POST /api/community/stories ───────────────────────────────────────────────
router.post('/stories', async (req: AuthenticatedRequest, res) => {
  const { imageUrl = null, caption = null, sticker = null, authorName = 'Zity Chef', authorAvatar = '' } = req.body;
  const uid = req.user!.id;

  if (!usesDb(req)) {
    const story: MemStory = {
      id: `mem-${Date.now()}`,
      userId: uid,
      authorName,
      authorAvatar,
      image: imageUrl,
      caption,
      sticker,
      createdAt: Date.now(),
    };
    memoryStories.unshift(story);
    return res.status(201).json({ ok: true, source: 'memory' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const { error } = await db.from('stories').insert({
    user_id: uid,
    author_name: authorName,
    author_avatar: authorAvatar,
    image_url: imageUrl,
    caption,
    sticker,
  });
  if (error) {
    console.error('[Community Story Create Error]', error.message);
    return res.status(502).json({ error: 'Failed to create story' });
  }
  return res.status(201).json({ ok: true, source: 'supabase' });
});

// ── Social graph (public profile + follow) ────────────────────────────────────

const UUID_RE = /^[0-9a-fA-F-]{8,64}$/;

/** Resolves the ":id" path segment, where "me" means the caller. */
function resolveTarget(req: AuthenticatedRequest): string {
  const raw = req.params.id;
  return raw === 'me' ? req.user!.id : raw;
}

/**
 * GET /api/community/users/:id — a chef's public profile.
 *
 * `profiles` is owner-only under RLS, so another chef's identity is derived
 * from what they already made public (their posts). `?name=` / `?avatar=`
 * carry the values the client is already rendering, used for a user whose
 * posts have all been deleted.
 */
router.get('/users/:id', async (req: AuthenticatedRequest, res) => {
  const meId = req.user!.id;
  const targetId = resolveTarget(req);
  const fallbackName = typeof req.query.name === 'string' ? req.query.name : 'Zity Chef';
  const fallbackAvatar = typeof req.query.avatar === 'string' ? req.query.avatar : '';

  if (!usesDb(req)) {
    const posts = memoryPosts.filter((p) => p.user.id === targetId);
    const keys = [...memoryFollows];
    return res.json({
      user: {
        id: targetId,
        name: posts[0]?.user.name || fallbackName,
        avatar: posts[0]?.user.avatar || avatarFor(fallbackName, fallbackAvatar),
      },
      stats: {
        posts: posts.length,
        followers: keys.filter((k) => k.endsWith(`->${targetId}`)).length,
        following: keys.filter((k) => k.startsWith(`${targetId}->`)).length,
        likes: posts.reduce((sum, p) => sum + p.likes, 0),
      },
      isFollowing: memoryFollows.has(followKey(meId, targetId)),
      isMe: targetId === meId,
      posts,
      source: 'memory',
    });
  }

  if (!UUID_RE.test(targetId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const [postsResult, followersResult, followingResult, isFollowingResult] = await Promise.all([
    db
      .from('community_posts')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(24),
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
    db
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', meId)
      .eq('following_id', targetId)
      .maybeSingle(),
  ]);

  if (postsResult.error) {
    console.error('[Community Profile Error]', postsResult.error.message);
    return res.status(502).json({ error: 'Failed to load profile' });
  }

  const rows = postsResult.data || [];
  const ids = rows.map((p) => p.id);
  // Skipping the query on an empty feed matters: `.in('post_id', [])` is a
  // syntax error for a uuid column, not an empty result.
  const { data: likes } = ids.length
    ? await db.from('post_likes').select('post_id, user_id').in('post_id', ids)
    : { data: [] as { post_id: string; user_id: string }[] };

  const posts: FeedPost[] = rows.map((p) => {
    const postLikes = (likes || []).filter((l) => l.post_id === p.id);
    return {
      id: p.id,
      user: { id: p.user_id, name: p.author_name, avatar: avatarFor(p.author_name, p.author_avatar) },
      image: p.image_url,
      caption: p.caption,
      recipe: null,
      likes: postLikes.length,
      liked: postLikes.some((l) => l.user_id === meId),
      saved: false,
      time: relativeTime(p.created_at),
      comments: [],
    };
  });

  return res.json({
    user: {
      id: targetId,
      name: rows[0]?.author_name || fallbackName,
      avatar: avatarFor(rows[0]?.author_name || fallbackName, rows[0]?.author_avatar || fallbackAvatar),
    },
    stats: {
      posts: posts.length,
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
      likes: posts.reduce((sum, p) => sum + p.likes, 0),
    },
    isFollowing: Boolean(isFollowingResult.data),
    isMe: targetId === meId,
    posts,
    source: 'supabase',
  });
});

// ── POST /api/community/users/:id/follow ─────────────────────────────────────
router.post('/users/:id/follow', async (req: AuthenticatedRequest, res) => {
  const meId = req.user!.id;
  const targetId = resolveTarget(req);
  const follow = req.body?.follow !== false;

  if (targetId === meId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  if (!usesDb(req)) {
    const key = followKey(meId, targetId);
    if (follow) memoryFollows.add(key);
    else memoryFollows.delete(key);
    return res.json({
      following: follow,
      followers: [...memoryFollows].filter((k) => k.endsWith(`->${targetId}`)).length,
      source: 'memory',
    });
  }

  if (!UUID_RE.test(targetId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const db = getSupabaseForUser(req.accessToken!);
  const { error } = follow
    ? await db.from('user_follows').upsert({ follower_id: meId, following_id: targetId })
    : await db.from('user_follows').delete().eq('follower_id', meId).eq('following_id', targetId);
  if (error) {
    console.error('[Community Follow Error]', error.message);
    return res.status(502).json({ error: 'Failed to update follow' });
  }

  const { count } = await db
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', targetId);
  return res.json({ following: follow, followers: count ?? 0, source: 'supabase' });
});

export default router;
