import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  MessageCircle,
  Send,
  Plus,
  X,
  ChefHat,
  Image,
  Sparkles,
  MessageSquare,
  Camera,
  Bookmark,
  Share2,
  ArrowLeft,
  ChevronDown,
  Check,
  RotateCw,
  Loader2,
  UserPlus,
  UserCheck,
  User,
} from 'lucide-react';
import { SmartImage } from './SmartImage';
import { UserProfileSheet } from './UserProfileSheet';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCommunity } from '../hooks/useCommunity';
import { useToast } from './Toast';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { useUserProfile } from '../hooks/useUserProfile';
import { uploadDataUrl } from '../lib/storage';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';
import { useRecipes } from '../hooks/useRecipes';
import type { CommunityUser } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StoryItem {
  id: string;
  img?: string;
  gradient?: string;
  caption?: string;
  sticker?: string;
  createdAt: string;
}

interface UserStoryGroup {
  id: string;
  userName: string;
  userAvatar: string;
  isOwn?: boolean;
  seen?: boolean;
  stories: StoryItem[];
}

const GRADIENT_PRESETS = [
  'from-amber-500 via-rose-500 to-purple-600',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-fuchsia-600 via-pink-500 to-rose-500',
  'from-blue-600 via-indigo-500 to-purple-600',
  'from-orange-500 via-amber-500 to-yellow-400',
];

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😮', '😍', '🥑', '👨‍🍳', '🎉'];

// ── FULLSCREEN INSTAGRAM STORY PLAYER ──────────────────────────────────────────
const StoryViewerModal: React.FC<{
  storyGroup: UserStoryGroup;
  allGroups: UserStoryGroup[];
  onClose: () => void;
  onSelectGroup: (group: UserStoryGroup) => void;
  onChat: (user: CommunityUser, draft?: string) => void;
  onOpenProfile: (user: CommunityUser) => void;
}> = ({ storyGroup, allGroups, onClose, onSelectGroup, onChat, onOpenProfile }) => {
  const { t } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [floatingHeart, setFloatingHeart] = useState<boolean>(false);
  const [replyText, setReplyText] = useState('');

  useEscapeClose(onClose);

  const stories = storyGroup.stories;
  const currentStory = stories[slideIndex] || stories[0];
  // Story groups are keyed by the author's user id; the local "your story"
  // group uses a placeholder, so address it as "me" instead.
  const storyUser: CommunityUser = {
    id: storyGroup.isOwn ? 'me' : storyGroup.id,
    name: storyGroup.userName,
    avatar: storyGroup.userAvatar,
  };

  // Story Timer (5s duration)
  useEffect(() => {
    if (isPaused) return;

    const DURATION = 4500; // 4.5 seconds per story
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          handleNextSlide();
          return 0;
        }
        return prev + step;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [slideIndex, isPaused, storyGroup]);

  const handleNextSlide = useCallback(() => {
    if (slideIndex < stories.length - 1) {
      setSlideIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      // Find next user story group
      const groupIdx = allGroups.findIndex((g) => g.id === storyGroup.id);
      if (groupIdx >= 0 && groupIdx < allGroups.length - 1) {
        onSelectGroup(allGroups[groupIdx + 1]);
        setSlideIndex(0);
        setProgress(0);
      } else {
        onClose();
      }
    }
  }, [slideIndex, stories.length, allGroups, storyGroup, onSelectGroup, onClose]);

  const handlePrevSlide = useCallback(() => {
    if (slideIndex > 0) {
      setSlideIndex((prev) => prev - 1);
      setProgress(0);
    } else {
      const groupIdx = allGroups.findIndex((g) => g.id === storyGroup.id);
      if (groupIdx > 0) {
        const prevGroup = allGroups[groupIdx - 1];
        onSelectGroup(prevGroup);
        setSlideIndex(prevGroup.stories.length - 1);
        setProgress(0);
      } else {
        setProgress(0);
      }
    }
  }, [slideIndex, allGroups, storyGroup, onSelectGroup]);

  // A tapped emoji lands in the reply box (and floats up) instead of being
  // swallowed by an animation that sent nothing to anyone.
  const handleSendReaction = (emoji: string) => {
    setFloatingHeart(true);
    setReplyText((prev) => prev + emoji);
    setTimeout(() => setFloatingHeart(false), 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black z-[350] flex items-center justify-center select-none"
    >
      <div
        className="w-full max-w-sm sm:max-w-md h-[100dvh] sm:h-[92dvh] sm:rounded-3xl overflow-hidden relative flex flex-col justify-between shadow-2xl bg-slate-950"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Background Image / Gradient */}
        {currentStory.img ? (
          <img
            src={currentStory.img}
            alt=""
            className="w-full h-full object-cover absolute inset-0 transition-all duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${
              currentStory.gradient || 'from-mango via-orange-500 to-amber-600'
            } absolute inset-0 flex items-center justify-center p-6 text-center text-white`}
          >
            <p className="text-xl sm:text-2xl font-black drop-shadow-md">{currentStory.caption}</p>
          </div>
        )}

        {/* Gradient Overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none" />

        {/* Floating Heart Animation on reaction */}
        <AnimatePresence>
          {floatingHeart && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -180, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none z-50 text-6xl"
            >
              ❤️
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP CONTROLS: IG Progress Segment Bars */}
        <div className="relative z-20 p-3 sm:p-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-4 space-y-3">
          <div className="flex gap-1.5 w-full">
            {stories.map((s, i) => {
              let widthVal = 0;
              if (i < slideIndex) widthVal = 100;
              else if (i === slideIndex) widthVal = progress;
              return (
                <div
                  key={s.id}
                  className="flex-1 bg-white/30 h-1 rounded-full overflow-hidden backdrop-blur-md"
                >
                  <div
                    className="bg-white h-full transition-all duration-75 ease-linear"
                    style={{ width: `${widthVal}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Info Bar — tapping the author opens their profile. */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                onOpenProfile(storyUser);
                onClose();
              }}
              className="flex items-center gap-2.5 text-left min-w-0"
            >
              <div className="p-0.5 shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600">
                <img
                  src={storyGroup.userAvatar}
                  alt={storyGroup.userName}
                  className="w-8 h-8 rounded-full border border-black object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-white text-xs font-black drop-shadow-md flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{storyGroup.userName}</span>
                  <span className="text-[10px] text-white/70 font-normal shrink-0">
                    {currentStory.createdAt}
                  </span>
                </h4>
                {currentStory.sticker && (
                  <span className="text-[9px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full backdrop-blur-md inline-block mt-0.5">
                    {currentStory.sticker}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={onClose}
              aria-label={t('chat_close')}
              className="w-8 h-8 shrink-0 bg-black/40 hover:bg-black/70 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TAP TARGETS: Left (Prev) & Right (Next) */}
        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={handlePrevSlide} />
          <div className="w-2/3 h-full cursor-pointer" onClick={handleNextSlide} />
        </div>

        {/* BOTTOM CAPTION & REACTION BAR */}
        <div className="relative z-20 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 space-y-3">
          {currentStory.img && currentStory.caption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/50 backdrop-blur-md border border-white/10 p-3 rounded-2xl text-white text-xs font-semibold leading-relaxed drop-shadow"
            >
              {currentStory.caption}
            </motion.div>
          )}

          {/* Quick Emojis Row */}
          <div className="flex justify-between items-center px-1">
            {QUICK_EMOJIS.slice(0, 6).map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform active:scale-95 p-1"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply Input Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              aria-label={t('community_replyToAria')}
              placeholder={t('community_replyTo', { name: storyGroup.userName })}
              className="flex-1 bg-white/15 backdrop-blur-md border border-white/25 rounded-full px-4 py-2.5 text-xs text-white placeholder-white/70 focus:outline-none focus:border-white"
            />
            {replyText.trim() && (
              <button
                onClick={() => {
                  // The typed reply used to be dropped on the floor here — the
                  // chat opened empty and the user had to type it again.
                  onChat(storyUser, replyText.trim());
                  onClose();
                }}
                className="bg-mango text-white px-4 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── STORY CREATOR MODAL ──────────────────────────────────────────────
const CreateStoryModal: React.FC<{
  onClose: () => void;
  onAddStory: (story: StoryItem) => void;
}> = ({ onClose, onAddStory }) => {
  const { t } = useApp();
  const [caption, setCaption] = useState('');
  const [sticker, setSticker] = useState('📍 Zity Chef Kitchen');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeClose(onClose);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePublish = () => {
    if (!imageBase64 && !caption.trim()) return;
    onAddStory({
      id: `s-${Date.now()}`,
      img: imageBase64 || undefined,
      gradient: !imageBase64 ? selectedGradient : undefined,
      caption: caption.trim() || t('community_defaultStoryCaption'),
      sticker,
      createdAt: t('community_justNow'),
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('community_createStoryTitle')}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-pestle-card border border-pestle-border rounded-t-[32px] sm:rounded-[32px] p-4 sm:p-5 pb-sheet-safe sm:pb-5 space-y-4 shadow-2xl my-auto max-h-[94dvh] overflow-y-auto overscroll-contain"
      >
        <div className="flex justify-between items-center gap-3">
          <h3 className="text-sm font-black text-pestle-text flex items-center gap-2 min-w-0">
            <Camera size={18} className="text-mango-ink shrink-0" />
            <span className="truncate">{t('community_createStoryTitle')}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label={t('community_cancel')}
            className="w-8 h-8 shrink-0 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* PREVIEW CONTAINER (Strict 9:16 ratio vertical phone style on desktop) */}
        <div className="w-48 sm:w-56 aspect-[9/16] max-h-[45dvh] mx-auto rounded-2xl overflow-hidden relative border border-pestle-border flex flex-col justify-between p-3.5 shadow-md">
          {imageBase64 ? (
            <img src={imageBase64} alt="" className="w-full h-full object-cover absolute inset-0" />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${selectedGradient} absolute inset-0 flex items-center justify-center p-4 text-center text-white`}
            >
              <p className="text-sm font-black drop-shadow-md">
                {caption || t('community_storyTextPlaceholder')}
              </p>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

          {/* Sticker Overlay */}
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-[9px] font-extrabold bg-white/20 text-white backdrop-blur-md px-2 py-0.5 rounded-full">
              {sticker}
            </span>
            {imageBase64 && (
              <button
                onClick={() => setImageBase64(null)}
                className="text-xs bg-black/40 text-white p-1 rounded-full"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Caption Overlay on preview */}
          {imageBase64 && caption && (
            <div className="relative z-10 bg-black/50 backdrop-blur-md p-2 rounded-xl text-white text-[11px] font-bold">
              {caption}
            </div>
          )}
        </div>

        {/* IMAGE UPLOAD & GRADIENT PICKER */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-w-[9rem] bg-pestle-bg border border-pestle-border py-2 px-3 rounded-xl text-xs font-bold text-pestle-text hover:border-mango flex items-center justify-center gap-2"
            >
              <Camera size={15} className="text-mango-ink shrink-0" />
              <span className="truncate">{t('community_addPhoto')}</span>
            </button>

            {/* Gradient Swatches if no image */}
            {!imageBase64 && (
              <div className="flex items-center gap-1.5 shrink-0">
                {GRADIENT_PRESETS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGradient(g)}
                    className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} border-2 ${
                      selectedGradient === g ? 'border-mango scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CAPTION & STICKERS */}
        <div className="space-y-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            aria-label={t('community_storyCaptionAria')}
            placeholder={t('community_storyCaptionPlaceholder')}
            className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[t('community_stickerUlaanbaatar'), '🍳 Zity Chef', '🥑 Healthy Food', t('community_stickerNewRecipe')].map((st) => (
              <button
                key={st}
                onClick={() => setSticker(st)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${
                  sticker === st
                    ? 'bg-mango text-white border-mango'
                    : 'bg-pestle-bg text-gray-400 border-pestle-border'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* SHARE STORY CTA */}
        <button
          onClick={handlePublish}
          className="w-full btn-primary py-3 text-xs font-bold shadow-xl shadow-mango/25 flex items-center justify-center gap-2"
        >
          <Sparkles size={16} /> {t('community_publishStory')}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ── DIRECT CHAT DRAWER ─────────────────────────────────────────────────────────

/** "Today" / "Yesterday" / "12 Mar" heading above the first message of a day. */
function dayLabel(iso: string, t: (k: string) => string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const date = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return t('chat_today');
  if (days === 1) return t('chat_yesterday');
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const DirectChatDrawer: React.FC<{
  recipient: CommunityUser;
  /** Pre-filled composer text, e.g. a reply typed on the sender's story. */
  initialText?: string;
  onClose: () => void;
  onOpenProfile: (user: CommunityUser) => void;
}> = ({ recipient, initialText = '', onClose, onOpenProfile }) => {
  const { t } = useApp();
  const { toastWarning } = useToast();
  const { messages, send, retry, ready } = useDirectMessages(recipient);
  const { profile, toggleFollow, followPending } = useUserProfile(recipient, () =>
    toastWarning(t('userProfile_followFailedTitle'), t('userProfile_followFailedBody'))
  );
  const [inputText, setInputText] = useState(initialText);
  const [atBottom, setAtBottom] = useState(true);
  const composingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canFollow = Boolean(profile) && !profile!.isMe;
  const isFollowing = Boolean(profile?.isFollowing);

  // Close on Escape, and keep the page behind the drawer from scrolling.
  // (The body never scrolls in this app — useScrollLock freezes <main>.)
  useEscapeClose(onClose);
  useScrollLock(true);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Follow new messages, but never yank the view away from someone who has
  // scrolled up to read the history.
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, atBottom, ready]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  const handleSend = (text?: string) => {
    const value = (text ?? inputText).trim();
    if (!value) return;
    send(value);
    setInputText('');
    setAtBottom(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    inputRef.current?.focus();
  };

  const openProfile = () => onOpenProfile(recipient);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={recipient.name}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[350] flex justify-end"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full bg-pestle-card sm:border-l border-pestle-border flex flex-col shadow-2xl"
      >
        {/* ── HEADER ── */}
        <div className="px-3 py-3 border-b border-pestle-border/60 flex items-center gap-2 bg-pestle-bg/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            aria-label={t('chat_close')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-pestle-text hover:bg-pestle-card transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>

          {/* The whole identity block opens the profile — the chat used to be a
              dead end with no way through to the person you were talking to. */}
          <button
            onClick={openProfile}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-2xl p-1 -m-1 hover:bg-pestle-card transition-colors"
          >
            <SmartImage
              src={recipient.avatar}
              alt=""
              emoji="👨‍🍳"
              className="w-10 h-10 rounded-full border border-pestle-border shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-pestle-text truncate">{recipient.name}</h3>
              <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                {profile
                  ? t('userProfile_followerCount', { n: profile.stats.followers })
                  : t('chat_viewProfile')}
              </span>
            </div>
          </button>

          {canFollow && (
            <button
              onClick={toggleFollow}
              disabled={followPending}
              aria-pressed={isFollowing}
              // The label is hidden on narrow screens, so name the button.
              aria-label={isFollowing ? t('userProfile_unfollow') : t('userProfile_follow')}
              title={isFollowing ? t('userProfile_unfollow') : t('userProfile_follow')}
              className={`px-3 py-2 rounded-2xl text-[11px] font-black flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-60 ${
                isFollowing
                  ? 'bg-pestle-card border border-pestle-border text-gray-400'
                  : 'btn-primary shadow-md shadow-mango/20'
              }`}
            >
              {followPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isFollowing ? (
                <UserCheck size={12} />
              ) : (
                <UserPlus size={12} />
              )}
              <span className="hidden sm:inline">
                {isFollowing ? t('userProfile_unfollow') : t('userProfile_follow')}
              </span>
            </button>
          )}
        </div>

        {/* ── MESSAGES ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 px-4 py-4 overflow-y-auto relative"
        >
          {!ready && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-9 rounded-2xl bg-pestle-bg animate-pulse ${
                    i % 2 ? 'ml-auto w-1/2' : 'w-2/3'
                  }`}
                />
              ))}
            </div>
          )}

          {ready && messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
              <SmartImage
                src={recipient.avatar}
                alt=""
                emoji="👨‍🍳"
                className="w-20 h-20 rounded-full border-2 border-pestle-border"
              />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-pestle-text">
                  {t('chat_emptyTitle', { name: recipient.name })}
                </h4>
                <p className="text-[11px] font-medium text-gray-400 leading-relaxed max-w-[16rem]">
                  {t('chat_emptyBody')}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {[t('chat_starter1'), t('chat_starter2'), t('chat_starter3')].map((starter) => (
                  <button
                    key={starter}
                    onClick={() => handleSend(starter)}
                    className="text-[11px] font-bold px-3 py-2 rounded-full bg-pestle-bg border border-pestle-border text-pestle-text hover:border-mango transition-colors"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {messages.map((m, i) => {
              const previous = messages[i - 1];
              const showDay = !previous || dayLabel(previous.createdAt, t) !== dayLabel(m.createdAt, t);
              // Consecutive messages from the same person within 5 minutes read
              // as one turn: only the last of the run carries a tail and a time.
              const grouped =
                !showDay &&
                previous?.mine === m.mine &&
                new Date(m.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300_000;
              const next = messages[i + 1];
              const endsRun =
                !next ||
                next.mine !== m.mine ||
                new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() >= 300_000;

              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="flex justify-center py-3">
                      <span className="text-[9px] font-black text-gray-400 bg-pestle-bg border border-pestle-border rounded-full px-3 py-1">
                        {dayLabel(m.createdAt, t)}
                      </span>
                    </div>
                  )}

                  <div className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    {!m.mine &&
                      (endsRun ? (
                        <SmartImage
                          src={recipient.avatar}
                          alt=""
                          emoji="👨‍🍳"
                          className="w-6 h-6 rounded-full shrink-0 mb-4"
                        />
                      ) : (
                        <div className="w-6 shrink-0" />
                      ))}

                    <div className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'} max-w-[78%]`}>
                      <div
                        className={`px-3.5 py-2.5 text-[13px] font-medium leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                          m.mine
                            ? `bg-mango text-white ${endsRun ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'}`
                            : `bg-pestle-bg border border-pestle-border text-pestle-text ${
                                endsRun ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl'
                              }`
                        } ${m.status === 'failed' ? 'opacity-60' : ''} ${grouped ? 'mt-0.5' : 'mt-2'}`}
                      >
                        {m.text}
                      </div>

                      {endsRun && m.status !== 'failed' && (
                        <span className="text-[9px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                          {m.time}
                          {m.status === 'sending' && <Loader2 size={9} className="animate-spin" />}
                          {m.mine && m.status === 'sent' && <Check size={10} />}
                        </span>
                      )}

                      {m.status === 'failed' && (
                        <button
                          onClick={() => retry(m.id)}
                          className="text-[9px] font-bold text-red-500 mt-1 px-1 flex items-center gap-1 hover:underline"
                        >
                          <RotateCw size={9} /> {t('chat_failed')} · {t('chat_retry')}
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Jump back to the newest message after scrolling up. */}
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => {
                setAtBottom(true);
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }}
              aria-label={t('chat_scrollToLatest')}
              className="absolute bottom-24 right-5 w-9 h-9 rounded-full bg-pestle-card border border-pestle-border shadow-lg flex items-center justify-center text-pestle-text z-10"
            >
              <ChevronDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── COMPOSER ── */}
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-pestle-border/60 bg-pestle-bg shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                // Grow with the text up to ~5 lines, then scroll inside.
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onCompositionStart={() => (composingRef.current = true)}
              onCompositionEnd={() => (composingRef.current = false)}
              onKeyDown={(e) => {
                // Shift+Enter inserts a newline; a bare Enter sends. The
                // composition guard keeps an IME's confirming Enter from
                // firing off a half-typed word.
                if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              aria-label={t('community_messageAria')}
              placeholder={t('placeholderMsg')}
              className="flex-1 bg-pestle-card border border-pestle-border rounded-2xl px-4 py-3 text-[13px] text-pestle-text focus:outline-none focus:border-mango resize-none max-h-[120px] leading-relaxed"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              aria-label={t('community_messageAria')}
              className="w-11 h-11 bg-mango text-white rounded-2xl flex items-center justify-center shadow-md shadow-mango/20 shrink-0 transition-all disabled:opacity-40 disabled:shadow-none active:scale-95"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 font-medium mt-1.5 px-1 hidden sm:block">
            {t('chat_inputHint')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── INSTAGRAM POST CREATOR MODAL ───────────────────────────────────────────────
const CreatePostModal: React.FC<{
  onClose: () => void;
  onPost: (p: any) => void;
  author: { name: string; avatar: string };
}> = ({
  onClose,
  onPost,
  author,
}) => {
  const { t } = useApp();
  const { recipes } = useRecipes();
  const [caption, setCaption] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [tab, setTab] = useState<'photo' | 'recipe'>('photo');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeClose(onClose);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePost = () => {
    if (!caption.trim() && !imageBase64 && !selectedRecipe) return;
    onPost({
      id: `p-${Date.now()}`,
      user: author,
      image: imageBase64 || selectedRecipe?.image || null,
      caption: caption.trim(),
      recipe: selectedRecipe,
      likes: 0,
      liked: false,
      saved: false,
      time: t('community_justNow'),
      comments: [],
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('community_createPostTitle')}
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-4 sm:p-5 pb-sheet-safe sm:pb-5 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
      >
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-base font-black text-pestle-text min-w-0 truncate">{t('community_createPostTitle')}</h2>
          <button
            onClick={onClose}
            aria-label={t('community_cancel')}
            className="w-8 h-8 shrink-0 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex bg-pestle-bg rounded-xl p-1 border border-pestle-border gap-1">
          {(['photo', 'recipe'] as const).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === tabId ? 'bg-mango text-white shadow-sm' : 'text-gray-400'
              }`}
            >
              {tabId === 'photo' ? (
                <>
                  <Image size={14} /> {t('community_photoAndText')}
                </>
              ) : (
                <>
                  <ChefHat size={14} /> {t('community_attachRecipe')}
                </>
              )}
            </button>
          ))}
        </div>

        {tab === 'photo' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 bg-pestle-bg border-2 border-dashed border-pestle-border rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden hover:border-mango transition-colors group"
            >
              {imageBase64 ? (
                <img src={imageBase64} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-mango/15 text-mango-ink rounded-full flex items-center justify-center mx-auto">
                    <Image size={24} />
                  </div>
                  <span className="text-xs font-bold text-pestle-text block">
                    {t('community_selectPhoto')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'recipe' && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar">
            {recipes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className={`text-left rounded-xl overflow-hidden border-2 transition-all p-1.5 flex items-center gap-2 ${
                  selectedRecipe?.id === r.id
                    ? 'border-mango bg-mango/10'
                    : 'border-pestle-border bg-pestle-bg'
                }`}
              >
                <img src={r.image} alt={r.title} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-extrabold text-pestle-text truncate">{r.title}</p>
                  <p className="text-[9px] text-gray-400">{r.category}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          aria-label={t('community_captionAria')}
          placeholder={t('community_captionPlaceholder')}
          className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango resize-none"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3 text-xs font-bold">
            {t('community_cancel')}
          </button>
          <button
            onClick={handlePost}
            className="btn-primary flex-1 py-3 text-xs font-bold shadow-xl shadow-mango/20 flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> {t('community_publish')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── INSTAGRAM POST CARD (With Double-Tap Like & Heart Pop) ────────────────────
const PostCard: React.FC<{
  post: any;
  onLike: () => void;
  onSave: () => void;
  onComment: (text: string) => void;
  onChat: () => void;
  onOpenProfile: () => void;
  onOpenStory?: () => void;
  isOwnPost?: boolean;
}> = ({ post, onLike, onSave, onComment, onChat, onOpenProfile, onOpenStory, isOwnPost }) => {
  const { t } = useApp();
  const { toastSuccess, toastWarning } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);

  // Double-tap to like simulation
  const handleDoubleTap = () => {
    if (!post.liked) {
      onLike();
    }
    setShowHeartOverlay(true);
    setTimeout(() => setShowHeartOverlay(false), 900);
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(commentText.trim());
    setCommentText('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="pestle-card overflow-hidden rounded-3xl border border-pestle-border shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Post Header */}
      <div className="flex items-center justify-between p-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar plays the story when there is one; otherwise it behaves like
              the name and opens the author's profile. */}
          <button
            onClick={onOpenStory || onOpenProfile}
            aria-label={post.user.name}
            className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 shrink-0"
          >
            <SmartImage
              src={post.user.avatar}
              alt=""
              emoji="👨‍🍳"
              className="w-9 h-9 rounded-full border-2 border-pestle-card"
            />
          </button>
          <div className="flex-1 min-w-0">
            <button
              onClick={onOpenProfile}
              className="text-xs font-black text-pestle-text truncate hover:underline block max-w-full text-left py-2 -my-2"
            >
              {post.user.name}
            </button>
            <p className="text-[10px] text-gray-400 font-medium">{post.time}</p>
          </div>
        </div>

        {/* No "chat" button on your own post — it opened a conversation with
            yourself. Your own post links to your profile instead. */}
        <button
          onClick={isOwnPost ? onOpenProfile : onChat}
          className="px-3 py-2.5 rounded-xl bg-pestle-bg border border-pestle-border text-[11px] font-bold text-pestle-text hover:border-mango flex items-center gap-1.5 shadow-2xs"
        >
          {isOwnPost ? (
            <>
              <User size={13} className="text-mango-ink" /> {t('userProfile_title')}
            </>
          ) : (
            <>
              <MessageSquare size={13} className="text-mango-ink" /> {t('community_chat')}
            </>
          )}
        </button>
      </div>

      {/* Image Container with Double Tap Heart Overlay */}
      {(post.image || post.recipe?.image) && (
        <div className="relative overflow-hidden cursor-pointer select-none" onDoubleClick={handleDoubleTap}>
          <SmartImage
            src={post.image || post.recipe?.image}
            alt={post.caption}
            emoji="🍽️"
            className="w-full h-72 sm:h-96 object-cover"
          />

          <AnimatePresence>
            {showHeartOverlay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <Heart size={90} className="text-red-500 fill-red-500 drop-shadow-2xl animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recipe Banner if attached */}
      {post.recipe && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-mango/15 via-amber-500/10 to-transparent border-b border-pestle-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat size={15} className="text-mango-ink" />
            <span className="text-xs font-black text-pestle-text">{post.recipe.title}</span>
          </div>
          <span className="text-[10px] font-bold text-mango-ink bg-mango/10 px-2 py-0.5 rounded-full">
            {post.recipe.time}
          </span>
        </div>
      )}

      {/* Post Actions Bar */}
      {/* The action row's buttons were 20px tall — a real miss on a phone.
          py-2.5 gives each a ~40px hit area; the negative margin keeps the row
          looking as tight as before. */}
      <div className="px-4 pt-1 pb-0.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={onLike}
            aria-label={t('community_likeAria')}
            aria-pressed={Boolean(post.liked)}
            className={`flex items-center gap-1.5 px-2 py-2.5 -ml-2 text-xs font-bold transition-all ${
              post.liked ? 'text-red-500' : 'text-pestle-text hover:text-red-500'
            }`}
          >
            <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
            <span className="text-xs font-extrabold">{post.likes}</span>
          </motion.button>

          <button
            onClick={() => setShowComments(!showComments)}
            aria-label={t('community_commentsAria')}
            aria-expanded={showComments}
            className="flex items-center gap-1.5 px-2 py-2.5 text-xs font-bold text-pestle-text hover:text-mango-ink transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-xs font-extrabold">{post.comments.length}</span>
          </button>

          <button
            onClick={async () => {
              // Deep-links to the community tab rather than whatever URL the
              // user happens to be on.
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'community');
              url.hash = '';
              const link = url.toString();
              const shareData = { title: 'Zity Chef', text: t('community_shareText'), url: link };
              try {
                if (navigator.share) {
                  await navigator.share(shareData);
                  return;
                }
                await navigator.clipboard.writeText(link);
                toastSuccess(t('community_linkCopiedTitle'), t('community_linkCopiedBody'));
              } catch (err) {
                // A user-cancelled share is not a failure worth reporting.
                if ((err as Error)?.name === 'AbortError') return;
                toastWarning(t('community_shareFailedTitle'), t('community_shareFailedBody'));
              }
            }}
            aria-label={t('community_shareAria')}
            className="w-11 h-11 flex items-center justify-center text-pestle-text hover:text-mango-ink transition-colors"
          >
            <Share2 size={19} />
          </button>
        </div>

        <button
          onClick={onSave}
          aria-label={post.saved ? t('recipe_removeBookmark') : t('recipe_saveBookmark')}
          aria-pressed={Boolean(post.saved)}
          className={`w-11 h-11 -mr-2 flex items-center justify-center transition-colors ${post.saved ? 'text-mango-ink' : 'text-pestle-text hover:text-mango-ink'}`}
        >
          <Bookmark size={20} fill={post.saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Caption & Comments Preview */}
      {post.caption && (
        <div className="px-4 pb-2 text-xs text-pestle-text leading-relaxed">
          <span className="font-black mr-2">{post.user.name}</span>
          <span>{post.caption}</span>
        </div>
      )}

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4 space-y-2.5 border-t border-pestle-border/40 pt-3"
          >
            {post.comments.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-black text-pestle-text shrink-0">{c.user}</span>
                <span className="text-gray-600 dark:text-gray-300 font-medium flex-1">{c.text}</span>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                aria-label={t('community_commentAria')}
                placeholder={t('community_commentPlaceholder')}
                className="flex-1 bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-mango"
              />
              <button
                onClick={handleComment}
                className="bg-mango text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 shadow-xs"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── MAIN COMMUNITY VIEW ────────────────────────────────────────────────────────
export const CommunityView: React.FC = () => {
  const { profile, accountId, t } = useApp();
  const { user: authUser } = useAuth();
  const { toastWarning } = useToast();
  const { feedPosts, feedLoading, persistLike, persistComment, persistPost, serverStoryGroups, persistStory } =
    useCommunity();

  // Build own story group from profile
  const ownStoryGroup: UserStoryGroup = {
    id: 'user-me',
    userName: profile.name || t('community_yourStory'),
    userAvatar: profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name || 'Zity Chef')}`,
    isOwn: true,
    seen: true,
    stories: [],
  };

  const [stories, setStories] = useState<UserStoryGroup[]>([ownStoryGroup]);
  const [posts, setPosts] = useState<any[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<UserStoryGroup | null>(null);
  const [chatUser, setChatUser] = useState<{ user: CommunityUser; draft?: string } | null>(null);
  const [profileUser, setProfileUser] = useState<CommunityUser | null>(null);

  const openChat = useCallback((user: CommunityUser, draft?: string) => {
    setChatUser({ user, draft });
  }, []);

  /** The live story group belonging to a feed author, if they have one. */
  const storyGroupFor = useCallback(
    (user: CommunityUser): UserStoryGroup | null =>
      stories.find(
        (g) => g.stories.length > 0 && (user.id ? g.id === user.id : g.userName === user.name)
      ) ?? null,
    [stories]
  );

  // Bookmarks are the viewer's own, not part of the shared feed, so they live
  // in per-account localStorage — the same place saved recipes do. Without
  // this the flag was local component state and the 10s refetch erased it.
  const savedKey = `zity_saved_posts:${accountId}`;
  const [savedPostIds, setSavedPostIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`zity_saved_posts:${accountId}`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedKey);
      setSavedPostIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSavedPostIds([]);
    }
  }, [savedKey]);

  useEffect(() => {
    setPosts(feedPosts.map((p) => ({ ...p, saved: savedPostIds.includes(p.id) })));
  }, [feedPosts, savedPostIds]);

  useEffect(() => {
    const ownFromServer = serverStoryGroups.find((g: UserStoryGroup) => g.isOwn);
    const own = ownFromServer
      ? { ...ownFromServer, userName: profile.name || ownFromServer.userName, userAvatar: profile.avatarUrl || ownFromServer.userAvatar, isOwn: true }
      : ownStoryGroup;
    const others = serverStoryGroups.filter((g: UserStoryGroup) => !g.isOwn);
    setStories([own, ...others]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverStoryGroups, profile.name, profile.avatarUrl]);

  const handleLike = (postId: string) => {
    let nextLiked = false;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        nextLiked = !p.liked;
        return { ...p, liked: nextLiked, likes: p.liked ? p.likes - 1 : p.likes + 1 };
      })
    );
    persistLike(postId, nextLiked);
  };

  const handleSave = (postId: string) => {
    setSavedPostIds((prev) => {
      const next = prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId];
      try {
        localStorage.setItem(savedKey, JSON.stringify(next));
      } catch {
        /* private mode — the toggle still applies for this session */
      }
      return next;
    });
  };

  const handleComment = (postId: string, text: string) => {
    // The optimistic author must match what gets persisted, or the comment
    // changes name the moment the feed refetches.
    const authorName = profile.name || t('auth_defaultUserName');
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, { user: authorName, text }] } : p
      )
    );
    persistComment(postId, text, authorName);
  };

  const handleNewPost = async (post: any) => {
    setPosts((prev) => [post, ...prev]); // instant local preview (base64)
    let imageUrl: string | null =
      typeof post.image === 'string' && post.image.startsWith('http') ? post.image : null;
    if (typeof post.image === 'string' && post.image.startsWith('data:')) {
      imageUrl = await uploadDataUrl(post.image, 'community');
      // A failed upload used to be swallowed here: the post saved without its
      // photo and the preview only vanished on the next refetch.
      if (!imageUrl) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        toastWarning(t('community_uploadFailedTitle'), t('community_uploadFailedBody'));
        return;
      }
    }
    persistPost({
      caption: post.caption || '',
      imageUrl,
      authorName: profile.name || 'Zity Chef',
      authorAvatar: profile.avatarUrl || '',
    });
  };

  const handleAddStory = async (newStory: StoryItem) => {
    let imageUrl: string | null =
      newStory.img && newStory.img.startsWith('http') ? newStory.img : null;
    if (newStory.img && newStory.img.startsWith('data:')) {
      imageUrl = await uploadDataUrl(newStory.img, 'stories');
      if (!imageUrl) {
        toastWarning(t('community_uploadFailedTitle'), t('community_uploadFailedBody'));
        return;
      }
    }
    persistStory({
      imageUrl,
      caption: newStory.caption ?? null,
      sticker: newStory.sticker ?? null,
      authorName: profile.name || 'Zity Chef',
      authorAvatar: profile.avatarUrl || '',
    });
    setStories((prev) => {
      const ownIndex = prev.findIndex((s) => s.isOwn);
      if (ownIndex >= 0) {
        const updated = [...prev];
        updated[ownIndex] = {
          ...updated[ownIndex],
          seen: false,
          stories: [newStory, ...updated[ownIndex].stories],
        };
        return updated;
      }
      return [
        {
          id: `user-me-${Date.now()}`,
          userName: profile.name || t('community_yourStory'),
          userAvatar: profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name || 'Zity Chef')}`,
          isOwn: true,
          seen: false,
          stories: [newStory],
        },
        ...prev,
      ];
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* HEADER BAR */}
      {/* The title and the two actions shared one row, so on a 320px phone the
          heading was truncated to "Хамтын о…". They stack until there is room. */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-3xl font-black text-pestle-text tracking-tight">
            {t('community_title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 line-clamp-2">
            {t('community_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateStory(true)}
            aria-label={t('community_addStory')}
            className="bg-pestle-card border border-pestle-border py-2.5 px-3.5 rounded-2xl text-xs font-bold text-pestle-text hover:border-mango flex items-center gap-1.5 shadow-xs transition-all shrink-0 whitespace-nowrap"
          >
            <Camera size={16} className="text-mango-ink shrink-0" />
            <span className="hidden sm:inline">{t('community_addStory')}</span>
          </button>

          <button
            onClick={() => setShowCreatePost(true)}
            className="btn-primary py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-mango/20 shrink-0 whitespace-nowrap flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} className="shrink-0" />
            <span>{t('community_publish')}</span>
          </button>
        </div>
      </header>

      {/* INSTAGRAM STORIES STRIP */}
      <div className="bg-pestle-card border border-pestle-border rounded-3xl p-3.5 shadow-xs">
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {stories.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                if (group.isOwn && group.stories.length === 0) {
                  setShowCreateStory(true);
                } else {
                  setActiveStoryGroup(group);
                }
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            >
              <div
                className={`p-[2.5px] rounded-full transition-transform duration-300 group-hover:scale-105 ${
                  group.isOwn
                    ? 'bg-gradient-to-tr from-mango to-amber-400'
                    : group.seen
                    ? 'bg-pestle-border'
                    : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600'
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-pestle-card overflow-hidden relative">
                  <img
                    src={group.userAvatar}
                    alt={group.userName}
                    className="w-full h-full object-cover"
                  />

                  {group.isOwn && (
                    <div className="absolute bottom-0 right-0 bg-mango text-white w-5 h-5 rounded-full flex items-center justify-center border border-white">
                      <Plus size={12} />
                    </div>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-bold text-pestle-text text-center w-16 truncate">
                {group.isOwn ? t('community_yourStory') : group.userName}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* INSTAGRAM FEED POSTS */}
      <div className="space-y-6">
        {feedLoading && posts.length === 0 && (
          <>
            {[0, 1].map((i) => (
              <div key={`feed-skeleton-${i}`} className="pestle-card p-0 overflow-hidden animate-pulse">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-pestle-bg" />
                  <div className="h-3 w-24 bg-pestle-bg rounded" />
                </div>
                <div className="h-64 w-full bg-pestle-bg" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-1/2 bg-pestle-bg rounded" />
                  <div className="h-3 w-3/4 bg-pestle-bg rounded" />
                </div>
              </div>
            ))}
          </>
        )}
        {!feedLoading && posts.length === 0 && (
          <div className="pestle-card p-8 text-center">
            <p className="text-sm font-semibold text-gray-400">{t('community_emptyFeed')}</p>
          </div>
        )}
        {posts.map((post) => {
          const authorStories = storyGroupFor(post.user);
          return (
            <PostCard
              key={post.id}
              post={post}
              onLike={() => handleLike(post.id)}
              onSave={() => handleSave(post.id)}
              onComment={(text) => handleComment(post.id, text)}
              onChat={() => openChat(post.user)}
              onOpenProfile={() => setProfileUser(post.user)}
              isOwnPost={Boolean(post.user.id && post.user.id === authUser?.id)}
              // Only wired when the author actually has a live story — it used
              // to be passed unconditionally, so the avatar was a dead tap for
              // everyone else.
              onOpenStory={authorStories ? () => setActiveStoryGroup(authorStories) : undefined}
            />
          );
        })}
      </div>

      {/* MODALS & DRAWERS */}
      <AnimatePresence>
        {activeStoryGroup && (
          <StoryViewerModal
            storyGroup={activeStoryGroup}
            allGroups={stories}
            onClose={() => setActiveStoryGroup(null)}
            onSelectGroup={(g) => setActiveStoryGroup(g)}
            onChat={openChat}
            onOpenProfile={setProfileUser}
          />
        )}

        {showCreateStory && (
          <CreateStoryModal
            onClose={() => setShowCreateStory(false)}
            onAddStory={handleAddStory}
          />
        )}

        {showCreatePost && (
          <CreatePostModal
            onClose={() => setShowCreatePost(false)}
            author={{
              name: profile.name || 'Zity Chef',
              avatar: profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name || 'Zity Chef')}`,
            }}
            onPost={handleNewPost}
          />
        )}

        {chatUser && (
          <DirectChatDrawer
            recipient={chatUser.user}
            initialText={chatUser.draft}
            onClose={() => setChatUser(null)}
            onOpenProfile={setProfileUser}
          />
        )}

        {profileUser && (
          <UserProfileSheet
            target={profileUser}
            onClose={() => setProfileUser(null)}
            onMessage={(user) => {
              setProfileUser(null);
              openChat(user);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
