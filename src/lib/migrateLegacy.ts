/**
 * migrateLegacy.ts – One-shot, idempotent migration from localStorage to Supabase.
 *
 * Called after first Supabase login when localStorage still has data.
 * Idempotent: skips if the user already has rows in app_profiles.
 * Preserves all existing IDs (profile, tree, post, event, attachment).
 * Remaps the old localStorage userId (e.g. "u-1717000000") to the Supabase Auth UUID.
 * Uploads base64 data-URLs to Storage and rewrites them as public URLs.
 */

import { STORAGE_KEYS } from '../../constants';
import type { Profile, FamilyTree, CirclePost, CircleSettings } from '../../types';
import {
  userHasData,
  syncProfiles,
  syncFamilyTrees,
  syncCirclePosts,
  syncCircleSettings,
} from './supabaseDb';
import {
  isPlaceholderSvg,
  isDataUrl,
  uploadProfileImage,
  uploadProfileBanner,
  uploadCircleAttachment,
  uploadCircleBanner,
  uploadEventMedia,
} from '../services/storage';

// ─── detection ──────────────────────────────────────────────────────────────

export function hasLegacyData(): boolean {
  try {
    const p = localStorage.getItem(STORAGE_KEYS.PROFILES);
    const t = localStorage.getItem(STORAGE_KEYS.FAMILY_TREES);
    const c = localStorage.getItem(STORAGE_KEYS.CIRCLE_POSTS);
    return !!((p && p !== '[]') || (t && t !== '[]') || (c && c !== '[]'));
  } catch {
    return false;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface LegacyUser { id: string; email?: string }

function findOldUserId(email?: string): string | null {
  try {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]') as LegacyUser[];
    if (email) {
      const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (match) return match.id;
    }
    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]') as { userId?: string }[];
    if (profiles.length > 0 && profiles[0].userId) return profiles[0].userId;
    const trees = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAMILY_TREES) || '[]') as { userId?: string }[];
    if (trees.length > 0 && trees[0].userId) return trees[0].userId;
    return users.length > 0 ? users[0].id : null;
  } catch {
    return null;
  }
}

function clearLegacyStorage(): void {
  const keys: string[] = Object.values(STORAGE_KEYS);
  for (const k of keys) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

// ─── main migration ─────────────────────────────────────────────────────────

export async function migrateLegacyData(supabaseUid: string, email?: string): Promise<void> {
  // Idempotency: skip if user already has rows
  if (await userHasData(supabaseUid)) {
    console.log('[migrate] User already has Supabase data — clearing localStorage only.');
    clearLegacyStorage();
    return;
  }

  const oldUserId = findOldUserId(email);
  if (!oldUserId) {
    console.log('[migrate] No old user ID found — clearing stale keys.');
    clearLegacyStorage();
    return;
  }

  console.log(`[migrate] Remapping userId "${oldUserId}" → "${supabaseUid}"`);

  // ── read from localStorage ──────────────────────────────────────────────

  const allProfiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]') as Profile[];
  const allTrees = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAMILY_TREES) || '[]') as FamilyTree[];
  const allPosts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CIRCLE_POSTS) || '[]') as CirclePost[];
  const allSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.CIRCLE_SETTINGS) || '[]') as CircleSettings[];

  const profiles = allProfiles.filter((p) => p.userId === oldUserId);
  const trees = allTrees.filter((t) => t.userId === oldUserId);
  const posts = allPosts.filter((p) => p.userId === oldUserId);
  const settings = allSettings.find((s) => s.userId === oldUserId);

  // ── remap userIds ───────────────────────────────────────────────────────

  for (const p of profiles) p.userId = supabaseUid;
  for (const t of trees) t.userId = supabaseUid;
  for (const post of posts) post.userId = supabaseUid;

  // ── upload images to Storage ────────────────────────────────────────────

  for (const p of profiles) {
    if (p.imageUrl && isDataUrl(p.imageUrl) && !isPlaceholderSvg(p.imageUrl)) {
      p.imageUrl = await uploadProfileImage(supabaseUid, p.id, p.imageUrl);
    }
    if (p.bannerUrl && isDataUrl(p.bannerUrl)) {
      p.bannerUrl = await uploadProfileBanner(supabaseUid, p.id, p.bannerUrl);
    }
    for (const ev of p.timeline ?? []) {
      for (const m of ev.media ?? []) {
        if (m.url && isDataUrl(m.url)) {
          m.url = await uploadEventMedia(supabaseUid, p.id, ev.id, m.url, m.name);
        }
      }
    }
  }

  for (const post of posts) {
    for (const att of post.attachments ?? []) {
      if (att.dataUrl && isDataUrl(att.dataUrl)) {
        att.dataUrl = await uploadCircleAttachment(supabaseUid, post.id, att.dataUrl, att.name);
      }
    }
  }

  let circleSettings: CircleSettings = settings
    ? { ...settings, userId: supabaseUid }
    : { userId: supabaseUid, title: 'Family Circle', bannerUrl: '' };
  if (circleSettings.bannerUrl && isDataUrl(circleSettings.bannerUrl)) {
    circleSettings = { ...circleSettings, bannerUrl: await uploadCircleBanner(supabaseUid, circleSettings.bannerUrl) };
  }

  // ── write to Supabase ───────────────────────────────────────────────────

  await syncProfiles(supabaseUid, profiles);
  await syncFamilyTrees(supabaseUid, trees);
  await syncCirclePosts(supabaseUid, posts);
  await syncCircleSettings(supabaseUid, circleSettings);

  clearLegacyStorage();
  console.log('[migrate] Complete.');
}
