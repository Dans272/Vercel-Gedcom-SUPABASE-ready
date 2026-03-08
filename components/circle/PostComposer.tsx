import React, { useRef, useState } from 'react';
import { Paperclip, Send, X, Image, FileText, Music, Video } from 'lucide-react';
import { CircleAttachment, CirclePost, Profile } from '../../types';
import { PersonPicker } from './PersonPicker';
import { uploadCircleAttachment, isDataUrl } from '../../src/services/storage';

interface PostComposerProps {
  profiles: Profile[];
  authorLabel: string;
  userId: string;
  onSubmit: (post: CirclePost) => void;
}

const kindIcon = (kind: CircleAttachment['kind']) => {
  if (kind === 'photo') return <Image size={12} />;
  if (kind === 'video') return <Video size={12} />;
  if (kind === 'audio') return <Music size={12} />;
  return <FileText size={12} />;
};

const inferKind = (file: File): CircleAttachment['kind'] => {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
};

export const PostComposer: React.FC<PostComposerProps> = ({ profiles, authorLabel, userId, onSubmit }) => {
  const [body, setBody] = useState('');
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<CircleAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawFilesRef = useRef<Map<string, File>>(new Map());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    files.forEach((file: File) => {
      const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      rawFilesRef.current.set(attId, file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments((prev) => [
          ...prev,
          { id: attId, kind: inferKind(file), name: file.name, dataUrl: ev.target?.result as string, size: file.size }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (id: string) => { setAttachments((prev) => prev.filter((a) => a.id !== id)); rawFilesRef.current.delete(id); };

  const handleSubmit = async () => {
    if (!body.trim() && attachments.length === 0) return;
    setIsSubmitting(true);
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Upload attachments to Supabase Storage
    const uploaded: CircleAttachment[] = await Promise.all(
      attachments.map(async (att) => {
        const raw = rawFilesRef.current.get(att.id);
        let url = att.dataUrl;
        try {
          if (raw) url = await uploadCircleAttachment(userId, postId, raw, raw.name);
          else if (isDataUrl(att.dataUrl)) url = await uploadCircleAttachment(userId, postId, att.dataUrl, att.name);
        } catch { /* keep original */ }
        return { ...att, dataUrl: url };
      })
    );

    onSubmit({
      id: postId, userId, createdAt: new Date().toISOString(),
      authorLabel, body: body.trim(), attachments: uploaded, taggedProfileIds: taggedIds,
    });
    setBody(''); setTaggedIds([]); setAttachments([]); rawFilesRef.current.clear();
    setIsSubmitting(false);
  };

  const canSubmit = (body.trim().length > 0 || attachments.length > 0) && !isSubmitting;

  return (
    <div className="bg-white rounded-[28px] border border-stone-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-700 text-[11px] font-black uppercase">{authorLabel.charAt(0)}</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{authorLabel}</span>
      </div>

      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a memory, story, or update with the family circle…" rows={3} className="w-full resize-none bg-stone-50 border border-stone-100 rounded-2xl p-4 font-serif text-[14px] text-slate-700 outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300 leading-relaxed" />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="relative group rounded-xl overflow-hidden border border-stone-100">
              {att.kind === 'photo' ? (
                <img src={att.dataUrl} alt={att.name} className="w-16 h-16 object-cover" />
              ) : (
                <div className="w-16 h-16 bg-stone-50 flex flex-col items-center justify-center gap-1 text-stone-400">
                  {kindIcon(att.kind)}
                  <span className="text-[8px] text-center px-1 truncate w-full">{att.name.slice(0, 10)}</span>
                </div>
              )}
              <button type="button" onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-stone-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
            </div>
          ))}
        </div>
      )}

      {profiles.length > 0 && <PersonPicker profiles={profiles} selectedIds={taggedIds} onChange={setTaggedIds} />}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-stone-400 hover:text-amber-600 transition-colors text-[11px] font-bold uppercase tracking-wider">
          <Paperclip size={14} /> Attach
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${canSubmit ? 'bg-stone-900 text-white hover:bg-stone-700 shadow-sm' : 'bg-stone-100 text-stone-300 cursor-not-allowed'}`}>
          <Send size={12} /> {isSubmitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
};
