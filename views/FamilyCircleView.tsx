import React from 'react';
import { ChevronLeft, Camera, Globe, Users } from 'lucide-react';
import { CirclePost, CircleSettings, Profile, User } from '../types';
import { PostComposer } from '../components/circle/PostComposer';
import { CircleFeed } from '../components/circle/CircleFeed';

interface FamilyCircleViewProps {
  user: User;
  profiles: Profile[];
  posts: CirclePost[];
  circleSettings: CircleSettings;
  onBack: () => void;
  onAddPost: (post: CirclePost) => void;
  onDeletePost: (id: string) => void;
  onProfileClick: (profileId: string) => void;
  onBannerUploadClick: () => void;
  onBannerFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function FamilyCircleView({
  user,
  profiles,
  posts,
  circleSettings,
  onBack,
  onAddPost,
  onDeletePost,
  onProfileClick,
  onBannerUploadClick,
  onBannerFileChange,
  bannerInputRef
}: FamilyCircleViewProps) {
  const bannerUrl = circleSettings.bannerUrl || '';
  const title = circleSettings.title || 'Family Circle';

  return (
    <div className="flex flex-col h-full bg-[#f9f8f6]">
      {/* Facebook-style cover banner */}
      <div className="relative w-full h-[190px] bg-gradient-to-br from-stone-300 to-stone-400 flex-shrink-0 overflow-hidden">
        {bannerUrl ? (
          <img src={bannerUrl} className="w-full h-full object-cover" alt="Circle cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#c7bea9] to-[#9e9585] flex items-center justify-center">
            <Users size={48} className="text-white/20" />
          </div>
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-14 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm hover:bg-black/60 transition-colors"
        >
          <ChevronLeft size={14} />
          Back
        </button>

        {/* Change cover button */}
        <button
          onClick={onBannerUploadClick}
          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-white/90 text-stone-700 text-[10px] font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Camera size={12} />
          Change cover
        </button>
        <input ref={bannerInputRef} type="file" onChange={onBannerFileChange} accept="image/*" className="hidden" />
      </div>

      {/* Group title bar — Facebook style */}
      <div className="px-6 py-4 bg-white border-b border-stone-200 flex-shrink-0">
        <h2 className="text-2xl font-serif text-slate-900 font-bold">{title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Globe size={12} className="text-stone-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Public group · {profiles.length} {profiles.length === 1 ? 'member' : 'members'} · {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-5 pb-10">
        <PostComposer
          profiles={profiles}
          authorLabel={user.name}
          userId={user.id}
          onSubmit={onAddPost}
        />
        <CircleFeed
          posts={posts}
          profiles={profiles}
          currentUserId={user.id}
          onDeletePost={onDeletePost}
          onProfileClick={onProfileClick}
        />
      </main>
    </div>
  );
}
