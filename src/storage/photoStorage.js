const STORAGE_KEY = 'gesture_memory_gallery_photo_selection_v2';
const LEGACY_KEY = 'gesture_memory_gallery_photos_v1';
const MAX_IMAGE_SIZE = 720;
const JPEG_QUALITY = 0.78;

export async function compressImageToDataUrl(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(MAX_IMAGE_SIZE / image.width, MAX_IMAGE_SIZE / image.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function loadPhotoSelection(scope) {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}:${scope}`);
    if (stored) {
      const state = JSON.parse(stored);
      return {
        hidePresets: state.hidePresets === true,
        added: Array.isArray(state.added) ? state.added.filter(isImageDataUrl) : []
      };
    }
    const legacy = scope.endsWith('/Cake.html')
      ? JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]')
      : [];
    return { hidePresets: false, added: Array.isArray(legacy) ? legacy.filter(isImageDataUrl) : [] };
  } catch {
    return { hidePresets: false, added: [] };
  }
}

export function savePhotoSelection(selection, scope) {
  localStorage.setItem(`${STORAGE_KEY}:${scope}`, JSON.stringify(selection));
  localStorage.removeItem(LEGACY_KEY);
}

export function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(value);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}
