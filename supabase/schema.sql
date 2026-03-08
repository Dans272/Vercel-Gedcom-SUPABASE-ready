-- ============================================================================
-- Eternal Family Archive – Supabase Schema
-- Safe to run multiple times (idempotent).
-- Auth is managed by Supabase; we reference auth.users(id) as user_id.
-- ============================================================================

-- 1. APP PROFILES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_profiles (
  id            text        PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL DEFAULT '',
  gender        text        CHECK (gender IN ('M', 'F', 'U')),
  birth_year    text        NOT NULL DEFAULT '',
  death_year    text,
  image_url     text        NOT NULL DEFAULT '',
  banner_url    text        NOT NULL DEFAULT '',
  summary       text        NOT NULL DEFAULT '',
  is_memorial   boolean     NOT NULL DEFAULT false,
  parent_ids    text[]      NOT NULL DEFAULT '{}',
  child_ids     text[]      NOT NULL DEFAULT '{}',
  spouse_ids    text[]      NOT NULL DEFAULT '{}',
  historical_context jsonb,
  sources       jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON app_profiles(user_id);

ALTER TABLE app_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON app_profiles;
CREATE POLICY "profiles_select" ON app_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_insert" ON app_profiles;
CREATE POLICY "profiles_insert" ON app_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_update" ON app_profiles;
CREATE POLICY "profiles_update" ON app_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_delete" ON app_profiles;
CREATE POLICY "profiles_delete" ON app_profiles FOR DELETE USING (auth.uid() = user_id);

-- 2. PROFILE TIMELINE EVENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_timeline_events (
  id            text        PRIMARY KEY,
  profile_id    text        NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text        NOT NULL DEFAULT 'Event',
  date          text        NOT NULL DEFAULT '',
  sort_date     numeric     NOT NULL DEFAULT 9999,
  place         text        NOT NULL DEFAULT '',
  spouse_name   text,
  media         jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_profile ON profile_timeline_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_events_user    ON profile_timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_sort    ON profile_timeline_events(profile_id, sort_date ASC);

ALTER TABLE profile_timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select" ON profile_timeline_events;
CREATE POLICY "events_select" ON profile_timeline_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_insert" ON profile_timeline_events;
CREATE POLICY "events_insert" ON profile_timeline_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_update" ON profile_timeline_events;
CREATE POLICY "events_update" ON profile_timeline_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_delete" ON profile_timeline_events;
CREATE POLICY "events_delete" ON profile_timeline_events FOR DELETE USING (auth.uid() = user_id);

-- 3. PROFILE MEMORIES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_memories (
  id            text        PRIMARY KEY,
  profile_id    text        NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text        NOT NULL DEFAULT 'story' CHECK (type IN ('story', 'note')),
  content       text        NOT NULL DEFAULT '',
  timestamp     text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_profile ON profile_memories(profile_id);
CREATE INDEX IF NOT EXISTS idx_memories_user    ON profile_memories(user_id);

ALTER TABLE profile_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memories_select" ON profile_memories;
CREATE POLICY "memories_select" ON profile_memories FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "memories_insert" ON profile_memories;
CREATE POLICY "memories_insert" ON profile_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "memories_update" ON profile_memories;
CREATE POLICY "memories_update" ON profile_memories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "memories_delete" ON profile_memories;
CREATE POLICY "memories_delete" ON profile_memories FOR DELETE USING (auth.uid() = user_id);

-- 4. FAMILY TREES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_trees (
  id              text        PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT '',
  home_person_id  text        NOT NULL DEFAULT '',
  member_ids      text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trees_user ON family_trees(user_id);

ALTER TABLE family_trees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trees_select" ON family_trees;
CREATE POLICY "trees_select" ON family_trees FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "trees_insert" ON family_trees;
CREATE POLICY "trees_insert" ON family_trees FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "trees_update" ON family_trees;
CREATE POLICY "trees_update" ON family_trees FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "trees_delete" ON family_trees;
CREATE POLICY "trees_delete" ON family_trees FOR DELETE USING (auth.uid() = user_id);

-- 5. CIRCLE POSTS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circle_posts (
  id                  text        PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_label        text        NOT NULL DEFAULT '',
  body                text        NOT NULL DEFAULT '',
  tagged_profile_ids  text[]      NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user    ON circle_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON circle_posts(created_at DESC);

ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select" ON circle_posts;
CREATE POLICY "posts_select" ON circle_posts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_insert" ON circle_posts;
CREATE POLICY "posts_insert" ON circle_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_update" ON circle_posts;
CREATE POLICY "posts_update" ON circle_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_delete" ON circle_posts;
CREATE POLICY "posts_delete" ON circle_posts FOR DELETE USING (auth.uid() = user_id);

-- 6. CIRCLE ATTACHMENTS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circle_attachments (
  id          text        PRIMARY KEY,
  post_id     text        NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL DEFAULT 'document' CHECK (kind IN ('photo','video','audio','document')),
  name        text        NOT NULL DEFAULT '',
  file_url    text        NOT NULL DEFAULT '',
  size        integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_att_post ON circle_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_att_user ON circle_attachments(user_id);

ALTER TABLE circle_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "att_select" ON circle_attachments;
CREATE POLICY "att_select" ON circle_attachments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "att_insert" ON circle_attachments;
CREATE POLICY "att_insert" ON circle_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "att_update" ON circle_attachments;
CREATE POLICY "att_update" ON circle_attachments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "att_delete" ON circle_attachments;
CREATE POLICY "att_delete" ON circle_attachments FOR DELETE USING (auth.uid() = user_id);

-- 7. CIRCLE SETTINGS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circle_settings (
  user_id     uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Family Circle',
  banner_url  text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circle_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_select" ON circle_settings;
CREATE POLICY "settings_select" ON circle_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_insert" ON circle_settings;
CREATE POLICY "settings_insert" ON circle_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_update" ON circle_settings;
CREATE POLICY "settings_update" ON circle_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_delete" ON circle_settings;
CREATE POLICY "settings_delete" ON circle_settings FOR DELETE USING (auth.uid() = user_id);

-- 8. UPDATED_AT TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON app_profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON app_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON circle_settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON circle_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. STORAGE BUCKETS ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('profile-media', 'profile-media', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('circle-media',  'circle-media',  true) ON CONFLICT DO NOTHING;

-- Storage policies: public read, owner-only write

DROP POLICY IF EXISTS "profile_media_read"   ON storage.objects;
CREATE POLICY "profile_media_read"   ON storage.objects FOR SELECT USING (bucket_id = 'profile-media');
DROP POLICY IF EXISTS "profile_media_insert" ON storage.objects;
CREATE POLICY "profile_media_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "profile_media_update" ON storage.objects;
CREATE POLICY "profile_media_update" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "profile_media_delete" ON storage.objects;
CREATE POLICY "profile_media_delete" ON storage.objects FOR DELETE USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "circle_media_read"   ON storage.objects;
CREATE POLICY "circle_media_read"   ON storage.objects FOR SELECT USING (bucket_id = 'circle-media');
DROP POLICY IF EXISTS "circle_media_insert" ON storage.objects;
CREATE POLICY "circle_media_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'circle-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "circle_media_update" ON storage.objects;
CREATE POLICY "circle_media_update" ON storage.objects FOR UPDATE USING (bucket_id = 'circle-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "circle_media_delete" ON storage.objects;
CREATE POLICY "circle_media_delete" ON storage.objects FOR DELETE USING (bucket_id = 'circle-media' AND (storage.foldername(name))[1] = auth.uid()::text);
