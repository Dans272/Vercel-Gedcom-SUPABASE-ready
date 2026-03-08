# Supabase Storage Setup

## Buckets

Two **public** buckets are created by `schema.sql`:

| Bucket | Purpose |
|---|---|
| `profile-media` | Profile photos, banners, AI portraits, and timeline event media |
| `circle-media` | Circle post attachments (photos, videos, audio, docs) and circle banners |

## Path Layout

```
profile-media/
  {user_id}/
    {profile_id}/
      avatar-xxxx.jpg
      banner/
        banner-xxxx.jpg
      events/
        {event_id}/
          media-xxxx.jpg

circle-media/
  {user_id}/
    circle-banner/
      banner-xxxx.jpg
    {post_id}/
      att-xxxx.jpg
```

## RLS Policies

All buckets are public-read. Writes/deletes are scoped by the first folder matching `auth.uid()`.

These policies are included in `schema.sql` — no manual setup needed.

## File Size Recommendations

| Bucket | Recommended Max |
|---|---|
| `profile-media` | 10 MB |
| `circle-media` | 50 MB |

Images are compressed client-side (800 px max, 70 % JPEG quality) before upload.
