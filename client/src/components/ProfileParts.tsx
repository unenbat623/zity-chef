import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Heart } from 'lucide-react';
import { SmartImage } from './SmartImage';
import type { FeedPost } from '../hooks/useCommunity';

/**
 * The pieces both profile surfaces share — the signed-in user's Profile tab and
 * the sheet for another chef — so the two read as the same screen for the same
 * kind of thing.
 */

export interface ProfileStat {
  value: number;
  label: string;
  icon?: LucideIcon;
}

/** One grouped card of counters, divided rather than boxed-per-stat. */
export const StatRow: React.FC<{ items: ProfileStat[]; loading?: boolean }> = ({
  items,
  loading,
}) => (
  <div className="flex items-stretch bg-pestle-card border border-pestle-border rounded-2xl py-3 shadow-xs">
    {items.map(({ value, label, icon: Icon }, i) => (
      <React.Fragment key={label}>
        {i > 0 && <div className="w-px bg-pestle-border my-1" />}
        <div className="flex-1 text-center px-1">
          {loading ? (
            <div className="h-5 w-8 mx-auto bg-pestle-bg rounded animate-pulse" />
          ) : (
            <p className="text-lg font-black text-pestle-text tabular-nums leading-none">{value}</p>
          )}
          <p className="text-[10px] font-bold text-gray-400 mt-1.5 flex items-center justify-center gap-1">
            {Icon && <Icon size={11} className="shrink-0" />}
            <span className="truncate">{label}</span>
          </p>
        </div>
      </React.Fragment>
    ))}
  </div>
);

/**
 * Instagram-style square grid of a chef's posts. `columns` is passed in rather
 * than derived from the viewport: the same grid appears full-width on the
 * profile tab and inside a max-w-md sheet, which want different densities at
 * the same screen size.
 */
export const PostsGrid: React.FC<{
  posts: FeedPost[];
  loading?: boolean;
  columns?: string;
  onSelect?: (post: FeedPost) => void;
}> = ({ posts, loading, columns = 'grid-cols-3', onSelect }) => {
  if (loading) {
    return (
      <div className={`grid ${columns} gap-1.5`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square rounded-xl bg-pestle-bg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${columns} gap-1.5`}>
      {posts.map((post) => (
        <button
          key={post.id}
          onClick={onSelect ? () => onSelect(post) : undefined}
          className={`aspect-square rounded-xl overflow-hidden bg-pestle-bg border border-pestle-border relative group text-left ${
            onSelect ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          {post.image ? (
            <SmartImage
              src={post.image}
              alt={post.caption}
              emoji="🍽️"
              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            // A caption-only post gets a deliberate card rather than a big
            // empty square with a line of text floating in it.
            <div className="w-full h-full bg-gradient-to-br from-mango/10 to-transparent flex items-center justify-center p-3">
              <p className="text-[11px] font-bold text-pestle-text line-clamp-5 leading-snug text-center">
                {post.caption}
              </p>
            </div>
          )}

          {post.likes > 0 && (
            <span className="absolute bottom-1 right-1 text-[9px] font-black text-white bg-black/55 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <Heart size={8} className="fill-white" /> {post.likes}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
