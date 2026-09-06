import { STORAGE_KEY } from '../config.js';

const MAX_IMAGE_SIZE = 512;
const JPEG_QUALITY = 0.72;

export async function compressImageToDataUrl(fileOrDataUrl) {
  const source = typeof fileOrDataUrl === 'string' ? fileOrDataUrl : await readFileAsDataUrl(fileOrDataUrl);
  const image = await loadImage(source);
  const scale = Math.min(MAX_IMAGE_SIZE / image.width, MAX_IMAGE_SIZE / image.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function loadSavedPhotos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function savePhoto(dataUrl) {
  const saved = loadSavedPhotos();
  saved.push(dataUrl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function clearSavedPhotos() {
  localStorage.removeItem(STORAGE_KEY);
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
