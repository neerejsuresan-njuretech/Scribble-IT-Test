export interface ProcessedLogoResult {
  ok: true;
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
}

export interface ProcessedLogoError {
  ok: false;
  error: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB raw input
const MAX_DIMENSION_PX = 256;
const MAX_STORED_DATA_URL_CHARS = 180000; // ~135 KB binary, well within Firestore 1MB limit

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read uploaded image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read logo file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Uploaded file is not a valid image.'));
    img.src = src;
  });
}

/**
 * Resizes and optimizes uploaded company/portal logos into compact data URLs
 * suitable for multi-company Firestore documents and instant cross-device sync.
 */
export async function processLogoFile(
  file: File
): Promise<ProcessedLogoResult | ProcessedLogoError> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Please select a PNG, JPG, WebP, or SVG image file.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Logo file exceeds the 5 MB upload limit. Please choose a smaller image.' };
  }

  try {
    const rawDataUrl = await readFileAsDataUrl(file);

    // Compact sanitized SVG pass-through when already lightweight
    if (file.type === 'image/svg+xml' && rawDataUrl.length <= 80000) {
      const text = await file.text();
      const sanitizedSvg = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
      const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizedSvg)}`;
      if (encoded.length <= 100000) {
        return {
          ok: true,
          dataUrl: encoded,
          sizeKb: Math.max(1, Math.round(encoded.length / 1024)),
          width: MAX_DIMENSION_PX,
          height: MAX_DIMENSION_PX,
        };
      }
    }

    const img = await loadImage(rawDataUrl);
    const naturalW = img.naturalWidth || MAX_DIMENSION_PX;
    const naturalH = img.naturalHeight || MAX_DIMENSION_PX;
    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, error: 'Browser canvas context unavailable for logo optimization.' };
    }
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer transparent WebP if supported and compact, falling back to PNG / JPEG
    let outputUrl = canvas.toDataURL('image/webp', 0.88);
    if (!outputUrl.startsWith('data:image/webp') || outputUrl.length > MAX_STORED_DATA_URL_CHARS) {
      outputUrl = canvas.toDataURL('image/png');
    }
    if (outputUrl.length > MAX_STORED_DATA_URL_CHARS) {
      outputUrl = canvas.toDataURL('image/jpeg', 0.82);
    }
    if (outputUrl.length > MAX_STORED_DATA_URL_CHARS) {
      return {
        ok: false,
        error: 'Logo image is still too large after compression. Please use a simpler PNG or SVG icon.',
      };
    }

    return {
      ok: true,
      dataUrl: outputUrl,
      sizeKb: Math.max(1, Math.round(outputUrl.length / 1024)),
      width: targetW,
      height: targetH,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to process uploaded logo image.',
    };
  }
}
