import './styles.css';
import { Experience } from './scene/Experience.js';
import { HandGestureController } from './vision/HandGestureController.js';
import { clearSavedPhotos, compressImageToDataUrl, loadSavedPhotos, savePhoto } from './storage/photoStorage.js';

const experience = new Experience(document.body);
window.experience = experience;

loadSavedPhotos().forEach(dataUrl => experience.addPhotoFromDataUrl(dataUrl));
if (experience.photos.length === 0) {
  experience.createPlaceholderPhoto('MEMORY');
  experience.createPlaceholderPhoto('GALLERY');
  experience.createPlaceholderPhoto('MOMENTS');
}

const loader = document.querySelector('#loader');
const startScreen = document.querySelector('#start-screen');
const startButton = document.querySelector('#start-button');
const countdownDisplay = document.querySelector('#countdown-display');
const uploadButton = document.querySelector('#upload-button');
const clearButton = document.querySelector('#clear-button');
const fileInput = document.querySelector('#file-input');
const tipsPanel = document.querySelector('#tips-panel');
const toggleHelp = document.querySelector('#toggle-help');

const handController = new HandGestureController({
  video: document.querySelector('#webcam'),
  canvas: document.querySelector('#output-canvas'),
  experience,
  onReady: () => loader.classList.add('hidden'),
  onError: error => {
    console.warn('Camera or hand tracking unavailable:', error);
    loader.classList.add('hidden');
    document.querySelector('#camera-card').classList.add('camera-card--disabled');
  }
});

handController.init();
window.setTimeout(() => loader.classList.add('hidden'), 3500);
experience.start();

startButton.addEventListener('click', () => startCountdown());
uploadButton.addEventListener('click', () => fileInput.click());
toggleHelp.addEventListener('click', () => tipsPanel.classList.toggle('tips-panel--hidden'));

clearButton.addEventListener('click', () => {
  clearSavedPhotos();
  window.location.reload();
});

fileInput.addEventListener('change', async event => {
  const files = [...(event.target.files || [])];
  for (const file of files) {
    try {
      const dataUrl = await compressImageToDataUrl(file);
      savePhoto(dataUrl);
      experience.addPhotoFromDataUrl(dataUrl);
    } catch (error) {
      console.warn('Failed to add photo:', error);
    }
  }
  fileInput.value = '';
});

window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'h') tipsPanel.classList.toggle('tips-panel--hidden');
});

function startCountdown() {
  startButton.style.display = 'none';
  countdownDisplay.style.display = 'block';
  let count = 3;
  countdownDisplay.textContent = count;

  const timer = window.setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownDisplay.textContent = count;
      return;
    }

    window.clearInterval(timer);
    countdownDisplay.textContent = 'Go';
    window.setTimeout(() => startScreen.classList.add('hidden'), 500);
  }, 850);
}
