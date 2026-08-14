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
} from 'lucide-react';
import { SmartImage } from './SmartImage';
import { useApp } from '../context/AppContext';
import { useCommunity } from '../hooks/useCommunity';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { uploadDataUrl } from '../lib/storage';
import { useRecipes } from '../hooks/useRecipes';

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
  onChat: (userName: string, avatar: string) => void;
}> = ({ storyGroup, allGroups, onClose, onSelectGroup, onChat }) => {
  const { t } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [floatingHeart, setFloatingHeart] = useState<boolean>(false);
  const [replyText, setReplyText] = useState('');

  const stories = storyGroup.stories;
  const currentStory = stories[slideIndex] || stories[0];

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

  const handleSendReaction = (emoji: string) => {
    setFloatingHeart(true);
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
        className="w-full max-w-sm sm:max-w-md h-full sm:h-[92vh] sm:rounded-3xl overflow-hidden relative flex flex-col justify-between shadow-2xl bg-slate-950"
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
        <div className="relative z-20 p-3 sm:p-4 space-y-3">
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

          {/* User Info Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600">
                <img
                  src={storyGroup.userAvatar}
                  alt={storyGroup.userName}
                  className="w-8 h-8 rounded-full border border-black object-cover"
                />
              </div>
              <div>
                <h4 className="text-white text-xs font-black drop-shadow-md flex items-center gap-1.5">
                  <span>{storyGroup.userName}</span>
                  <span className="text-[10px] text-white/70 font-normal">
                    {currentStory.createdAt}
                  </span>
                </h4>
                {currentStory.sticker && (
                  <span className="text-[9px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full backdrop-blur-md inline-block mt-0.5">
                    {currentStory.sticker}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/40 hover:bg-black/70 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-colors"
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
        <div className="relative z-20 p-4 space-y-3">
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
                  onChat(storyGroup.userName, storyGroup.userAvatar);
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
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[350] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-pestle-card border border-pestle-border rounded-[32px] p-5 space-y-4 shadow-2xl overflow-hidden my-auto"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-pestle-text flex items-center gap-2">
            <Camera size={18} className="text-mango" /> {t('community_createStoryTitle')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* PREVIEW CONTAINER (Strict 9:16 ratio vertical phone style on desktop) */}
        <div className="w-56 h-[340px] mx-auto rounded-2xl overflow-hidden relative border border-pestle-border flex flex-col justify-between p-3.5 shadow-md">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-pestle-bg border border-pestle-border py-2 px-3 rounded-xl text-xs font-bold text-pestle-text hover:border-mango flex items-center justify-center gap-2"
            >
              <Camera size={15} className="text-mango" />
              <span>{t('community_addPhoto')}</span>
            </button>

            {/* Gradient Swatches if no image */}
            {!imageBase64 && (
              <div className="flex items-center gap-1.5">
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
const DirectChatDrawer: React.FC<{
  recipient: { name: string; avatar: string };
  onClose: () => void;
}> = ({ recipient, onClose }) => {
  const { t } = useApp();
  const { messages, send } = useDirectMessages(recipient.name);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    send(inputText);
    setInputText('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[350] flex justify-end"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-md h-full bg-pestle-card border-l border-pestle-border flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-pestle-border/60 flex items-center justify-between bg-pestle-bg">
          <div className="flex items-center gap-3">
            <img
              src={recipient.avatar}
              alt={recipient.name}
              className="w-10 h-10 rounded-xl border border-pestle-border object-cover"
            />
            <div>
              <h3 className="font-extrabold text-sm text-pestle-text">{recipient.name}</h3>
              <span className="text-[10px] text-mint font-bold flex items-center gap-1">
                ● {t('online')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((m) => {
            const isMe = m.sender === 'Би';
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs font-medium shadow-sm ${
                    isMe
                      ? 'bg-mango text-white rounded-br-none'
                      : 'bg-pestle-bg border border-pestle-border text-pestle-text rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">{m.time}</span>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-pestle-border/60 bg-pestle-bg flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            aria-label={t('community_messageAria')}
            placeholder={t('placeholderMsg')}
            className="flex-1 bg-pestle-card border border-pestle-border rounded-xl px-4 py-2.5 text-xs text-pestle-text focus:outline-none focus:border-mango"
          />
          <button
            onClick={handleSend}
            className="w-10 h-10 bg-mango text-white rounded-xl flex items-center justify-center shadow-md shadow-mango/20"
          >
            <Send size={15} />
          </button>
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
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[350] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-[32px] p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black text-pestle-text">{t('community_createPostTitle')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text"
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
                  <div className="w-12 h-12 bg-mango/15 text-mango rounded-full flex items-center justify-center mx-auto">
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
  onOpenStory?: () => void;
}> = ({ post, onLike, onSave, onComment, onChat, onOpenStory }) => {
  const { t } = useApp();
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
          <div
            onClick={onOpenStory || onChat}
            className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 cursor-pointer shrink-0"
          >
            <img
              src={post.user.avatar}
              className="w-9 h-9 rounded-full border-2 border-pestle-card object-cover"
              alt=""
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4
              onClick={onChat}
              className="text-xs font-black text-pestle-text truncate cursor-pointer hover:underline"
            >
              {post.user.name}
            </h4>
            <p className="text-[10px] text-gray-400 font-medium">{post.time}</p>
          </div>
        </div>

        <button
          onClick={onChat}
          className="px-3 py-1.5 rounded-xl bg-pestle-bg border border-pestle-border text-[11px] font-bold text-pestle-text hover:border-mango flex items-center gap-1.5 shadow-2xs"
        >
          <MessageSquare size={13} className="text-mango" /> {t('community_chat')}
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
            <ChefHat size={15} className="text-mango" />
            <span className="text-xs font-black text-pestle-text">{post.recipe.title}</span>
          </div>
          <span className="text-[10px] font-bold text-mango bg-mango/10 px-2 py-0.5 rounded-full">
            {post.recipe.time}
          </span>
        </div>
      )}

      {/* Post Actions Bar */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={onLike}
            className={`flex items-center gap-1.5 text-xs font-bold transition-all ${
              post.liked ? 'text-red-500' : 'text-pestle-text hover:text-red-500'
            }`}
          >
            <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
            <span className="text-xs font-extrabold">{post.likes}</span>
          </motion.button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-xs font-bold text-pestle-text hover:text-mango transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-xs font-extrabold">{post.comments.length}</span>
          </button>

          <button
            onClick={() => {
              const url = window.location.href;
              const shareData = { title: 'Zity Chef', text: t('community_shareText'), url };
              if (navigator.share) {
                navigator.share(shareData).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url).catch(() => {});
              }
            }}
            aria-label={t('community_shareAria')}
            className="text-pestle-text hover:text-mango transition-colors"
          >
            <Share2 size={19} />
          </button>
        </div>

        <button
          onClick={onSave}
          className={`transition-colors ${post.saved ? 'text-mango' : 'text-pestle-text hover:text-mango'}`}
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
  const { profile, t } = useApp();
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
  const [chatUser, setChatUser] = useState<{ name: string; avatar: string } | null>(null);

  useEffect(() => {
    setPosts(feedPosts);
  }, [feedPosts]);

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
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)));
  };

  const handleComment = (postId: string, text: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, { user: 'Би', text }] } : p
      )
    );
    persistComment(postId, text, profile.name || 'Би');
  };

  const handleNewPost = async (post: any) => {
    setPosts((prev) => [post, ...prev]); // instant local preview (base64)
    let imageUrl: string | null =
      typeof post.image === 'string' && post.image.startsWith('http') ? post.image : null;
    if (typeof post.image === 'string' && post.image.startsWith('data:')) {
      imageUrl = await uploadDataUrl(post.image, 'community');
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
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-pestle-text tracking-tight">
            {t('community_title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {t('community_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateStory(true)}
            className="bg-pestle-card border border-pestle-border py-2.5 px-3.5 rounded-2xl text-xs font-bold text-pestle-text hover:border-mango flex items-center gap-1.5 shadow-xs transition-all shrink-0 whitespace-nowrap"
          >
            <Camera size={16} className="text-mango shrink-0" />
            <span className="hidden sm:inline">{t('community_addStory')}</span>
          </button>

          <button
            onClick={() => setShowCreatePost(true)}
            className="btn-primary py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-mango/20 shrink-0 whitespace-nowrap"
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
                {group.isOwn ? t('community_yourStory') : group.userName.split('-')[0]}
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
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={() => handleLike(post.id)}
            onSave={() => handleSave(post.id)}
            onComment={(text) => handleComment(post.id, text)}
            onChat={() => setChatUser(post.user)}
            onOpenStory={() => {
              const matchedGroup = stories.find((s) => s.userName.includes(post.user.name.split('-')[0]));
              if (matchedGroup) setActiveStoryGroup(matchedGroup);
            }}
          />
        ))}
      </div>

      {/* MODALS & DRAWERS */}
      <AnimatePresence>
        {activeStoryGroup && (
          <StoryViewerModal
            storyGroup={activeStoryGroup}
            allGroups={stories}
            onClose={() => setActiveStoryGroup(null)}
            onSelectGroup={(g) => setActiveStoryGroup(g)}
            onChat={(name, avatar) => setChatUser({ name, avatar })}
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

        {chatUser && <DirectChatDrawer recipient={chatUser} onClose={() => setChatUser(null)} />}
      </AnimatePresence>
    </div>
  );
};
