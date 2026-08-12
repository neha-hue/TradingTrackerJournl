/**
 * Uploads one image to the local server's uploads folder and returns its URL.
 *
 * The stored name is randomised server-side rather than taken from the file, so that a
 * folder full of "Screenshot (132).png" style names cannot collide with an earlier upload.
 */
export async function uploadScreenshot(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/screenshots', {
    method: 'POST',
    credentials: 'include',
    body: form
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'Upload failed');
  return body.url;
}
