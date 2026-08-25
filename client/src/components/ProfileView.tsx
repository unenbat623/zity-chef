import React, { useId, useState, useRef } from 'react';
import { m, AnimatePresence } from 'motion/react';
import {
  Camera,
  Edit3,
  Check,
  X,
  ChefHat,
  Users,
  BookOpen,
  Heart,
  Palette,
  User,
  AtSign,
  FileText,
  Sparkles,
  Grid3x3,
  Clock,
  Play,
  Bookmark,
  Calculator,
  UserPlus,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRecipes } from '../hooks/useRecipes';
import { useLoyalty } from '../hooks/useLoyalty';
import { useUserProfile } from '../hooks/useUserProfile';
import { StatRow, PostsGrid } from './ProfileParts';
import { SmartImage } from './SmartImage';
import { uploadImage } from '../lib/storage';
import { ensureContrast, readableTextOn } from '../lib/contrast';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { FoodCostCalculatorModal } from './FoodCostCalculatorModal';

// ── Theme Gradient Options ───────────────────────────────────────────────────
const THEME_GRADIENTS = [
  {
    labelKey: 'profile_themeViolet',
    value: 'from-violet-600 via-purple-600 to-fuchsia-600',
    accent: '#8B5CF6',
  },
  {
    labelKey: 'profile_themePink',
    value: 'from-pink-500 via-rose-500 to-red-500',
    accent: '#EC4899',
  },
  {
    labelKey: 'profile_themeBlue',
    value: 'from-blue-600 via-indigo-600 to-violet-600',
    accent: '#4F46E5',
  },
  {
    labelKey: 'profile_themeGreen',
    value: 'from-emerald-500 via-teal-500 to-cyan-500',
    accent: '#10B981',
  },
  {
    labelKey: 'profile_themeOrange',
    value: 'from-amber-500 via-orange-500 to-red-500',
    accent: '#F59E0B',
  },
  {
    labelKey: 'profile_themeCyan',
    value: 'from-cyan-500 via-blue-500 to-indigo-600',
    accent: '#06B6D4',
  },
  {
    labelKey: 'profile_themeStone',
    value: 'from-slate-600 via-gray-600 to-zinc-700',
    accent: '#475569',
  },
  {
    labelKey: 'profile_themeRoseGold',
    value: 'from-fuchsia-600 via-pink-500 to-amber-400',
    accent: '#D946EF',
  },
];

// ── Edit Profile Modal ────────────────────────────────────────────────────────
const EditProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, setProfile, t } = useApp();
  const [form, setForm] = useState({ ...profile });
  // Ties each label to its control so screen readers announce the field name
  // and tapping the label focuses the input.
  const uid = useId();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [activeSection, setActiveSection] = useState<'info' | 'theme'>('info');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEscapeClose(onClose, !saving);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // Instant local preview via base64 while the (optional) upload happens on save.
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setForm((prev) => ({ ...prev, avatarUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    // Upload to Supabase Storage when available; otherwise keep the base64 preview.
    let avatarUrl = avatarPreview;
    if (selectedFile) {
      const uploadedUrl = await uploadImage(selectedFile, 'avatars');
      if (uploadedUrl) avatarUrl = uploadedUrl;
    }
    setProfile({ ...form, avatarUrl });
    setSaving(false);
    onClose();
  };

  const selectedTheme =
    THEME_GRADIENTS.find((t) => t.value === form.coverGradient) || THEME_GRADIENTS[0];
  // The save button previews the theme being picked, so it cannot use the
  // global accent token — derive a contrast-safe pair from the selection.
  const saveBg = ensureContrast(selectedTheme.accent, '#FFFFFF', 4.5);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        if (!saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('profile_editProfile')}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <m.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-pestle-card border border-pestle-border rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div
          className={`bg-gradient-to-r ${selectedTheme.value} p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0`}
        >
          <h2 className="text-white font-black text-base flex items-center gap-2 min-w-0">
            <Edit3 size={18} className="shrink-0" />
            <span className="truncate">{t('profile_editProfile')}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label={t('profile_cancel')}
            className="w-8 h-8 shrink-0 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-pestle-bg border-b border-pestle-border shrink-0">
          {(['info', 'theme'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                activeSection === tab
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-gray-400 hover:text-pestle-text'
              }`}
            >
              {tab === 'info' ? (
                <>
                  <User size={14} /> {t('profile_tabInfo')}
                </>
              ) : (
                <>
                  <Palette size={14} /> {t('profile_tabTheme')}
                </>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {activeSection === 'info' && (
            <>
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${form.coverGradient} flex items-center justify-center overflow-hidden border-4 border-white shadow-xl`}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={36} className="text-white" />
                    )}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-violet-500 transition-colors border-2 border-white"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {t('profile_changePhoto')}
                </button>
              </div>

              {/* Form Fields */}
              {[
                {
                  label: t('profile_nameLabel'),
                  icon: User,
                  key: 'name',
                  placeholder: t('profile_namePlaceholder'),
                },
                {
                  label: t('profile_usernameLabel'),
                  icon: AtSign,
                  key: 'username',
                  placeholder: '@username',
                },
              ].map(({ label, icon: Icon, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label
                    htmlFor={`${uid}-${key}`}
                    className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Icon size={12} className="text-violet-500" /> {label}
                  </label>
                  <input
                    id={`${uid}-${key}`}
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <label
                  htmlFor={`${uid}-bio`}
                  className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <FileText size={12} className="text-violet-500" /> {t('profile_bioLabel')}
                </label>
                <textarea
                  id={`${uid}-bio`}
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder={t('profile_bioPlaceholder')}
                  className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-violet-500 resize-none transition-colors"
                />
              </div>
            </>
          )}

          {activeSection === 'theme' && (
            <>
              <p className="text-xs font-bold text-gray-400 text-center">
                {t('profile_selectColor')}
              </p>

              {/* Live Preview */}
              <div
                className={`w-full h-28 rounded-2xl bg-gradient-to-r ${form.coverGradient} flex items-center justify-center shadow-lg relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white flex items-center justify-center overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-white" />
                    )}
                  </div>
                  <span className="text-white font-black text-sm drop-shadow-md">{form.name}</span>
                </div>
              </div>

              {/* Color Grid */}
              <div className="grid grid-cols-4 gap-2">
                {THEME_GRADIENTS.map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        coverGradient: theme.value,
                        accentColor: theme.accent,
                      }))
                    }
                    className={`group flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                      form.coverGradient === theme.value
                        ? 'border-violet-500 bg-violet-500/10 scale-105'
                        : 'border-transparent hover:border-pestle-border bg-pestle-bg'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.value} shadow-md`}
                    />
                    <span className="text-[9px] font-bold text-gray-400 group-hover:text-pestle-text truncate w-full text-center">
                      {t(theme.labelKey)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-4 sm:px-5 pt-3 pb-sheet-safe sm:pb-5 flex gap-3 shrink-0 border-t border-pestle-border/60">
          <button onClick={onClose} className="btn-secondary flex-1 py-3 text-xs font-bold">
            {t('profile_cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: saveBg, color: readableTextOn(saveBg) }}
            className="flex-1 py-3 text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? (
              <Sparkles size={15} className="animate-spin" />
            ) : (
              <>
                <Check size={15} /> {t('profile_save')}
              </>
            )}
          </button>
        </div>
      </m.div>
    </m.div>
  );
};

// ── MAIN PROFILE VIEW ─────────────────────────────────────────────────────────
export const ProfileView: React.FC = () => {
  const { profile, setActiveTab, savedRecipeIds, toggleSaveRecipe, setActiveCookingRecipe, t } =
    useApp();
  const { user: authUser, isAnonymous } = useAuth();
  const { recipes } = useRecipes();
  const points = useLoyalty();
  const [showEdit, setShowEdit] = useState(false);
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [activeGrid, setActiveGrid] = useState<'posts' | 'recipes'>('posts');
  const accountLabel =
    authUser && !isAnonymous
      ? authUser.email || authUser.phone || profile.username
      : t('profile_guestAccount');

  const savedRecipesList = recipes.filter((r) => savedRecipeIds.includes(r.id));
  // Posts, followers and the grid all come from the community service; the
  // local profile object only ever held zeroes and an empty grid.
  const { profile: social, loading: socialLoading } = useUserProfile({
    id: 'me',
    name: profile.name || 'Zity Chef',
    avatar: profile.avatarUrl || undefined,
  });
  const stats = [
    { label: t('profile_statPosts'), value: social?.stats.posts ?? 0, icon: Grid3x3 },
    { label: t('userProfile_followers'), value: social?.stats.followers ?? 0, icon: Users },
    { label: t('userProfile_following'), value: social?.stats.following ?? 0, icon: UserPlus },
    { label: t('profile_statRecipes'), value: savedRecipeIds.length, icon: BookOpen },
  ];

  // Use the contrast-adjusted ink shade, not the raw accent (2.5:1 on white).
  const accentStyle = { color: 'var(--color-accent-ink)' };
  const accentBgStyle = { backgroundColor: profile.accentColor + '18' };
  const accentBorderStyle = { borderColor: profile.accentColor + '55' };

  return (
    // The scroll container above already reserves room for the bottom nav, so a
    // second `min-h-screen pb-24` here just added an empty screen of scroll.
    <div className="pb-6">
      {/* ── COVER / HERO SECTION ─────────────────── */}
      <div className={`relative w-full h-36 sm:h-44 bg-gradient-to-br ${profile.coverGradient}`}>
        {/* Decorative blobs, clipped to the cover — the cover itself must not
            clip, or it cuts the overlapping avatar in half. */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/12 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-10 w-48 h-48 bg-black/15 rounded-full blur-2xl" />
        </div>

        {/* Avatar — doubles as the edit affordance, so the cover no longer
            carries a second "edit" button competing with the one below. */}
        <button
          onClick={() => setShowEdit(true)}
          aria-label={t('profile_editProfile')}
          className="absolute -bottom-12 left-5 sm:left-8 group"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-pestle-card shadow-2xl overflow-hidden">
            <div
              className={`w-full h-full bg-gradient-to-br ${profile.coverGradient} flex items-center justify-center`}
            >
              {profile.avatarUrl ? (
                <SmartImage src={profile.avatarUrl} alt="" emoji="👨‍🍳" className="w-full h-full" />
              ) : (
                <User size={42} className="text-white" />
              )}
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-pestle-card border border-pestle-border shadow-md flex items-center justify-center text-pestle-text group-hover:border-mango transition-colors">
            <Camera size={14} style={accentStyle} />
          </span>
        </button>
      </div>

      {/* ── PROFILE CARD ────────────────────────── */}
      <div className="px-4 sm:px-6 pt-16 space-y-5">
        {/* Name + Username */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-pestle-text tracking-tight truncate">
              {profile.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs font-bold" style={accentStyle}>
                {profile.username}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ ...accentStyle, ...accentBgStyle, ...accentBorderStyle }}
              >
                {accountLabel}
              </span>
            </div>
          </div>

          <m.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEdit(true)}
            className="text-xs font-black py-2.5 px-4 rounded-2xl border transition-all shrink-0 flex items-center gap-1.5"
            style={{ ...accentStyle, ...accentBgStyle, ...accentBorderStyle }}
          >
            <Edit3 size={13} />
            <span className="hidden sm:inline">{t('profile_editProfile')}</span>
          </m.button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">
            {profile.bio}
          </p>
        )}

        {/* Stats — one card, same shape as another chef's profile sheet. */}
        <StatRow items={stats} loading={socialLoading} />

        {/* Quick Action Buttons — help lives here on mobile, where the sidebar
            (its only other entry point) doesn't exist. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <m.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('community')}
            className="py-3 px-2 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1.5 shadow-lg on-accent"
          >
            <Users size={16} />
            <span className="leading-tight text-center">{t('profile_toCommunity')}</span>
          </m.button>
          <m.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('recipe')}
            className="py-3 px-2 rounded-2xl text-[11px] font-black border border-pestle-border text-pestle-text hover:border-mango flex flex-col items-center justify-center gap-1.5 bg-pestle-card transition-colors shadow-xs"
          >
            <ChefHat size={16} style={accentStyle} />
            <span className="leading-tight text-center">{t('profile_viewRecipes')}</span>
          </m.button>
          <m.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCostCalculator(true)}
            className="py-3 px-2 rounded-2xl text-[11px] font-black border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-1.5 bg-pestle-card transition-colors shadow-xs"
          >
            <Calculator size={16} />
            <span className="leading-tight text-center">{t('profile_costCalculator')}</span>
          </m.button>
          <m.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('help')}
            className="py-3 px-2 rounded-2xl text-[11px] font-black border border-pestle-border text-pestle-text hover:border-mango flex flex-col items-center justify-center gap-1.5 bg-pestle-card transition-colors shadow-xs"
          >
            <HelpCircle size={16} style={accentStyle} />
            <span className="leading-tight text-center">{t('sidebar_help')}</span>
          </m.button>
        </div>

        {/* Zity points — earned on every delivered order. The ledger has been
            filling up server-side with nothing in the app to show for it. */}
        <div className="pestle-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={16} style={accentStyle} className="shrink-0" />
              <h3 className="text-xs font-black text-pestle-text truncate">{t('loyalty_title')}</h3>
            </div>
            <span className="text-base font-black tabular-nums" style={accentStyle}>
              {points.balance}
            </span>
          </div>

          {points.history.length === 0 ? (
            <p className="text-[11px] font-semibold text-gray-400">{t('loyalty_empty')}</p>
          ) : (
            <div className="space-y-1.5">
              {points.history.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 text-[11px] font-bold text-gray-500"
                >
                  <span className="truncate">{entry.orderRef}</span>
                  <span className="shrink-0 tabular-nums" style={accentStyle}>
                    +{entry.points}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] font-semibold text-gray-400">{t('loyalty_rate')}</p>
        </div>

        {/* ── POST GRID TABS ─────────────────────── */}
        <div className="border-t border-pestle-border pt-4 space-y-4">
          <div className="flex border-b border-pestle-border">
            {(['posts', 'recipes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveGrid(tab)}
                className={`flex-1 pt-2 pb-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeGrid === tab ? 'text-pestle-text' : 'text-gray-400 border-transparent'
                }`}
                style={
                  activeGrid === tab
                    ? { borderColor: 'var(--color-accent-ink)', color: 'var(--color-accent-ink)' }
                    : {}
                }
              >
                {tab === 'posts' ? (
                  <>
                    <Grid3x3 size={14} /> {t('profile_tabPosts')}
                  </>
                ) : (
                  <>
                    <BookOpen size={14} /> {t('profile_tabSavedRecipes')}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Posts Grid */}
          <AnimatePresence mode="wait">
            {activeGrid === 'posts' && (
              <m.div
                key="posts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {/* This tab always claimed "no posts yet", even while the stat
                    above it counted them. It now shows the real grid. */}
                {socialLoading || (social && social.posts.length > 0) ? (
                  <PostsGrid
                    posts={social?.posts ?? []}
                    loading={socialLoading}
                    columns="grid-cols-3 lg:grid-cols-4"
                  />
                ) : (
                  <div className="pestle-card border border-pestle-border rounded-3xl py-12 px-4 text-center flex flex-col items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-3xl flex items-center justify-center"
                      style={{ backgroundColor: profile.accentColor + '18' }}
                    >
                      <Grid3x3 size={28} style={accentStyle} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-pestle-text">
                        {t('profile_noPostsTitle')}
                      </p>
                      <p className="text-xs text-gray-400 font-medium mt-1 max-w-sm">
                        {t('profile_noPostsDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('community')}
                      className="text-xs font-bold px-4 py-2 rounded-xl shadow-md on-accent"
                    >
                      {t('profile_toCommunity')}
                    </button>
                  </div>
                )}
              </m.div>
            )}

            {activeGrid === 'recipes' && (
              <m.div
                key="recipes"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {savedRecipesList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {savedRecipesList.map((r) => (
                      <div
                        key={r.id}
                        className="pestle-card border border-pestle-border rounded-2xl overflow-hidden p-3 flex gap-3 hover:shadow-md transition-shadow group relative"
                      >
                        <SmartImage
                          src={r.image}
                          alt={r.title}
                          emoji="🍽️"
                          className="w-20 h-20 rounded-xl shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="text-xs font-black text-pestle-text truncate">
                                {r.title}
                              </h4>
                              <button
                                onClick={() => toggleSaveRecipe(r.id)}
                                className="text-mango-ink hover:scale-110 transition-transform p-0.5"
                                title={t('recipe_removeBookmark')}
                              >
                                <Bookmark size={15} className="fill-mango" />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-0.5">
                              {r.tags ? r.tags.join(' • ') : r.category}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                              <Clock size={11} /> {r.time}
                            </span>
                            <button
                              onClick={() => {
                                setActiveCookingRecipe(r);
                                setActiveTab('cooking');
                              }}
                              className="text-[10px] font-black px-2.5 py-1 rounded-lg text-white bg-mango flex items-center gap-1 hover:opacity-90 transition-opacity shadow-xs"
                            >
                              <Play size={10} className="fill-white" /> {t('recipe_startCooking')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div
                      className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg"
                      style={{ background: profile.accentColor + '22' }}
                    >
                      <Sparkles size={28} style={accentStyle} />
                    </div>
                    <p className="text-sm font-black text-pestle-text">
                      {t('profile_noSavedRecipes')}
                    </p>
                    <p className="text-xs text-gray-400 font-medium max-w-xs">
                      {t('profile_noSavedRecipesDesc')}
                    </p>
                    <button
                      onClick={() => setActiveTab('recipe')}
                      className="text-xs font-bold px-4 py-2 rounded-xl shadow-md on-accent"
                    >
                      {t('profile_searchRecipes')}
                    </button>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
        {showCostCalculator && (
          <FoodCostCalculatorModal
            isOpen={showCostCalculator}
            onClose={() => setShowCostCalculator(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
