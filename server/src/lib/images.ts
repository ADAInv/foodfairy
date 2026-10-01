// Image uploads. Only JPEG / PNG / WebP are accepted (checked by magic
// bytes, not by the client's Content-Type). SVG is refused outright — it's
// a stored-XSS vector. Everything is re-encoded to WebP by sharp, which
// also drops EXIF metadata, including GPS coordinates that could reveal
// where a photo was taken (i.e. her kitchen).

import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { config } from '../config.js';
import { run, get } from '../db.js';
import { HttpError } from '../http.js';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const TARGET_WIDTHS = [480, 960, 1440];

function sniff(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function mediaPath(file: string): string {
  return join(config.dataDir, 'media', file);
}

export async function processUpload(buf: Buffer, alt: string): Promise<{ id: string; width: number; height: number; sizes: number[] }> {
  if (!sniff(buf)) throw new HttpError(415, 'Upload a JPEG, PNG or WebP photo.');
  const base = sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate();
  const meta = await base.metadata();
  const origW = meta.autoOrient?.width ?? meta.width ?? 0;
  const origH = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!origW || !origH) throw new HttpError(400, "Couldn't read that image.");

  const id = randomBytes(12).toString('hex');
  let sizes = TARGET_WIDTHS.filter((w) => w <= origW);
  if (sizes.length === 0) sizes = [origW];
  for (const w of sizes) {
    await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(mediaPath(`${id}-${w}.webp`));
  }
  // 1200x630 JPEG for link previews (Instagram / iMessage / WhatsApp).
  await sharp(buf, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(mediaPath(`${id}-og.jpg`));
  run('INSERT INTO images (id, width, height, sizes, alt) VALUES (?, ?, ?, ?, ?)', [id, origW, origH, JSON.stringify(sizes), alt]);
  return { id, width: origW, height: origH, sizes };
}

export async function deleteImage(id: string): Promise<void> {
  const row = get<{ sizes: string }>('SELECT sizes FROM images WHERE id = ?', [id]);
  if (!row) return;
  for (const w of JSON.parse(row.sizes) as number[]) await unlink(mediaPath(`${id}-${w}.webp`)).catch(() => {});
  await unlink(mediaPath(`${id}-og.jpg`)).catch(() => {});
  run('DELETE FROM images WHERE id = ?', [id]);
}

export interface PublicImage { id: string; width: number; height: number; sizes: number[]; alt: string }

export function imageInfo(id: string | null | undefined): PublicImage | null {
  if (!id) return null;
  const row = get<{ id: string; width: number; height: number; sizes: string; alt: string }>(
    'SELECT id, width, height, sizes, alt FROM images WHERE id = ?', [id]
  );
  return row ? { ...row, sizes: JSON.parse(row.sizes) } : null;
}
