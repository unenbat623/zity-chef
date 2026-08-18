import { supabase } from './supabase';

// Public Storage bucket for user-uploaded images (avatars, ingredient photos,
// community posts). Created by migration 20260814140000_uploads_bucket.sql —
// no manual dashboard step is needed.
const BUCKET = 'uploads';

/**
 * Uploads an image to Supabase Storage and returns its public URL.
 * Returns null when Storage isn't configured or the upload fails — callers
 * should fall back to an inline base64 data URL in that case.
 */
export async function uploadImage(file: File, folder = 'avatars'): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id || 'anon';
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${folder}/${uid}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[Zity Chef] Storage upload failed, falling back to base64:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Zity Chef] Storage upload error:', err);
    return null;
  }
}

/**
 * Uploads a base64 data-URL (e.g. from a FileReader preview) to Storage and
 * returns its public URL, or null if Storage isn't available / upload fails.
 */
export async function uploadDataUrl(dataUrl: string, folder = 'community'): Promise<string | null> {
  if (!supabase || !dataUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
    const file = new File([blob], `upload.${ext}`, { type: blob.type });
    return await uploadImage(file, folder);
  } catch {
    return null;
  }
}
