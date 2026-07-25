import React, { useState, useRef } from 'react';
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
  BookOpen,
  MessageSquare,
  Camera,
  Smile,
} from 'lucide-react';
import { SmartImage } from './SmartImage';
import { MOCK_RECIPES } from '../constants';

// ── Mock Data ─────────────────────────────────────────────────────────────────
const INITIAL_STORIES = [
  {
    id: 'me',
    name: 'Миний Story',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
    isOwn: true,
    seen: false,
  },
  {
    id: 's1',
    name: 'Болд-Эрдэнэ',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bold',
    seen: false,
    img: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=75',
    caption: 'Өнөөдрийн Карбонара 🍝',
  },
  {
    id: 's2',
    name: 'Сарнай',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarnai',
    seen: true,
    img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=75',
    caption: 'Авокадо тост 🥑',
  },
  {
    id: 's3',
    name: 'Зоригоо',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zorigo',
    seen: false,
    img: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&q=75',
    caption: 'Хонины шөл чанаж байна 🍲',
  },
  {
    id: 's4',
    name: 'Энхтуяа',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Enkh',
    seen: true,
    img: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&q=75',
    caption: 'Өглөөний цай ☕',
  },
];

const INITIAL_POSTS = [
  {
    id: 'p1',
    user: { name: 'Болд-Эрдэнэ', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bold' },
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80',
    caption: 'Маш амттай Карбонара Паста хийлээ! 🍝 Бүх гэр бүл минь дуртай болчихлоо.',
    recipe: null,
    likes: 42,
    liked: false,
    time: '2 цаг',
    comments: [
      { user: 'Сарнай', text: 'Яаж хийсэн бэ? Жорыг хуваалцаарай 👏' },
      { user: 'Зоригоо', text: 'Харахад маш амттай харагдаж байна!' },
    ],
  },
  {
    id: 'p2',
    user: { name: 'Сарнай', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarnai' },
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
    caption: 'Өглөөний хоол: Авокадо тост + гахайн өндөг 🥑 Эрүүл, хурдан, амттай!',
    recipe: MOCK_RECIPES[0],
    likes: 89,
    liked: false,
    time: '4 цаг',
    comments: [{ user: 'Болд-Эрдэнэ', text: 'Минийхтэй адилхан хоол 😍' }],
  },
  {
    id: 'p3',
    user: { name: 'Зоригоо', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zorigo' },
    image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80',
    caption: 'Хонины шөл хийхдээ нууц нь: жижиг гал дээр 3 цаг чанана 🍲',
    recipe: null,
    likes: 156,
    liked: true,
    time: '6 цаг',
    comments: [],
  },
];

// ── Story Creator Modal ────────────────────────────────────────────────────────
const CreateStoryModal: React.FC<{ onClose: () => void; onAddStory: (s: any) => void }> = ({
  onClose,
  onAddStory,
}) => {
  const [caption, setCaption] = useState('');
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
      name: 'Миний Story',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
      isOwn: false,
      seen: false,
      img: imageBase64 || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=75',
      caption: caption.trim() || 'Zity Chef-ээр хийсэн хоол 🍳',
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[300] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-sm bg-pestle-card border border-pestle-border rounded-[28px] p-5 space-y-4 shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-pestle-text flex items-center gap-1.5">
            <Camera size={16} className="text-mango" /> IG Story Оруулах
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-52 bg-pestle-bg border-2 border-dashed border-pestle-border rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative group"
        >
          {imageBase64 ? (
            <img src={imageBase64} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-mango/15 text-mango rounded-full flex items-center justify-center mx-auto">
                <Camera size={22} />
              </div>
              <p className="text-xs font-bold text-pestle-text">Зураг сонгох эсвэл дарах</p>
            </div>
          )}
        </div>

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Story дээр гарах текст..."
          className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
        />

        <button
          onClick={handlePublish}
          className="w-full btn-primary py-3 text-xs font-bold shadow-lg shadow-mango/20"
        >
          Story Нийтлэх ✨
        </button>
      </motion.div>
    </motion.div>
  );
};

// ── Direct Chat Drawer ─────────────────────────────────────────────────────────
const DirectChatDrawer: React.FC<{
  recipient: { name: string; avatar: string };
  onClose: () => void;
}> = ({ recipient, onClose }) => {
  const [messages, setMessages] = useState([
    { sender: recipient.name, text: 'Сайн уу! Өнөөдөр ямар хоол хийж байна?', time: '14:20' },
    { sender: 'Би', text: 'Сайн сайн! Zity Chef-ээр амттай паста хийлээ 🍝', time: '14:22' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender: 'Би', text: inputText.trim(), time: now }]);
    setInputText('');

    // Auto reply simulation
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: recipient.name, text: 'Гоё харагдаж байна! Жороо хуваалцаарай 👨‍🍳', time: now },
      ]);
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-end"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-md h-full bg-pestle-card border-l border-pestle-border flex flex-col shadow-2xl"
      >
        {/* Chat Header */}
        <div className="p-4 border-b border-pestle-border/60 flex items-center justify-between bg-pestle-bg">
          <div className="flex items-center gap-3">
            <img
              src={recipient.avatar}
              alt={recipient.name}
              className="w-10 h-10 rounded-xl border border-pestle-border"
            />
            <div>
              <h3 className="font-extrabold text-sm text-pestle-text">{recipient.name}</h3>
              <span className="text-[10px] text-mint font-bold flex items-center gap-1">
                ● Онлайн байна
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

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((m, idx) => {
            const isMe = m.sender === 'Би';
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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

        {/* Input Bar */}
        <div className="p-3 border-t border-pestle-border/60 bg-pestle-bg flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Зурвас бичих..."
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

// ── Story Viewer Modal ─────────────────────────────────────────────────────────
const StoryViewer: React.FC<{
  story: (typeof INITIAL_STORIES)[0];
  onClose: () => void;
  onChat: () => void;
}> = ({ story, onClose, onChat }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black z-[300] flex items-center justify-center"
    onClick={onClose}
  >
    <div
      className="w-full max-w-sm h-full max-h-[95vh] relative rounded-2xl overflow-hidden flex flex-col justify-between"
      onClick={(e) => e.stopPropagation()}
    >
      {story.img ? (
        <img src={story.img} alt="" className="w-full h-full object-cover absolute inset-0" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-mango to-amber-600 flex items-center justify-center text-8xl absolute inset-0">
          🍳
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      {/* Top Bar */}
      <div className="relative z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={story.avatar} className="w-9 h-9 rounded-full border-2 border-white" alt="" />
          <span className="text-white text-xs font-bold drop-shadow">{story.name}</span>
        </div>
        <button onClick={onClose} className="text-white bg-black/40 rounded-full p-1.5">
          <X size={18} />
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="relative z-10 p-4 space-y-3">
        {story.caption && (
          <p className="text-white text-xs font-bold bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl inline-block">
            {story.caption}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              onChat();
            }}
            className="flex-1 bg-white/20 backdrop-blur-md border border-white/30 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/30"
          >
            <MessageCircle size={15} /> Хариу бичих...
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

// ── Create Post Modal ──────────────────────────────────────────────────────────
const CreatePostModal: React.FC<{ onClose: () => void; onPost: (p: any) => void }> = ({
  onClose,
  onPost,
}) => {
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
      id: `p${Date.now()}`,
      user: { name: 'Миний бичлэг', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me' },
      image: imageBase64 || selectedRecipe?.image || null,
      caption: caption.trim(),
      recipe: selectedRecipe,
      likes: 0,
      liked: false,
      time: 'Яг одоо',
      comments: [],
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/65 backdrop-blur-md z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-base font-extrabold text-pestle-text">Нийтлэл үүсгэх</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-pestle-bg rounded-xl p-1 border border-pestle-border gap-1">
          {(['photo', 'recipe'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${tab === t ? 'bg-mango text-white shadow-sm' : 'text-gray-400'}`}
            >
              {t === 'photo' ? (
                <>
                  <Image size={13} /> Зураг & Текст
                </>
              ) : (
                <>
                  <BookOpen size={13} /> Жор хуваалцах
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
              className="w-full h-40 bg-pestle-bg border-2 border-dashed border-pestle-border rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden hover:border-mango transition-colors group"
            >
              {imageBase64 ? (
                <img src={imageBase64} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 bg-mango/10 text-mango rounded-full flex items-center justify-center mx-auto">
                    <Plus size={20} />
                  </div>
                  <span className="text-xs font-bold text-gray-400 block">Зураг нэмэх</span>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'recipe' && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar">
            {MOCK_RECIPES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className={`text-left rounded-xl overflow-hidden border-2 transition-all ${selectedRecipe?.id === r.id ? 'border-mango' : 'border-pestle-border'}`}
              >
                <SmartImage src={r.image} alt={r.title} emoji="🍽️" className="w-full h-20" />
                <div className="p-2">
                  <p className="text-[10px] font-bold text-pestle-text line-clamp-1">{r.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Хоолынхоо тухай бичнэ үү... орц, нууц, зөвлөмж"
          className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango resize-none"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-xs">
            Болих
          </button>
          <button
            onClick={handlePost}
            className="btn-primary flex-1 py-2.5 text-xs shadow-md shadow-mango/20 flex items-center justify-center gap-1.5"
          >
            <Send size={13} /> Нийтлэх
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Post Card ─────────────────────────────────────────────────────────────────
const PostCard: React.FC<{
  post: any;
  onLike: () => void;
  onComment: (text: string) => void;
  onChat: () => void;
}> = ({ post, onLike, onComment, onChat }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(commentText.trim());
    setCommentText('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pestle-card overflow-hidden"
    >
      {/* Post Header */}
      <div className="flex items-center gap-3 p-3.5 pb-2">
        <button onClick={onChat} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <img
            src={post.user.avatar}
            className="w-9 h-9 rounded-xl border border-pestle-border"
            alt=""
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-pestle-text">{post.user.name}</p>
            <p className="text-[10px] text-gray-400 font-medium">{post.time}</p>
          </div>
        </button>

        <button
          onClick={onChat}
          className="px-2.5 py-1 rounded-xl bg-pestle-bg border border-pestle-border text-[11px] font-bold text-pestle-text hover:border-mango flex items-center gap-1"
        >
          <MessageSquare size={12} className="text-mango" /> Чатлах
        </button>

        {post.recipe && (
          <span className="text-[9px] font-extrabold bg-mint/15 text-mint px-2 py-0.5 rounded-full flex items-center gap-1 border border-mint/20">
            <ChefHat size={9} /> Жор
          </span>
        )}
      </div>

      {/* Image */}
      {(post.image || post.recipe?.image) && (
        <SmartImage
          src={post.image || post.recipe?.image}
          alt={post.caption}
          emoji="🍽️"
          className="w-full h-56"
        />
      )}

      {/* Recipe badge overlay */}
      {post.recipe && (
        <div className="px-3.5 py-2 bg-gradient-to-r from-mint/10 to-transparent border-b border-pestle-border/60 flex items-center gap-2">
          <BookOpen size={12} className="text-mint" />
          <span className="text-[10px] font-bold text-mint">{post.recipe.title}</span>
          <span className="text-[10px] text-gray-400 ml-auto">{post.recipe.time}</span>
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-3.5 py-2.5">
          <p className="text-xs text-pestle-text leading-relaxed">{post.caption}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-3.5 pb-3 flex items-center gap-4 border-t border-pestle-border/40 pt-2.5">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 text-xs font-bold transition-all ${post.liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
        >
          <Heart size={16} fill={post.liked ? 'currentColor' : 'none'} />
          <span>{post.likes}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-pestle-text transition-colors"
        >
          <MessageCircle size={16} />
          <span>{post.comments.length}</span>
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3.5 pb-3 space-y-2 border-t border-pestle-border/40 pt-2"
          >
            {post.comments.map((c: any, i: number) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="font-extrabold text-pestle-text shrink-0">{c.user}</span>
                <span className="text-gray-500">{c.text}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                placeholder="Сэтгэгдэл бичих..."
                className="flex-1 bg-pestle-bg border border-pestle-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-mango"
              />
              <button
                onClick={handleComment}
                className="bg-mango text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Community View ────────────────────────────────────────────────────────
export const CommunityView: React.FC = () => {
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [activeStory, setActiveStory] = useState<(typeof INITIAL_STORIES)[0] | null>(null);
  const [chatUser, setChatUser] = useState<{ name: string; avatar: string } | null>(null);

  const handleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
  };

  const handleComment = (postId: string, text: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, { user: 'Би', text }] } : p
      )
    );
  };

  const handleNewPost = (post: any) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleAddStory = (story: any) => {
    setStories((prev) => [story, ...prev]);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-pestle-text tracking-tight">
            Хамтын орчин
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            Жор хуваалцаж, бусадтай чатлаарай
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateStory(true)}
            className="bg-pestle-card border border-pestle-border py-2.5 px-3 rounded-xl text-xs font-bold text-pestle-text hover:border-mango flex items-center gap-1.5"
          >
            <Camera size={15} className="text-mango" />
            <span className="hidden xs:inline">Story Нэмэх</span>
          </button>

          <button
            onClick={() => setShowCreatePost(true)}
            className="btn-primary py-2.5 px-4 text-xs flex items-center gap-1.5 shadow-md shadow-mango/20"
          >
            <Plus size={15} />
            <span>Нийтлэх</span>
          </button>
        </div>
      </div>

      {/* Stories Strip */}
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6">
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => (story.isOwn ? setShowCreateStory(true) : setActiveStory(story))}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div
              className={`w-16 h-16 rounded-2xl overflow-hidden border-2 relative ${story.seen ? 'border-pestle-border' : 'border-mango'}`}
            >
              {story.isOwn ? (
                <div className="w-full h-full bg-gradient-to-br from-mango/20 to-amber-400/20 flex items-center justify-center">
                  <div className="w-7 h-7 bg-mango rounded-full flex items-center justify-center">
                    <Plus size={16} className="text-white" />
                  </div>
                </div>
              ) : (
                <SmartImage src={story.img} alt={story.name} emoji="👤" className="w-full h-full" />
              )}
            </div>
            <span className="text-[10px] font-bold text-pestle-text text-center w-16 truncate">
              {story.isOwn ? 'Нэмэх' : story.name.split('-')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Post Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={() => handleLike(post.id)}
            onComment={(text) => handleComment(post.id, text)}
            onChat={() => setChatUser(post.user)}
          />
        ))}
      </div>

      {/* Modals & Drawers */}
      <AnimatePresence>
        {activeStory && (
          <StoryViewer
            story={activeStory}
            onClose={() => setActiveStory(null)}
            onChat={() => setChatUser({ name: activeStory.name, avatar: activeStory.avatar })}
          />
        )}
        {showCreateStory && (
          <CreateStoryModal onClose={() => setShowCreateStory(false)} onAddStory={handleAddStory} />
        )}
        {showCreatePost && (
          <CreatePostModal onClose={() => setShowCreatePost(false)} onPost={handleNewPost} />
        )}
        {chatUser && <DirectChatDrawer recipient={chatUser} onClose={() => setChatUser(null)} />}
      </AnimatePresence>
    </div>
  );
};
