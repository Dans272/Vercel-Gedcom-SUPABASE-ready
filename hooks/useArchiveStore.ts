import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CirclePost, CircleSettings, FamilyTree, Profile, User } from '../types';
import {
  fetchAllUserData,
  syncProfiles,
  syncFamilyTrees,
  syncCirclePosts,
  syncCircleSettings,
} from '../src/lib/supabaseDb';

/** Delay before flushing state to Supabase after the last change. */
const DEBOUNCE_MS = 1200;

export const useArchiveStore = (user: User | null) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [treeViewId, setTreeViewId] = useState<string | null>(null);
  const [circlePosts, setCirclePosts] = useState<CirclePost[]>([]);
  const [circleSettings, setCircleSettings] = useState<CircleSettings>({
    userId: '', title: 'Family Circle', bannerUrl: '',
  });
  const [loading, setLoading] = useState(false);

  // Guard: don't persist during initial fetch
  const loadingRef = useRef(false);
  const uidRef = useRef<string | null>(null);

  // ── Load from Supabase on user change ─────────────────────────────────
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setFamilyTrees([]);
      setCirclePosts([]);
      setCircleSettings({ userId: '', title: 'Family Circle', bannerUrl: '' });
      uidRef.current = null;
      return;
    }
    let cancelled = false;
    loadingRef.current = true;
    setLoading(true);

    (async () => {
      try {
        const data = await fetchAllUserData(user.id);
        if (cancelled) return;
        setProfiles(data.profiles.map((p) => ({
          ...p,
          parentIds: p.parentIds ?? [],
          childIds: p.childIds ?? [],
          spouseIds: p.spouseIds ?? [],
          timeline: p.timeline ?? [],
          memories: p.memories ?? [],
          bannerUrl: p.bannerUrl ?? '',
        })));
        setFamilyTrees(data.familyTrees);
        setCirclePosts(data.circlePosts);
        setCircleSettings(data.circleSettings);
        uidRef.current = user.id;
      } catch (err) {
        console.error('[store] Failed to load:', err);
      } finally {
        if (!cancelled) {
          setTimeout(() => { loadingRef.current = false; setLoading(false); }, 100);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Debounced persist watchers ────────────────────────────────────────
  useEffect(() => {
    if (loadingRef.current || !uidRef.current) return;
    const uid = uidRef.current;
    const t = setTimeout(() => { syncProfiles(uid, profiles); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [profiles]);

  useEffect(() => {
    if (loadingRef.current || !uidRef.current) return;
    const uid = uidRef.current;
    const t = setTimeout(() => { syncFamilyTrees(uid, familyTrees); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [familyTrees]);

  useEffect(() => {
    if (loadingRef.current || !uidRef.current) return;
    const uid = uidRef.current;
    const t = setTimeout(() => { syncCirclePosts(uid, circlePosts); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [circlePosts]);

  useEffect(() => {
    if (loadingRef.current || !uidRef.current) return;
    const uid = uidRef.current;
    const t = setTimeout(() => { syncCircleSettings(uid, circleSettings); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [circleSettings]);

  // ── Circle post helpers (same API surface) ────────────────────────────
  const addCirclePost = useCallback((post: CirclePost) => {
    setCirclePosts((prev) => [post, ...prev]);
  }, []);

  const deleteCirclePost = useCallback((id: string) => {
    setCirclePosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateCirclePost = useCallback((id: string, patch: Partial<CirclePost>) => {
    setCirclePosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  const selectedTree = useMemo(
    () => familyTrees.find((t) => t.id === selectedTreeId) || null,
    [familyTrees, selectedTreeId]
  );

  const selectedTreeForView = useMemo(
    () => familyTrees.find((t) => t.id === treeViewId) || null,
    [familyTrees, treeViewId]
  );

  const clearAll = () => {
    uidRef.current = null; // prevent sync watchers from deleting data
    setProfiles([]);
    setFamilyTrees([]);
    setActiveProfileId(null);
    setSelectedTreeId(null);
    setTreeViewId(null);
    setCirclePosts([]);
    setCircleSettings({ userId: '', title: 'Family Circle', bannerUrl: '' });
  };

  return {
    profiles, setProfiles,
    familyTrees, setFamilyTrees,
    activeProfileId, setActiveProfileId,
    selectedTreeId, setSelectedTreeId,
    treeViewId, setTreeViewId,
    activeProfile, selectedTree, selectedTreeForView,
    circlePosts, addCirclePost, deleteCirclePost, updateCirclePost,
    circleSettings, setCircleSettings,
    clearAll,
    loading,
  };
};
