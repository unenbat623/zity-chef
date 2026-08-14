import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRecipes } from '../hooks/useRecipes';
import { uploadImage } from '../lib/storage';
import { ensureContrast, readableTextOn } from '../lib/contrast';
import { FoodCostCalculatorModal } from './FoodCostCalculatorModal';

// ── Theme Gradient Options ───────────────────────────────────────────────────
const THEME_GRADIENTS = [
  { labelKey: 'profile_themeViolet', value: 'from-violet-600 via-purple-600 to-fuchsia-600', accent: '#8B5CF6' },
  { labelKey: 'profile_themePink', value: 'from-pink-500 via-rose-500 to-red-500', accent: '#EC4899' },
  { labelKey: 'profile_themeBlue', value: 'from-blue-600 via-indigo-600 to-violet-600', accent: '#4F46E5' },
  { labelKey: 'profile_themeGreen', value: 'from-emerald-500 via-teal-500 to-cyan-500', accent: '#10B981' },
  { labelKey: 'profile_themeOrange', value: 'from-amber-500 via-orange-500 to-red-500', accent: '#F59E0B' },
  { labelKey: 'profile_themeCyan', value: 'from-cyan-500 via-blue-500 to-indigo-600', accent: '#06B6D4' },
  { labelKey: 'profile_themeStone', value: 'from-slate-600 via-gray-600 to-zinc-700', accent: '#475569' },
  { labelKey: 'profile_themeRoseGold', value: 'from-fuchsia-600 via-pink-500 to-amber-400', accent: '#D946EF' },
];

// ── Edit Profile Modal ────────────────────────────────────────────────────────
const EditProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, setProfile, t } = useApp();
  const [form, setForm] = useState({ ...profile });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [activeSection, setActiveSection] = useState<'info' | 'theme'>('info');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const selectedTheme = THEME_GRADIENTS.find((t) => t.value === form.coverGradient) || THEME_GRADIENTS[0];
  // The save button previews the theme being picked, so it cannot use the
  // global accent token — derive a contrast-safe pair from the selection.
  const saveBg = ensureContrast(selectedTheme.accent, '#FFFFFF', 4.5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[350] flex items-center justify-center p-3 sm:p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        className="w-full max-w-lg bg-pestle-card border border-pestle-border rounded-[32px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${selectedTheme.value} p-5 flex items-center justify-between`}>
          <h2 className="text-white font-black text-base flex items-center gap-2">
            <Edit3 size={18} /> {t('profile_editProfile')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-pestle-bg border-b border-pestle-border">
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
                <><User size={14} /> {t('profile_tabInfo')}</>
              ) : (
                <><Palette size={14} /> {t('profile_tabTheme')}</>
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeSection === 'info' && (
            <>
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${form.coverGradient} flex items-center justify-center overflow-hidden border-4 border-white shadow-xl`}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
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
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {t('profile_changePhoto')}
                </button>
              </div>

              {/* Form Fields */}
              {[
                { label: t('profile_nameLabel'), icon: User, key: 'name', placeholder: t('profile_namePlaceholder') },
                { label: t('profile_usernameLabel'), icon: AtSign, key: 'username', placeholder: '@username' },
              ].map(({ label, icon: Icon, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon size={12} className="text-violet-500" /> {label}
                  </label>
                  <input
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} className="text-violet-500" /> {t('profile_bioLabel')}
                </label>
                <textarea
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
              <div className={`w-full h-28 rounded-2xl bg-gradient-to-r ${form.coverGradient} flex items-center justify-center shadow-lg relative overflow-hidden`}>
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
                    onClick={() => setForm((prev) => ({ ...prev, coverGradient: theme.value, accentColor: theme.accent }))}
                    className={`group flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                      form.coverGradient === theme.value
                        ? 'border-violet-500 bg-violet-500/10 scale-105'
                        : 'border-transparent hover:border-pestle-border bg-pestle-bg'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.value} shadow-md`} />
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
        <div className="px-5 pb-5 flex gap-3">
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
      </motion.div>
    </motion.div>
  );
};

// ── MAIN PROFILE VIEW ─────────────────────────────────────────────────────────
export const ProfileView: React.FC = () => {
  const { profile, setActiveTab, savedRecipeIds, toggleSaveRecipe, setActiveCookingRecipe, inventory, orders, t } = useApp();
  const { user: authUser, isAnonymous } = useAuth();
  const { recipes } = useRecipes();
  const [showEdit, setShowEdit] = useState(false);
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [activeGrid, setActiveGrid] = useState<'posts' | 'recipes'>('posts');
  const accountLabel = authUser && !isAnonymous
    ? authUser.email || authUser.phone || profile.username
    : t('profile_guestAccount');

  const savedRecipesList = recipes.filter((r) => savedRecipeIds.includes(r.id));
  const personalStats = [
    { label: t('profile_statPosts'), value: 0, icon: Grid3x3 },
    { label: t('dashboard_products'), value: inventory.length, icon: ChefHat },
    { label: t('dashboard_orders'), value: orders.length, icon: Heart },
    { label: t('profile_statRecipes'), value: savedRecipeIds.length, icon: BookOpen },
  ];

  const stats = personalStats;

  // Use the contrast-adjusted ink shade, not the raw accent (2.5:1 on white).
  const accentStyle = { color: 'var(--color-accent-ink)' };
  const accentBgStyle = { backgroundColor: profile.accentColor + '18' };
  const accentBorderStyle = { borderColor: profile.accentColor + '55' };

  return (
    <div className="min-h-screen pb-24">
      {/* ── COVER / HERO SECTION ─────────────────── */}
      <div className={`relative w-full h-52 sm:h-64 bg-gradient-to-br ${profile.coverGradient} overflow-hidden`}>
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/15 rounded-full blur-2xl" />

        {/* Edit button */}
        <button
          onClick={() => setShowEdit(true)}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/35 backdrop-blur-md text-white text-[11px] font-bold px-3.5 py-2 rounded-2xl flex items-center gap-1.5 transition-all border border-white/20 shadow-sm"
        >
          <Edit3 size={13} /> {t('profile_edit')}
        </button>

        {/* Avatar – positioned to overlap the card below */}
        <div className="absolute -bottom-12 left-6 sm:left-8">
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-pestle-card shadow-2xl overflow-hidden flex items-center justify-center"
            style={{ background: profile.coverGradient ? undefined : profile.accentColor }}
          >
            <div className={`w-full h-full bg-gradient-to-br ${profile.coverGradient} flex items-center justify-center`}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={42} className="text-white" />
              )}
            </div>
          </div>

          {/* Online badge */}
          <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-pestle-card bg-emerald-600 dark:bg-emerald-400" />
        </div>
      </div>

      {/* ── PROFILE CARD ────────────────────────── */}
      <div className="px-4 sm:px-6 pt-16 space-y-5">
        {/* Name + Username */}
        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-black text-pestle-text tracking-tight">
              {profile.name}
            </h1>
            <p className="text-xs font-bold" style={accentStyle}>
              {profile.username}
            </p>
            <p className="text-[11px] font-semibold text-gray-400">
              {accountLabel}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEdit(true)}
            className="text-xs font-black py-2 px-4 rounded-2xl border transition-all"
            style={{ ...accentStyle, ...accentBgStyle, ...accentBorderStyle }}
          >
            <Edit3 size={13} className="inline mr-1.5 -mt-0.5" />
            {t('profile_editProfile')}
          </motion.button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">
            {profile.bio}
          </p>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              className="pestle-card rounded-2xl p-3 text-center space-y-1 border border-pestle-border hover:shadow-md transition-shadow cursor-default"
              style={{ borderColor: profile.accentColor + '22' }}
            >
              <Icon size={16} className="mx-auto" style={accentStyle} />
              <p className="text-base sm:text-lg font-black text-pestle-text">{value}</p>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-400">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('community')}
            className="py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg on-accent"
          >
            <Users size={14} /> {t('profile_toCommunity')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('recipe')}
            className="py-2.5 rounded-2xl text-xs font-black border border-pestle-border text-pestle-text hover:border-violet-400 flex items-center justify-center gap-1.5 bg-pestle-card transition-colors"
          >
            <ChefHat size={14} style={accentStyle} /> {t('profile_viewRecipes')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCostCalculator(true)}
            className="py-2.5 rounded-2xl text-xs font-black border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1.5 bg-pestle-card transition-colors shadow-xs"
          >
            <Calculator size={14} /> {t('profile_costCalculator')}
          </motion.button>
        </div>

        {/* ── POST GRID TABS ─────────────────────── */}
        <div className="border-t border-pestle-border pt-4 space-y-4">
          <div className="flex border-b border-pestle-border">
            {(['posts', 'recipes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveGrid(tab)}
                className={`flex-1 pb-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeGrid === tab
                    ? 'text-pestle-text'
                    : 'text-gray-400 border-transparent'
                }`}
                style={activeGrid === tab ? { borderColor: 'var(--color-accent-ink)', color: 'var(--color-accent-ink)' } : {}}
              >
                {tab === 'posts' ? (
                  <><Grid3x3 size={14} /> {t('profile_tabPosts')}</>
                ) : (
                  <><BookOpen size={14} /> {t('profile_tabSavedRecipes')}</>
                )}
              </button>
            ))}
          </div>

          {/* Posts Grid */}
          <AnimatePresence mode="wait">
            {activeGrid === 'posts' && (
              <motion.div
                key="posts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="pestle-card border border-pestle-border rounded-3xl py-12 px-4 text-center flex flex-col items-center gap-3"
              >
                <div
                  className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ backgroundColor: profile.accentColor + '18' }}
                >
                  <Grid3x3 size={28} style={accentStyle} />
                </div>
                <div>
                  <p className="text-sm font-black text-pestle-text">{t('profile_noPostsTitle')}</p>
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
              </motion.div>
            )}

            {activeGrid === 'recipes' && (
              <motion.div
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
                        <img
                          src={r.image}
                          alt={r.title}
                          className="w-20 h-20 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="text-xs font-black text-pestle-text truncate">{r.title}</h4>
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
                    <p className="text-sm font-black text-pestle-text">{t('profile_noSavedRecipes')}</p>
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
              </motion.div>
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
