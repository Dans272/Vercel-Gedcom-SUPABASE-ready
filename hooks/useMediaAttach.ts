import type { Dispatch, SetStateAction, ChangeEvent } from 'react';
import { useState } from 'react';
import { AppView, MediaItem, Profile } from '../types';
import { compressImage } from '../utils/media';
import { inferMediaKind } from '../utils/formatters';
import { uploadProfileImage, uploadEventMedia } from '../src/services/storage';

export const useMediaAttach = (args: {
  activeProfileId: string | null;
  view: AppView;
  attachingToEventId: string | null;
  setAttachingToEventId: (id: string | null) => void;
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  setEditImageUrl: (v: string) => void;
  toast: (m: string) => void;
  userId?: string;
}) => {
  const { activeProfileId, view, attachingToEventId, setAttachingToEventId, setProfiles, setEditImageUrl, toast, userId } = args;
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);

  const handleProfilePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProfileId) return;
    setIsPhotoLoading(true);
    try {
      const base64 = await compressImage(file);
      let url = base64;
      if (userId) {
        try { url = await uploadProfileImage(userId, activeProfileId, base64); } catch { /* keep base64 */ }
      }
      if (view === AppView.EDIT_PROFILE) setEditImageUrl(url);
      else setProfiles((prev) => prev.map((p) => (p.id === activeProfileId ? { ...p, imageUrl: url } : p)));
      toast('Photo updated');
    } catch (err) {
      console.error(err);
      toast('Error processing photo');
    } finally {
      setIsPhotoLoading(false);
      e.target.value = '';
    }
  };

  const handleLifecycleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeProfileId || !attachingToEventId) return;
    toast('Processing...');
    try {
      const newMediaItems: MediaItem[] = await Promise.all(
        Array.from(files).map(async (file: File) => {
          const kind = inferMediaKind(file.name, file.type);
          let url = '';
          if (kind === 'photo') url = await compressImage(file);
          else {
            url = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = (ev) => res(ev.target?.result as string);
              reader.readAsDataURL(file);
            });
          }
          if (userId) {
            try { url = await uploadEventMedia(userId, activeProfileId, attachingToEventId, url, file.name); } catch { /* keep base64 */ }
          }
          return { id: `m-${Date.now()}-${Math.random()}`, name: file.name, kind, url, createdAt: new Date().toISOString() };
        })
      );

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId
            ? { ...p, timeline: (p.timeline || []).map((ev) => ev.id === attachingToEventId ? { ...ev, media: [...(ev.media || []), ...newMediaItems] } : ev) }
            : p
        )
      );
      toast(`Attached ${newMediaItems.length} files`);
    } catch (err) {
      console.error(err);
      toast('Upload error');
    } finally {
      setAttachingToEventId(null);
      e.target.value = '';
    }
  };

  const handleEventMediaUpload = async (eventId: string, files: FileList) => {
    if (!activeProfileId || !files.length) return;
    toast('Processing...');
    try {
      const newMediaItems: MediaItem[] = await Promise.all(
        Array.from(files).map(async (file: File) => {
          const kind = inferMediaKind(file.name, file.type);
          let url = '';
          if (kind === 'photo') url = await compressImage(file);
          else {
            url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
          if (userId) {
            try { url = await uploadEventMedia(userId, activeProfileId, eventId, url, file.name); } catch { /* keep base64 */ }
          }
          return {
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name, kind, url,
            mime: file.type, size: file.size, createdAt: new Date().toISOString(),
          };
        })
      );

      setProfiles(prev =>
        prev.map(p => p.id !== activeProfileId ? p : {
          ...p,
          timeline: p.timeline.map(ev => ev.id !== eventId ? ev : { ...ev, media: [...(ev.media || []), ...newMediaItems] }),
        })
      );
      toast(`Attached ${newMediaItems.length} file${newMediaItems.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      toast('Upload error');
    }
  };

  return { isPhotoLoading, handleProfilePhotoUpload, handleLifecycleFileUpload, handleEventMediaUpload };
};
