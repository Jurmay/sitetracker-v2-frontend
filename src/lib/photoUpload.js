import { supabase } from './supabaseClient';

/**
 * Uploads a labourer's photo to the 'labourer-photos' bucket (migration 008)
 * and returns the storage path to save as labourers.photo_url.
 *
 * Path convention matches the RLS policies in migration 008:
 * '{project_id}/{random-id}.{ext}' - the policies extract project_id from
 * the first path segment via storage.foldername(name), so this prefix is
 * load-bearing, not just organizational.
 *
 * Does basic client-side compression by capping the image at a reasonable
 * max dimension before upload, consistent with the Document Management
 * module's design (auto-compress before hitting any configured size
 * limit) - this is a simpler version of that idea, not the full
 * project-configurable-limit system, since labourer photos are a fixed,
 * small use case (ID-style photo, not a high-res progress shot).
 */
async function compressImage(file, maxDimension = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed.'))),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not load the selected image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadLabourerPhoto(projectId, file) {
  const compressedBlob = await compressImage(file);
  const path = `${projectId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from('labourer-photos')
    .upload(path, compressedBlob, { contentType: 'image/jpeg' });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  // Stored as a private bucket (per migration 008) - photo_url holds the
  // storage PATH, not a public URL. Displaying it later requires a signed
  // URL (supabase.storage.from(...).createSignedUrl(path, ...)), fetched
  // at display time by whatever screen needs to show the photo - not
  // built yet, since no screen currently needs to display labourer
  // photos back, only register/submit them.
  return path;
}

/**
 * Resolves a stored labourer photo PATH (as saved in labourers.photo_url)
 * into a temporary signed URL the browser can actually load as an <img>.
 *
 * The bucket is private, so plain paths are not directly viewable - every
 * display needs its own signed URL, generated fresh, since these expire.
 * expiresInSeconds defaults to 1 hour, which comfortably covers a single
 * screen view; if a photo needs to stay visible longer (e.g. left open
 * in a background tab), the caller should re-fetch rather than cache
 * this indefinitely.
 *
 * Returns null (rather than throwing) if the path is empty or the signed
 * URL request fails, so a broken/missing photo degrades to "no photo
 * shown" instead of crashing the screen that requested it.
 */
export async function getLabourerPhotoUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from('labourer-photos')
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
