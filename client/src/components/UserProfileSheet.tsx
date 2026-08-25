import React from 'react';
import { m } from 'motion/react';
import {
  X,
  UserPlus,
  UserCheck,
  MessageSquare,
  Grid3x3,
  Users,
  Heart,
  Loader2,
} from 'lucide-react';
import { StatRow, PostsGrid } from './ProfileParts';
import { SmartImage } from './SmartImage';
import { useToast } from './Toast';
import { useApp } from '../context/AppContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';
import type { CommunityUser } from '../types';

/**
 * A chef's public profile: their posts, follower counts, and the follow /
 * message actions. Opened by tapping any avatar or name in the community feed,
 * the story player or the chat header.
 *
 * Deliberately laid out like the signed-in user's own Profile tab — same cover,
 * same avatar shape, same stat card, same post grid — so the two read as one
 * screen with different actions.
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

  useEscapeClose(onClose);
  useScrollLock(true);

  const name = profile?.user.name || target.name;
  const avatar = profile?.user.avatar || target.avatar;
  const stats = profile?.stats;
  const isFollowing = Boolean(profile?.isFollowing);
  const canFollow = Boolean(profile) && !profile!.isMe;

  const statItems = [
    { label: t('userProfile_posts'), value: stats?.posts ?? 0, icon: Grid3x3 },
    { label: t('userProfile_followers'), value: stats?.followers ?? 0, icon: Users },
    { label: t('userProfile_following'), value: stats?.following ?? 0, icon: UserPlus },
    { label: t('userProfile_likes'), value: stats?.likes ?? 0, icon: Heart },
  ];

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('userProfile_title')}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[360] flex items-end sm:items-center justify-center sm:p-4"
    >
      <m.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-pestle-card border border-pestle-border rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col"
      >
        {/* Cover — the app accent is user-configurable, so this stays a single
            brand colour rather than a gradient that can clash with it. */}
        <div className="relative h-28 bg-mango shrink-0">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-14 -left-8 w-36 h-36 bg-black/15 rounded-full blur-2xl" />
          </div>

          {/* Grab handle — this is a bottom sheet on phones. */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/40 sm:hidden" />

          <button
            onClick={onClose}
            aria-label={t('chat_close')}
            className="absolute top-3 right-3 w-8 h-8 bg-black/25 hover:bg-black/45 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>

          {/* The avatar lives in the cover, not in the scrolling body: pulled up
              with a negative margin it was clipped by the body's overflow. */}
          <div className="absolute -bottom-11 left-5">
            {/* SmartImage, not a bare <img>: these avatars are remote (dicebear
                / Google) and a failed or rate-limited load left a blank hole
                where the face should be. */}
            <SmartImage
              src={avatar}
              alt=""
              emoji="👨‍🍳"
              className="w-[88px] h-[88px] rounded-3xl border-4 border-pestle-card shadow-xl bg-pestle-bg"
            />
            {isFollowing && (
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-2xl bg-mango text-white border-2 border-pestle-card shadow-md flex items-center justify-center">
                <UserCheck size={13} />
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pb-sheet-safe sm:pb-6 pt-14 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <h3 className="text-lg font-black text-pestle-text truncate tracking-tight">{name}</h3>
          <span className="text-[10px] font-bold text-mango-ink bg-mango/12 px-2 py-0.5 rounded-full inline-block mt-1.5">
            👨‍🍳 {t('userProfile_chefBadge')}
          </span>

          <div className="mt-4">
            <StatRow items={statItems} loading={loading} />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 mt-3">
            {canFollow && (
              <button
                onClick={toggleFollow}
                disabled={followPending}
                aria-pressed={isFollowing}
                className={`flex-1 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 active:scale-[0.98] ${
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
                className="flex-1 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 bg-pestle-bg border border-pestle-border text-pestle-text hover:border-mango transition-colors active:scale-[0.98]"
              >
                <MessageSquare size={14} className="text-mango-ink" />
                {t('userProfile_message')}
              </button>
            )}
          </div>

          {/* Posts */}
          <div className="mt-6">
            <h4 className="text-[11px] font-black text-gray-400 flex items-center gap-1.5 mb-2.5">
              <Grid3x3 size={13} /> {t('userProfile_postsSection')}
            </h4>

            {loading && <PostsGrid posts={[]} loading />}

            {(error || unavailable) && (
              <p className="text-xs font-semibold text-gray-400 text-center py-6">
                {unavailable ? t('userProfile_unavailable') : t('userProfile_loadError')}
              </p>
            )}

            {profile && profile.posts.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-pestle-bg border border-pestle-border flex items-center justify-center mx-auto text-gray-400">
                  <Grid3x3 size={20} />
                </div>
                <p className="text-xs font-semibold text-gray-400">{t('userProfile_noPosts')}</p>
              </div>
            )}

            {profile && profile.posts.length > 0 && <PostsGrid posts={profile.posts} />}
          </div>
        </div>
      </m.div>
    </m.div>
  );
};
