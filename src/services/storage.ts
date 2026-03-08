/**
 * storage.ts – Supabase Storage upload helpers.
 *
 * Buckets:
 *   profile-media  – profile photos, banners, timeline event media
 *   circle-media   – circle post attachments & circle banners
 *
 * Every function is resilient: catches errors and returns the original
 * URL on failure so the app never crashes.
 */

import { supabase } from '../lib/supabaseClient';

// ─── helpers ────────────────────────────────────────────────────────────────

/** True when the string is a data: URL (base64 inline). */
export function isDataUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

/** True when the URL is a placeholder SVG constant — never upload these. */
export function isPlaceholderSvg(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

/** Convert a base64 data-URL string into a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('pdf')) return 'pdf';
  return 'bin';
}

function extFromDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/data:(.*?);/)?.[1] ?? '';
  return extFromMime(mime);
}

// ─── core upload ────────────────────────────────────────────────────────────

async function uploadBlob(bucket: string, path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a File or base64 data-URL string to a bucket.
 * Returns the public URL, or the original value if upload is skipped/fails.
 */
async function uploadAsset(
  bucket: string,
  storagePath: string,
  input: File | string,
  fallbackName?: string
): Promise<string> {
  if (typeof input === 'string') {
    if (isPlaceholderSvg(input) || !isDataUrl(input)) return input; // already a URL or SVG
    const blob = dataUrlToBlob(input);
    const ext = extFromDataUrl(input);
    const name = fallbackName ?? `${uid()}.${ext}`;
    return uploadBlob(bucket, `${storagePath}/${name}`, blob);
  }
  // File object
  const name = fallbackName ?? input.name ?? `${uid()}`;
  return uploadBlob(bucket, `${storagePath}/${name}`, input);
}

// ─── public API ─────────────────────────────────────────────────────────────

/** Upload a profile photo / AI portrait. */
export async function uploadProfileImage(
  userId: string,
  profileId: string,
  input: File | string
): Promise<string> {
  try {
    return await uploadAsset('profile-media', `${userId}/${profileId}`, input, `avatar-${uid()}.jpg`);
  } catch (err) {
    console.error('uploadProfileImage failed:', err);
    return typeof input === 'string' ? input : '';
  }
}

/** Upload a profile cover banner. */
export async function uploadProfileBanner(
  userId: string,
  profileId: string,
  input: File | string
): Promise<string> {
  try {
    return await uploadAsset('profile-media', `${userId}/${profileId}/banner`, input, `banner-${uid()}.jpg`);
  } catch (err) {
    console.error('uploadProfileBanner failed:', err);
    return typeof input === 'string' ? input : '';
  }
}

/** Upload timeline event media (photo/video/audio attached to LifeEvent). */
export async function uploadEventMedia(
  userId: string,
  profileId: string,
  eventId: string,
  input: File | string,
  fileName?: string
): Promise<string> {
  try {
    return await uploadAsset(
      'profile-media',
      `${userId}/${profileId}/events/${eventId}`,
      input,
      fileName ?? `media-${uid()}`
    );
  } catch (err) {
    console.error('uploadEventMedia failed:', err);
    return typeof input === 'string' ? input : '';
  }
}

/** Upload a circle post attachment. */
export async function uploadCircleAttachment(
  userId: string,
  postId: string,
  input: File | string,
  fileName?: string
): Promise<string> {
  try {
    return await uploadAsset('circle-media', `${userId}/${postId}`, input, fileName);
  } catch (err) {
    console.error('uploadCircleAttachment failed:', err);
    return typeof input === 'string' ? input : '';
  }
}

/** Upload a circle cover banner. */
export async function uploadCircleBanner(
  userId: string,
  input: File | string
): Promise<string> {
  try {
    return await uploadAsset('circle-media', `${userId}/circle-banner`, input, `banner-${uid()}.jpg`);
  } catch (err) {
    console.error('uploadCircleBanner failed:', err);
    return typeof input === 'string' ? input : '';
  }
}
