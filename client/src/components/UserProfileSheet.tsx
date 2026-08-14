import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, UserCheck, MessageSquare, Grid3x3, Heart, Loader2 } from 'lucide-react';
import { SmartImage } from './SmartImage';
import { useToast } from './Toast';
import { useApp } from '../context/AppContext';
import { useUserProfile } from '../hooks/useUserProfile';
import type { CommunityUser } from '../types';

// ── One stat cell in the header row ───────────────────────────────────────────
const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex-1 text-center">
    <p className="text-base font-black text-pestle-text tabular-nums">{value}</p>
    <p className="text-[10px] font-bold text-gray-400 mt-0.5">{label}</p>
  </div>
);

/**
 * A chef's public profile: their posts, follower counts, and the follow /
 * message actions. Opened by tapping any avatar or name in the community feed,
 * the story player or the chat header.
 */
export const UserProfileSheet: React.FC<{
  target: CommunityUser;
  onClose: () => void;
  onMessage: (user: CommunityUser) => void;
}> = ({ target, onClose, onMessage }) => {
  const { t } = useApp();
  const { toastWarning } = useToast();
  const { profile, loading, error, unavailable, toggleFollow, followPending } = useUserProfile(
    target,
    () => toastWarning(t('userProfile_followFailedTitle'), t('userProfile_followFailedBody'))
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = profile?.user.name || target.name;
  const avatar = profile?.user.avatar || target.avatar;
  const stats = profile?.stats;
  const isFollowing = Boolean(profile?.isFollowing);
  const canFollow = Boolean(profile) && !profile!.isMe;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('userProfile_title')}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[360] flex items-end sm:items-center justify-center sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-pestle-card border border-pestle-border rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Cover — the app accent is user-configurable, so this stays a single
            brand colour rather than a gradient that can clash with it. */}
        <div className="relative h-24 bg-mango shrink-0">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-8 -right-6 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-8 w-32 h-32 bg-black/15 rounded-full blur-2xl" />
          </div>
          <button
            onClick={onClose}
            aria-label={t('chat_close')}
            className="absolute top-3 right-3 w-8 h-8 bg-black/25 hover:bg-black/45 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          {/* The avatar lives in the cover, not in the scrolling body: pulled up
              with a negative margin it was clipped by the body's overflow. */}
          <img
            src={avatar}
            alt={name}
            className="absolute -bottom-10 left-5 w-20 h-20 rounded-3xl border-4 border-pestle-card object-cover shadow-xl bg-pestle-bg"
          />
        </div>

        <div className="px-5 pb-5 pt-12 flex-1 overflow-y-auto">
          <div>
            <h3 className="text-base font-black text-pestle-text truncate">{name}</h3>
            <span className="text-[10px] font-bold text-mango-ink bg-mango/12 px-2 py-0.5 rounded-full inline-block mt-1">
              👨‍🍳 {t('userProfile_chefBadge')}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-stretch gap-1 mt-4 bg-pestle-bg border border-pestle-border rounded-2xl py-3">
            {stats || unavailable ? (
              <>
                <Stat value={stats?.posts ?? 0} label={t('userProfile_posts')} />
                <div className="w-px bg-pestle-border" />
                <Stat value={stats?.followers ?? 0} label={t('userProfile_followers')} />
                <div className="w-px bg-pestle-border" />
                <Stat value={stats?.following ?? 0} label={t('userProfile_following')} />
                <div className="w-px bg-pestle-border" />
                <Stat value={stats?.likes ?? 0} label={t('userProfile_likes')} />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 animate-pulse">
                  <div className="h-4 w-8 bg-pestle-border/60 rounded" />
                  <div className="h-2 w-10 bg-pestle-border/40 rounded" />
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 mt-4">
            {canFollow && (
              <button
                onClick={toggleFollow}
                disabled={followPending}
                aria-pressed={isFollowing}
                className={`flex-1 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 ${
                  isFollowing
                    ? 'bg-pestle-bg border border-pestle-border text-pestle-text hover:border-mango'
                    : 'btn-primary shadow-lg shadow-mango/20'
                }`}
              >
                {followPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isFollowing ? (
                  <UserCheck size={14} />
                ) : (
                  <UserPlus size={14} />
                )}
                {isFollowing ? t('userProfile_unfollow') : t('userProfile_follow')}
              </button>
            )}

            {profile?.isMe ? (
              <div className="flex-1 py-3 rounded-2xl text-xs font-bold text-center text-gray-400 bg-pestle-bg border border-pestle-border">
                {t('userProfile_you')}
              </div>
            ) : (
              <button
                onClick={() => onMessage({ ...target, name, avatar })}
                className="flex-1 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 bg-pestle-bg border border-pestle-border text-pestle-text hover:border-mango transition-colors"
              >
                <MessageSquare size={14} className="text-mango-ink" />
                {t('userProfile_message')}
              </button>
            )}
          </div>

          {/* Posts */}
          <div className="mt-5">
            <h4 className="text-[11px] font-black text-gray-400 flex items-center gap-1.5 mb-2.5">
              <Grid3x3 size={13} /> {t('userProfile_postsSection')}
            </h4>

            {loading && (
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-pestle-bg animate-pulse" />
                ))}
              </div>
            )}

            {(error || unavailable) && (
              <p className="text-xs font-semibold text-gray-400 text-center py-6">
                {unavailable ? t('userProfile_unavailable') : t('userProfile_loadError')}
              </p>
            )}

            {profile && profile.posts.length === 0 && (
              <p className="text-xs font-semibold text-gray-400 text-center py-6">
                {t('userProfile_noPosts')}
              </p>
            )}

            {profile && profile.posts.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {profile.posts.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square rounded-xl overflow-hidden bg-pestle-bg border border-pestle-border relative group"
                  >
                    {post.image ? (
                      <SmartImage
                        src={post.image}
                        alt={post.caption}
                        emoji="🍽️"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="p-2 text-[9px] font-semibold text-pestle-text line-clamp-4 leading-snug">
                        {post.caption}
                      </p>
                    )}
                    {post.likes > 0 && (
                      <span className="absolute bottom-1 right-1 text-[9px] font-black text-white bg-black/55 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Heart size={8} className="fill-white" /> {post.likes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
