import { supabase } from './supabaseClient';

const BUCKET = 'settlement-receipts';

/**
 * Settlement receipts live in a private bucket, so a stored receipt_url
 * can't be linked to directly - each view needs a short-lived signed URL.
 *
 * receipt_url holds the storage path ("<project_id>/<uuid>.jpg"). Rows
 * saved before the bucket went private hold the full public URL instead;
 * the path is the part after "/settlement-receipts/".
 */
function receiptPath(receiptUrl) {
  const marker = `/${BUCKET}/`;
  const i = receiptUrl.indexOf(marker);
  return i === -1 ? receiptUrl : decodeURIComponent(receiptUrl.slice(i + marker.length));
}

/**
 * Opens a receipt in a new tab. The tab is opened before the signed URL
 * is fetched so phone browsers don't treat it as a blocked popup.
 */
export async function openReceipt(receiptUrl) {
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(receiptPath(receiptUrl), 300);
  if (error || !data) {
    tab?.close();
    alert('Could not open receipt. You may not have access to it.');
    return;
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
