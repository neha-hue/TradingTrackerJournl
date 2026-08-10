import { supabase } from './supabase';

const BUCKET = 'screenshots';

/**
 * Uploads one image to Supabase Storage and returns its public URL.
 *
 * The stored name is randomised rather than taken from the file, so that a folder full of
 * "Screenshot (132).png" style names cannot collide with an earlier upload.
 */
export async function uploadScreenshot(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrl;
}
