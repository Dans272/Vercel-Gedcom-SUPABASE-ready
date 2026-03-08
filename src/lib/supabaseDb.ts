/**
 * supabaseDb.ts – Supabase Postgres CRUD layer.
 *
 * Maps between the UI types (types.ts) and normalised Postgres rows.
 * Every function is resilient: try/catch with console.error and safe fallbacks.
 */

import { supabase } from './supabaseClient';
import type {
  Profile,
  FamilyTree,
  CirclePost,
  CircleAttachment,
  CircleSettings,
  LifeEvent,
  Memory,
  MediaItem,
} from '../../types';
import { gedcomDateToSortKey } from '../../utils/gedcom';

// ────────────────────────────────────────────────────────────────────────────
// Row shapes (what goes into / comes out of Postgres)
// ────────────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  gender: string | null;
  birth_year: string;
  death_year: string | null;
  image_url: string;
  banner_url: string;
  summary: string;
  is_memorial: boolean;
  parent_ids: string[];
  child_ids: string[];
  spouse_ids: string[];
  historical_context: { text: string; sources: unknown[] } | null;
  sources: string[];
}

interface TimelineEventRow {
  id: string;
  profile_id: string;
  user_id: string;
  type: string;
  date: string;
  sort_date: number;
  place: string;
  spouse_name: string | null;
  media: MediaItem[];
}

interface MemoryRow {
  id: string;
  profile_id: string;
  user_id: string;
  type: string;
  content: string;
  timestamp: string;
}

interface FamilyTreeRow {
  id: string;
  user_id: string;
  name: string;
  home_person_id: string;
  member_ids: string[];
  created_at: string;
}

interface CirclePostRow {
  id: string;
  user_id: string;
  author_label: string;
  body: string;
  tagged_profile_ids: string[];
  created_at: string;
}

interface CircleAttachmentRow {
  id: string;
  post_id: string;
  user_id: string;
  kind: string;
  name: string;
  file_url: string;
  size: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers: UI type → row
// ────────────────────────────────────────────────────────────────────────────

function profileToRow(p: Profile, uid: string): ProfileRow {
  return {
    id: p.id,
    user_id: uid,
    name: p.name,
    gender: p.gender ?? null,
    birth_year: p.birthYear,
    death_year: p.deathYear ?? null,
    image_url: p.imageUrl,
    banner_url: p.bannerUrl ?? '',
    summary: p.summary,
    is_memorial: p.isMemorial ?? false,
    parent_ids: p.parentIds,
    child_ids: p.childIds,
    spouse_ids: p.spouseIds,
    historical_context: p.historicalContext ?? null,
    sources: p.sources ?? [],
  };
}

function eventToRow(ev: LifeEvent, profileId: string, uid: string): TimelineEventRow {
  return {
    id: ev.id,
    profile_id: profileId,
    user_id: uid,
    type: ev.type,
    date: ev.date,
    sort_date: gedcomDateToSortKey(ev.date),
    place: ev.place,
    spouse_name: ev.spouseName ?? null,
    media: ev.media ?? [],
  };
}

function memoryToRow(m: Memory, profileId: string, uid: string): MemoryRow {
  return {
    id: m.id,
    profile_id: profileId,
    user_id: uid,
    type: m.type,
    content: m.content,
    timestamp: m.timestamp,
  };
}

function treeToRow(t: FamilyTree, uid: string): FamilyTreeRow {
  return {
    id: t.id,
    user_id: uid,
    name: t.name,
    home_person_id: t.homePersonId,
    member_ids: t.memberIds,
    created_at: t.createdAt,
  };
}

function postToRow(p: CirclePost, uid: string): CirclePostRow {
  return {
    id: p.id,
    user_id: uid,
    author_label: p.authorLabel,
    body: p.body,
    tagged_profile_ids: p.taggedProfileIds,
    created_at: p.createdAt,
  };
}

function attachmentToRow(a: CircleAttachment, postId: string, uid: string): CircleAttachmentRow {
  return {
    id: a.id,
    post_id: postId,
    user_id: uid,
    kind: a.kind,
    name: a.name,
    file_url: a.dataUrl,
    size: a.size ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers: row → UI type
// ────────────────────────────────────────────────────────────────────────────

function rowToProfile(r: ProfileRow, events: LifeEvent[], memories: Memory[]): Profile {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    gender: (r.gender as Profile['gender']) ?? undefined,
    birthYear: r.birth_year,
    deathYear: r.death_year ?? undefined,
    imageUrl: r.image_url,
    bannerUrl: r.banner_url || undefined,
    summary: r.summary,
    isMemorial: r.is_memorial,
    parentIds: r.parent_ids ?? [],
    childIds: r.child_ids ?? [],
    spouseIds: r.spouse_ids ?? [],
    historicalContext: r.historical_context ?? undefined,
    sources: (r.sources as string[]) ?? [],
    timeline: events,
    memories,
  };
}

function rowToEvent(r: TimelineEventRow): LifeEvent {
  return {
    id: r.id,
    type: r.type,
    date: r.date,
    place: r.place,
    spouseName: r.spouse_name ?? undefined,
    media: (r.media as MediaItem[]) ?? [],
  };
}

function rowToMemory(r: MemoryRow): Memory {
  return {
    id: r.id,
    type: r.type as Memory['type'],
    content: r.content,
    timestamp: r.timestamp,
  };
}

function rowToTree(r: FamilyTreeRow): FamilyTree {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    createdAt: r.created_at,
    homePersonId: r.home_person_id,
    memberIds: r.member_ids ?? [],
  };
}

function rowToAttachment(r: CircleAttachmentRow): CircleAttachment {
  return {
    id: r.id,
    kind: r.kind as CircleAttachment['kind'],
    name: r.name,
    dataUrl: r.file_url, // keep field name for UI compat
    size: r.size ?? undefined,
  };
}

function rowToPost(r: CirclePostRow, attachments: CircleAttachment[]): CirclePost {
  return {
    id: r.id,
    userId: r.user_id,
    createdAt: r.created_at,
    authorLabel: r.author_label,
    body: r.body,
    attachments,
    taggedProfileIds: r.tagged_profile_ids ?? [],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// FETCH ALL – single round-trip-ish load
// ────────────────────────────────────────────────────────────────────────────

export async function fetchAllUserData(userId: string): Promise<{
  profiles: Profile[];
  familyTrees: FamilyTree[];
  circlePosts: CirclePost[];
  circleSettings: CircleSettings;
}> {
  try {
    const [profRes, evRes, memRes, treeRes, postRes, attRes, settRes] = await Promise.all([
      supabase.from('app_profiles').select('*').eq('user_id', userId),
      supabase.from('profile_timeline_events').select('*').eq('user_id', userId).order('sort_date', { ascending: true }),
      supabase.from('profile_memories').select('*').eq('user_id', userId),
      supabase.from('family_trees').select('*').eq('user_id', userId),
      supabase.from('circle_posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('circle_attachments').select('*').eq('user_id', userId),
      supabase.from('circle_settings').select('*').eq('user_id', userId).limit(1),
    ]);

    const eventsByProfile = new Map<string, LifeEvent[]>();
    for (const r of (evRes.data ?? []) as TimelineEventRow[]) {
      const list = eventsByProfile.get(r.profile_id) ?? [];
      list.push(rowToEvent(r));
      eventsByProfile.set(r.profile_id, list);
    }

    const memoriesByProfile = new Map<string, Memory[]>();
    for (const r of (memRes.data ?? []) as MemoryRow[]) {
      const list = memoriesByProfile.get(r.profile_id) ?? [];
      list.push(rowToMemory(r));
      memoriesByProfile.set(r.profile_id, list);
    }

    const attachmentsByPost = new Map<string, CircleAttachment[]>();
    for (const r of (attRes.data ?? []) as CircleAttachmentRow[]) {
      const list = attachmentsByPost.get(r.post_id) ?? [];
      list.push(rowToAttachment(r));
      attachmentsByPost.set(r.post_id, list);
    }

    const profiles = ((profRes.data ?? []) as ProfileRow[]).map((r) =>
      rowToProfile(r, eventsByProfile.get(r.id) ?? [], memoriesByProfile.get(r.id) ?? [])
    );
    const familyTrees = ((treeRes.data ?? []) as FamilyTreeRow[]).map(rowToTree);
    const circlePosts = ((postRes.data ?? []) as CirclePostRow[]).map((r) =>
      rowToPost(r, attachmentsByPost.get(r.id) ?? [])
    );
    const sRow = (settRes.data ?? [])[0] as { user_id: string; title: string; banner_url: string } | undefined;
    const circleSettings: CircleSettings = sRow
      ? { userId: sRow.user_id, title: sRow.title, bannerUrl: sRow.banner_url }
      : { userId, title: 'Family Circle', bannerUrl: '' };

    return { profiles, familyTrees, circlePosts, circleSettings };
  } catch (err) {
    console.error('fetchAllUserData failed:', err);
    return {
      profiles: [],
      familyTrees: [],
      circlePosts: [],
      circleSettings: { userId, title: 'Family Circle', bannerUrl: '' },
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Idempotency check — does this user already have data in Supabase?
// ────────────────────────────────────────────────────────────────────────────

export async function userHasData(userId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('app_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SYNC helpers — upsert current state, remove orphans
// ────────────────────────────────────────────────────────────────────────────

/** Batch insert helper (Supabase caps at ~1000 rows per insert). */
async function batchInsert<T extends object>(
  table: string,
  rows: T[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500) as unknown as Record<string, unknown>[];
    const { error } = await supabase.from(table).insert(chunk);
    if (error) console.error(`batchInsert(${table}) error:`, error);
  }
}

/** Return IDs in the DB that are NOT in the provided set — those are orphans to delete. */
async function orphanIds(
  table: string,
  userId: string,
  currentIds: Set<string>
): Promise<string[]> {
  const { data } = await supabase.from(table).select('id').eq('user_id', userId);
  return ((data ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !currentIds.has(id));
}

export async function syncProfiles(userId: string, profiles: Profile[]): Promise<void> {
  try {
    if (profiles.length === 0) {
      await supabase.from('profile_timeline_events').delete().eq('user_id', userId);
      await supabase.from('profile_memories').delete().eq('user_id', userId);
      await supabase.from('app_profiles').delete().eq('user_id', userId);
      return;
    }

    // Upsert profile rows
    const rows = profiles.map((p) => profileToRow(p, userId));
    const { error: upErr } = await supabase.from('app_profiles').upsert(rows, { onConflict: 'id' });
    if (upErr) console.error('syncProfiles upsert error:', upErr);

    // Delete orphan profiles
    const toDelete = await orphanIds('app_profiles', userId, new Set(profiles.map((p) => p.id)));
    if (toDelete.length > 0) {
      await supabase.from('app_profiles').delete().in('id', toDelete);
    }

    // Rebuild child tables (simpler than per-row diffing)
    await supabase.from('profile_timeline_events').delete().eq('user_id', userId);
    await supabase.from('profile_memories').delete().eq('user_id', userId);

    const allEvents: TimelineEventRow[] = [];
    const allMemories: MemoryRow[] = [];
    for (const p of profiles) {
      for (const ev of p.timeline ?? []) allEvents.push(eventToRow(ev, p.id, userId));
      for (const m of p.memories ?? []) allMemories.push(memoryToRow(m, p.id, userId));
    }
    await batchInsert('profile_timeline_events', allEvents);
    await batchInsert('profile_memories', allMemories);
  } catch (err) {
    console.error('syncProfiles failed:', err);
  }
}

export async function syncFamilyTrees(userId: string, trees: FamilyTree[]): Promise<void> {
  try {
    if (trees.length === 0) {
      await supabase.from('family_trees').delete().eq('user_id', userId);
      return;
    }
    const rows = trees.map((t) => treeToRow(t, userId));
    const { error } = await supabase.from('family_trees').upsert(rows, { onConflict: 'id' });
    if (error) console.error('syncFamilyTrees upsert error:', error);

    const toDelete = await orphanIds('family_trees', userId, new Set(trees.map((t) => t.id)));
    if (toDelete.length > 0) {
      await supabase.from('family_trees').delete().in('id', toDelete);
    }
  } catch (err) {
    console.error('syncFamilyTrees failed:', err);
  }
}

export async function syncCirclePosts(userId: string, posts: CirclePost[]): Promise<void> {
  try {
    if (posts.length === 0) {
      await supabase.from('circle_attachments').delete().eq('user_id', userId);
      await supabase.from('circle_posts').delete().eq('user_id', userId);
      return;
    }
    const postRows = posts.map((p) => postToRow(p, userId));
    const { error } = await supabase.from('circle_posts').upsert(postRows, { onConflict: 'id' });
    if (error) console.error('syncCirclePosts upsert error:', error);

    const toDelete = await orphanIds('circle_posts', userId, new Set(posts.map((p) => p.id)));
    if (toDelete.length > 0) {
      await supabase.from('circle_posts').delete().in('id', toDelete);
    }

    // Rebuild attachments
    await supabase.from('circle_attachments').delete().eq('user_id', userId);
    const allAtts: CircleAttachmentRow[] = [];
    for (const p of posts) {
      for (const a of p.attachments ?? []) allAtts.push(attachmentToRow(a, p.id, userId));
    }
    await batchInsert('circle_attachments', allAtts);
  } catch (err) {
    console.error('syncCirclePosts failed:', err);
  }
}

export async function syncCircleSettings(userId: string, settings: CircleSettings): Promise<void> {
  try {
    const { error } = await supabase.from('circle_settings').upsert(
      { user_id: userId, title: settings.title, banner_url: settings.bannerUrl },
      { onConflict: 'user_id' }
    );
    if (error) console.error('syncCircleSettings error:', error);
  } catch (err) {
    console.error('syncCircleSettings failed:', err);
  }
}
