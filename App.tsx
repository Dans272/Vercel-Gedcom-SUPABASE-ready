import React, { useState, useRef, useMemo } from 'react';
import { useSession } from './hooks/useSession';
import { useArchiveStore } from './hooks/useArchiveStore';
import { useGedcomImport } from './hooks/useGedcomImport';
import { useProfileEditor } from './hooks/useProfileEditor';
import { useMediaAttach } from './hooks/useMediaAttach';
import {
  LogOut, Search, GitBranch, RefreshCw, Check, ChevronRight
} from 'lucide-react';
import { AppView } from './types';
import { parseGedcomDate } from './utils/date';
import { compressImage } from './utils/media';
import { getFuzzyScore } from './utils/search';
import { generateAiProfileSummary, getHistoricalContext } from './services/gemini';
import { uploadProfileBanner, uploadCircleBanner, uploadProfileImage } from './src/services/storage';
import Auth from './components/Auth';
import SplashView from './views/SplashView';
import TreesView from './views/TreesView';
import TreeView from './views/TreeView';
import SelectHomeView from './views/SelectHomeView';
import ProfileView from './views/ProfileView';
import EditProfileView from './views/EditProfileView';
import LinkRelativeView from './views/LinkRelativeView';
import CreateMemoryView from './views/CreateMemoryView';
import FamilyCircleView from './views/FamilyCircleView';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isResearchLoading, setIsResearchLoading] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [attachingToEventId, setAttachingToEventId] = useState<string | null>(null);

  const showToast = (message: string) => { setToast({ message }); setTimeout(() => setToast(null), 3000); };

  const session = useSession();
  const store = useArchiveStore(session.user);
  const { activeProfile, selectedTreeForView } = store;

  const gedcom = useGedcomImport({
    user: session.user, setView: session.setView,
    setProfiles: store.setProfiles, setFamilyTrees: store.setFamilyTrees,
    setSelectedTreeId: store.setSelectedTreeId, setActiveProfileId: store.setActiveProfileId,
    toast: showToast,
  });

  const editor = useProfileEditor({
    activeProfile: store.activeProfile, activeProfileId: store.activeProfileId,
    setProfiles: store.setProfiles, toast: showToast,
  });

  const profilePhotoFileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const eventFileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileBannerInputRef = useRef<HTMLInputElement>(null);
  const circleBannerInputRef = useRef<HTMLInputElement>(null);

  const media = useMediaAttach({
    activeProfileId: store.activeProfileId, view: session.view,
    attachingToEventId, setAttachingToEventId,
    setProfiles: store.setProfiles, setEditImageUrl: editor.setEditImageUrl,
    toast: showToast,
    userId: session.user?.id,
  });

  const handleLogout = () => { store.clearAll(); session.logout(); showToast('Signed out'); };

  // Profile banner → Supabase Storage
  const handleProfileBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store.activeProfileId) return;
    try {
      const base64 = await compressImage(file);
      let url = base64;
      if (session.user?.id) { try { url = await uploadProfileBanner(session.user.id, store.activeProfileId, base64); } catch { /* keep base64 */ } }
      store.setProfiles(prev => prev.map(p => p.id === store.activeProfileId ? { ...p, bannerUrl: url } : p));
      showToast('Banner updated');
    } catch (err) { console.error(err); showToast('Error processing banner'); } finally { e.target.value = ''; }
  };

  // Circle banner → Supabase Storage
  const handleCircleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      let url = base64;
      if (session.user?.id) { try { url = await uploadCircleBanner(session.user.id, base64); } catch { /* keep base64 */ } }
      store.setCircleSettings(prev => ({ ...prev, bannerUrl: url }));
      showToast('Cover updated');
    } catch (err) { console.error(err); showToast('Error processing cover image'); } finally { e.target.value = ''; }
  };

  const handleGeneratePortrait = async () => {
    if (!activeProfile) return;
    setIsGeneratingPortrait(true);
    showToast("Generating historical portrait...");
    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!geminiKey) { showToast("Gemini API key not configured"); setIsGeneratingPortrait(false); return; }
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `A period-accurate, elegant studio portrait of a person named ${activeProfile.name} born in ${activeProfile.birthYear}. Style: historical photographic daguerreotype or charcoal sketch, highly detailed, archival museum quality.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: [{ parts: [{ text: prompt }] }],
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData) {
          const base64 = `data:image/png;base64,${part.inlineData.data}`;
          let url = base64;
          if (session.user?.id && store.activeProfileId) {
            try { url = await uploadProfileImage(session.user.id, store.activeProfileId, base64); } catch { /* keep base64 */ }
          }
          store.setProfiles(prev => prev.map(p => p.id === store.activeProfileId ? { ...p, imageUrl: url } : p));
          showToast("AI Portrait Created");
          break;
        }
      }
    } catch (err) { console.error(err); showToast("Failed to generate portrait"); } finally { setIsGeneratingPortrait(false); }
  };

  const handleGenerateSummary = async () => {
    if (!activeProfile) return;
    setIsAiLoading(true);
    try {
      const summary = await generateAiProfileSummary(activeProfile);
      store.setProfiles(prev => prev.map(p => p.id === store.activeProfileId ? { ...p, summary } : p));
      showToast("AI Summary Generated");
    } catch (err) { console.error(err); showToast("Summary generation failed"); }
    setIsAiLoading(false);
  };

  const handleResearch = async () => {
    if (!activeProfile) return;
    setIsResearchLoading(true);
    showToast("Mining historical archives...");
    try {
      const context = await getHistoricalContext(activeProfile);
      store.setProfiles(prev => prev.map(p => p.id === store.activeProfileId ? { ...p, historicalContext: context } : p));
      showToast("Historical Research Complete");
    } catch (err) { console.error(err); showToast("Research failed"); }
    setIsResearchLoading(false);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return store.profiles.map(p => ({ p, s: getFuzzyScore(p.name, q) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10).map(x => x.p);
  }, [searchQuery, store.profiles]);

  // unused but kept for possible future use
  const sortedTimeline = useMemo(() => {
    if (!activeProfile) return [];
    return [...activeProfile.timeline].sort((a, b) => parseGedcomDate(a.date) - parseGedcomDate(b.date));
  }, [activeProfile]);

  const renderContent = () => {
    switch (session.view) {
      case AppView.SPLASH: return <SplashView />;
      case AppView.LOGIN: return <Auth onLogin={(u) => session.login(u)} />;
      case AppView.SELECT_HOME: return <SelectHomeView pendingImport={gedcom.pendingImport} onBack={() => session.setView(AppView.HOME)} onChooseHome={gedcom.chooseHome} />;
      case AppView.TREES: return <TreesView trees={store.familyTrees} selectedTreeId={store.selectedTreeId} onBack={() => session.setView(AppView.HOME)} onSelectTree={(id) => store.setSelectedTreeId(id)} onOpenTree={(id) => { store.setTreeViewId(id); session.setView(AppView.TREE_VIEW); }} />;
      case AppView.TREE_VIEW: {
        if (!selectedTreeForView) return null;
        return <TreeView tree={selectedTreeForView} profiles={store.profiles} onBack={() => session.setView(AppView.TREES)} onOpenProfile={(id) => { store.setActiveProfileId(id); session.setView(AppView.PROFILE); }} />;
      }
      case AppView.FAMILY_CIRCLE: {
        if (!session.user) return null;
        return (
          <FamilyCircleView user={session.user} profiles={store.profiles} posts={store.circlePosts} circleSettings={store.circleSettings}
            onBack={() => session.setView(AppView.HOME)} onAddPost={store.addCirclePost} onDeletePost={store.deleteCirclePost}
            onProfileClick={(id) => { store.setActiveProfileId(id); session.setView(AppView.PROFILE); }}
            onBannerUploadClick={() => circleBannerInputRef.current?.click()} onBannerFileChange={handleCircleBannerUpload} bannerInputRef={circleBannerInputRef} />
        );
      }
      case AppView.HOME: return (
        <div className="flex flex-col h-full bg-[#f9f8f6]">
          <header className="pt-16 px-8 pb-6 bg-[#f5f2eb] border-b border-stone-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-serif text-slate-800">Archive</h2>
                <p className="text-stone-400 text-[10px] font-bold uppercase">{session.user?.name}</p>
              </div>
              <button onClick={handleLogout} className="p-2 bg-white rounded-full border border-stone-200 text-stone-300 hover:text-red-500"><LogOut size={18} /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
              <input ref={searchInputRef} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }} placeholder="Find a family member..." className="w-full bg-white border border-stone-100 rounded-2xl py-3 pl-12 pr-4 outline-none font-serif shadow-sm focus:ring-2 focus:ring-amber-200" />
              {showSearchResults && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl z-30 overflow-hidden max-h-96">
                  {searchResults.length > 0 ? searchResults.map(p => (
                    <button key={p.id} onClick={() => { store.setActiveProfileId(p.id); session.setView(AppView.PROFILE); setShowSearchResults(false); setSearchQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b last:border-0 flex items-center space-x-3">
                      <img src={p.imageUrl} className="w-10 h-10 rounded-xl object-cover grayscale" />
                      <div><span className="font-serif text-sm block">{p.name}</span><span className="text-[10px] text-stone-300 uppercase">{p.birthYear} — {p.deathYear || '...'}</span></div>
                    </button>
                  )) : <div className="p-8 text-center text-xs font-serif text-stone-300">No records found.</div>}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-8 space-y-8 overflow-y-auto scrollbar-hide pb-20">
            {store.loading ? (
              <div className="py-20 text-center space-y-6"><RefreshCw size={32} className="mx-auto text-stone-300 animate-spin" /><p className="font-serif text-stone-400 italic">Loading archive…</p></div>
            ) : store.profiles.length === 0 ? (
              <div className="py-20 text-center space-y-6">
                <GitBranch size={48} className="mx-auto text-stone-200" />
                <p className="font-serif text-stone-500 italic">Archive is empty.</p>
                <label htmlFor="gedcomFile" className="bg-stone-900 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[11px] inline-block cursor-pointer">Import GEDCOM</label>
              </div>
            ) : (
              <section className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Library</h3>
                  <div className="flex items-center gap-3">
                    <button onClick={() => session.setView(AppView.FAMILY_CIRCLE)} className="text-[10px] font-bold uppercase text-amber-600">Circle</button>
                    <button onClick={() => session.setView(AppView.TREES)} className="text-[10px] font-bold uppercase text-amber-600">Trees</button>
                  </div>
                </div>
                <div className="grid gap-3">
                  {store.profiles.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { store.setActiveProfileId(p.id); session.setView(AppView.PROFILE); }} className="w-full bg-white p-4 rounded-[32px] shadow-sm border border-stone-50 flex items-center space-x-4 hover:shadow-md transition-all">
                      <img src={p.imageUrl} className="w-14 h-14 rounded-2xl object-cover grayscale" />
                      <div className="text-left flex-1"><h4 className="font-serif text-xl">{p.name}</h4><p className="text-[10px] text-stone-400 font-black uppercase mt-1">{p.birthYear} — {p.deathYear || '...'}</p></div>
                      <ChevronRight className="text-stone-200" size={18} />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>
          <input id="gedcomFile" type="file" ref={gedcom.gedFileInputRef} onChange={gedcom.handleGedcomUpload} accept=".ged,.GED,.gedcom,.txt,text/plain" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
        </div>
      );

      case AppView.PROFILE: {
        if (!activeProfile) return null;
        return (
          <ProfileView activeProfile={activeProfile} profiles={store.profiles} familyTrees={store.familyTrees} selectedTreeId={store.selectedTreeId}
            onBack={() => session.setView(AppView.HOME)}
            onEdit={() => { editor.startEdit(); session.setView(AppView.EDIT_PROFILE); }}
            onLinkRelative={(role) => { editor.setLinkRole(role); session.setView(AppView.LINK_RELATIVE); }}
            onDeleteProfile={() => { const did = editor.deleteProfile(window.confirm); if (did) session.setView(AppView.HOME); }}
            onSetActiveProfile={(id) => { store.setActiveProfileId(id); session.setView(AppView.PROFILE); }}
            onUploadMediaClick={() => profilePhotoFileInputRef.current?.click()} onMediaFileChange={media.handleProfilePhotoUpload} mediaInputRef={profilePhotoFileInputRef}
            onEventMediaUpload={media.handleEventMediaUpload}
            onBannerUploadClick={() => profileBannerInputRef.current?.click()} onBannerFileChange={handleProfileBannerUpload} bannerInputRef={profileBannerInputRef}
            attachingToEventId={attachingToEventId} setAttachingToEventId={setAttachingToEventId}
            isAiLoading={isAiLoading} isResearchLoading={isResearchLoading} isPhotoLoading={media.isPhotoLoading} isGeneratingPortrait={isGeneratingPortrait}
            onGenerateSummary={handleGenerateSummary} onResearch={handleResearch} onGeneratePortrait={handleGeneratePortrait} showToast={showToast} />
        );
      }

      case AppView.EDIT_PROFILE: return (
        <EditProfileView editName={editor.editName} setEditName={editor.setEditName}
          editGender={editor.editGender} setEditGender={editor.setEditGender}
          editBirthYear={editor.editBirthYear} setEditBirthYear={editor.setEditBirthYear}
          editDeathYear={editor.editDeathYear} setEditDeathYear={editor.setEditDeathYear}
          editImageUrl={editor.editImageUrl} setEditImageUrl={editor.setEditImageUrl}
          editBannerUrl={editor.editBannerUrl} setEditBannerUrl={editor.setEditBannerUrl}
          onBack={() => session.setView(AppView.PROFILE)} onSave={() => { editor.saveEdit(); session.setView(AppView.PROFILE); }} />
      );

      case AppView.LINK_RELATIVE: return (
        <LinkRelativeView linkRole={editor.linkRole} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults}
          onBack={() => session.setView(AppView.PROFILE)} onSelect={(p) => { editor.linkRelative(p); session.setView(AppView.PROFILE); setSearchQuery(''); }} />
      );

      case AppView.CREATE_MEMORY: return (
        <CreateMemoryView newMemoryInput={editor.newMemoryInput} setNewMemoryInput={editor.setNewMemoryInput}
          onBack={() => session.setView(AppView.PROFILE)} onSave={() => { editor.saveMemory(); session.setView(AppView.PROFILE); }} />
      );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#e5e1d8] flex flex-col items-center justify-center p-4">
      <div className="relative w-full h-[90vh] md:w-[390px] md:h-[844px] bg-white rounded-[40px] shadow-2xl overflow-hidden border-8 border-stone-800">
        <div className="w-full h-full relative overflow-hidden">{renderContent()}</div>
        {toast && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce">
            <div className="bg-stone-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 text-[10px] font-bold uppercase">
              <Check size={14} className="text-emerald-500" /><span>{toast.message}</span>
            </div>
          </div>
        )}
        {session.migrating && (
          <div className="absolute inset-0 bg-black/40 z-[300] flex flex-col items-center justify-center space-y-4">
            <RefreshCw size={32} className="text-white animate-spin" />
            <p className="text-white text-[11px] font-bold uppercase tracking-widest">Migrating data…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
