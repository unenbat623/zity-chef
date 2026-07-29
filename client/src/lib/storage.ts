import { supabase } from './supabase';

// Public Storage bucket for user-uploaded images (avatars, community photos).
// Create it in Supabase → Storage → New bucket named "uploads" (public).
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
