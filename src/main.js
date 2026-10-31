import './styles.css';
import { Experience } from './scene/Experience.js';
import { HandGestureController } from './vision/HandGestureController.js';
import { MODES, sceneState } from './config.js';
import { compressImageToDataUrl, isImageDataUrl, loadPhotoSelection, savePhotoSelection } from './storage/photoStorage.js';

const $ = selector => document.querySelector(selector);
const status = message => { $('#status').textContent = message; };
const storageScope = window.location.pathname;
if (new URLSearchParams(window.location.search).has('make')) {
  document.body.classList.add('maker-mode');
}

const presetPhotos = readPresetPhotos();
let photoSelection = loadPhotoSelection(storageScope);
let selectedPhotos = getSelectedPhotos();
let selectedAudio = readPresetAudio();
const audio = $('#bgm');
if (selectedAudio.dataUrl) audio.src = selectedAudio.dataUrl;
updateMusicButton();

const experience = new Experience(document.body);
window.experience = experience;
resetScenePhotos();
experience.start();
window.setTimeout(() => $('#loader').classList.add('hidden'), 900);

const handController = new HandGestureController({
  video: $('#webcam'),
  canvas: $('#output-canvas'),
  experience,
  onReady: () => {
    $('#camera-card').classList.add('camera-card--active');
    $('#camera-button').textContent = '手势已开启';
    $('#camera-button').disabled = true;
    status('移动手掌挑选照片，捏合放大；张开或握拳切换场景');
  },
  onError: error => {
    console.warn('Hand tracking unavailable:', error);
    $('#camera-button').disabled = false;
    $('#camera-button').textContent = '重试手势';
    $('#gesture-cursor').hidden = true;
    status('手势暂不可用，仍可用下方按钮和拖动操作');
  },
  onStatus: status,
  onHover: pointer => {
    const cursor = $('#gesture-cursor');
    cursor.hidden = !pointer;
    if (!pointer) return;
    cursor.style.left = `${pointer.x * 100}%`;
    cursor.style.top = `${pointer.y * 100}%`;
    cursor.querySelector('span').textContent = pointer.index >= 0 ? `第 ${pointer.index + 1} 张照片` : '移动到照片上';
    cursor.classList.toggle('gesture-cursor--ready', pointer.index >= 0);
  }
});

$('#start-button').addEventListener('click', () => {
  startCountdown();
  if (selectedAudio.dataUrl) playMusic();
});
$('#camera-button').addEventListener('click', () => {
  $('#camera-button').disabled = true;
  handController.init();
});
$('#music-button').addEventListener('click', () => {
  if (!selectedAudio.dataUrl) {
    $('#audio-file-input').click();
  } else if (audio.paused) {
    playMusic();
  } else {
    audio.pause();
    updateMusicButton();
  }
});
$('#audio-upload-button').addEventListener('click', () => $('#audio-file-input').click());
$('#audio-file-input').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mime = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' }[extension];
    if (!mime) throw new Error('Unsupported audio file');
    const dataUrl = (await readFileAsDataUrl(file)).replace(/^data:[^;]*;/, `data:${mime};`);
    selectedAudio = { name: file.name, dataUrl };
    audio.src = dataUrl;
    updateMusicButton();
    playMusic();
    status('音乐已加入。保存礼物文件后，音乐会跟着文件一起发出。');
  } catch (error) {
    console.warn('Failed to load music:', error);
    status('音乐文件无法读取，请选 MP3、M4A 或 WAV');
  }
  event.target.value = '';
});
audio.addEventListener('play', updateMusicButton);
audio.addEventListener('pause', updateMusicButton);

$('#toggle-help').addEventListener('click', () => $('#tips-panel').classList.toggle('tips-panel--hidden'));
$('#cake-button').addEventListener('click', () => setMode(MODES.CAKE));
$('#scatter-button').addEventListener('click', () => setMode(MODES.SCATTER));
$('#focus-button').addEventListener('click', toggleFocus);
$('#prev-button').addEventListener('click', () => stepPhoto(-1));
$('#next-button').addEventListener('click', () => stepPhoto(1));
$('#overview-button').addEventListener('click', openOverview);
$('#close-overview').addEventListener('click', closeOverview);
$('#gallery-overlay').addEventListener('click', event => {
  if (event.target === $('#gallery-overlay')) closeOverview();
});
$('#photo-tools-button').addEventListener('click', () => {
  const isOpen = $('#gift-controls').classList.toggle('gift-controls--open');
  $('#photo-tools-button').setAttribute('aria-expanded', String(isOpen));
});
$('#upload-button').addEventListener('click', () => $('#file-input').click());
$('#download-button').addEventListener('click', downloadGift);
$('#clear-button').addEventListener('click', () => {
  photoSelection = { hidePresets: true, added: [] };
  persistSelection();
  selectedPhotos = [];
  resetScenePhotos();
  status('当前照片已清空，可以重新上传；桌面“相册”里的原图没有删除');
});
$('#restore-button').addEventListener('click', () => {
  photoSelection = { hidePresets: false, added: [] };
  persistSelection();
  selectedPhotos = getSelectedPhotos();
  resetScenePhotos();
  status('已恢复内置的相册照片');
});

$('#file-input').addEventListener('change', async event => {
  const files = [...(event.target.files || [])];
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (selectedPhotos.includes(dataUrl)) continue;
      photoSelection.added.push(dataUrl);
      selectedPhotos.push(dataUrl);
      experience.addPhotoFromDataUrl(dataUrl);
      added += 1;
    } catch (error) {
      console.warn('Failed to add photo:', error);
    }
  }
  if (added) persistSelection();
  updatePhotoCount();
  updateRestoreButton();
  renderOverview();
  status(added ? `已加入 ${added} 张照片。制作模式中可以保存为新的礼物文件。` : '没有加入新照片，请选择 JPG、PNG 或 WebP 图片');
  event.target.value = '';
});

let dragX = null;
experience.renderer.domElement.addEventListener('pointerdown', event => {
  dragX = event.clientX;
  experience.renderer.domElement.setPointerCapture(event.pointerId);
});
experience.renderer.domElement.addEventListener('pointermove', event => {
  if (dragX === null) return;
  const delta = event.clientX - dragX;
  dragX = event.clientX;
  sceneState.rotationVelocity = Math.max(-0.045, Math.min(0.045, sceneState.rotationVelocity + delta * 0.0007));
});
experience.renderer.domElement.addEventListener('pointerup', () => { dragX = null; });
experience.renderer.domElement.addEventListener('pointercancel', () => { dragX = null; });

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('#gallery-overlay').hidden) closeOverview();
    else if (sceneState.mode === MODES.FOCUS) setMode(sceneState.baseMode);
  }
  if (event.key === 'ArrowLeft') stepPhoto(-1);
  if (event.key === 'ArrowRight') stepPhoto(1);
  if (event.key.toLowerCase() === 'h') $('#tips-panel').classList.toggle('tips-panel--hidden');
});

function readPresetPhotos() {
  try {
    const list = JSON.parse($('#gift-data').textContent);
    return Array.isArray(list) ? list.filter(isImageDataUrl) : [];
  } catch {
    return [];
  }
}

function readPresetAudio() {
  try {
    const value = JSON.parse($('#gift-audio').textContent);
    return {
      name: typeof value.name === 'string' ? value.name : '周童《淡想》',
      dataUrl: typeof value.dataUrl === 'string' && /^data:audio\//.test(value.dataUrl) ? value.dataUrl : ''
    };
  } catch {
    return { name: '周童《淡想》', dataUrl: '' };
  }
}

function getSelectedPhotos() {
  return [...new Set([...(photoSelection.hidePresets ? [] : presetPhotos), ...photoSelection.added])];
}

function persistSelection() {
  try {
    savePhotoSelection(photoSelection, storageScope);
  } catch (error) {
    console.warn('Browser storage is full or unavailable:', error);
    status('当前修改仍可导出；浏览器空间不足，刷新后可能无法保留');
  }
}

function resetScenePhotos() {
  experience.clearPhotos();
  if (selectedPhotos.length) selectedPhotos.forEach(photo => experience.addPhotoFromDataUrl(photo));
  else ['许一个愿', '生日快乐', '永远闪闪发光'].forEach(label => experience.createPlaceholderPhoto(label));
  updatePhotoCount();
  updateRestoreButton();
  renderOverview();
}

function updatePhotoCount() {
  $('#photo-count').textContent = selectedPhotos.length
    ? `这份礼物里有 ${selectedPhotos.length} 张照片`
    : '还没有放入你的照片，可以先体验蛋糕';
}

function updateRestoreButton() {
  $('#restore-button').hidden = !photoSelection.hidePresets || !presetPhotos.length;
}

function renderOverview() {
  const grid = $('#gallery-grid');
  grid.replaceChildren();
  if (!selectedPhotos.length) {
    const empty = document.createElement('p');
    empty.className = 'gallery-empty';
    empty.textContent = '这里还没有照片，点“管理照片”可以加入。';
    grid.appendChild(empty);
    return;
  }
  selectedPhotos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = 'gallery-tile';
    button.type = 'button';
    button.setAttribute('aria-label', `查看第 ${index + 1} 张照片`);
    const image = document.createElement('img');
    image.src = photo;
    image.alt = `第 ${index + 1} 张回忆`;
    image.loading = 'lazy';
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    button.append(image, number);
    button.addEventListener('click', () => {
      closeOverview();
      focusPhoto(index);
    });
    grid.appendChild(button);
  });
}

function openOverview() {
  renderOverview();
  $('#gallery-overlay').hidden = false;
}

function closeOverview() {
  $('#gallery-overlay').hidden = true;
}

function setMode(mode) {
  sceneState.isPinching = false;
  sceneState.baseMode = mode;
  sceneState.mode = mode;
  status(mode === MODES.CAKE ? '生日蛋糕为你点亮 ✨' : '回忆在星光里展开 ✨');
}

function focusPhoto(index) {
  if (index < 0 || index >= selectedPhotos.length) return;
  sceneState.focusTargetIndex = index;
  sceneState.mode = MODES.FOCUS;
  status(`第 ${index + 1} / ${selectedPhotos.length} 张回忆`);
}

function toggleFocus() {
  if (sceneState.mode === MODES.FOCUS) {
    sceneState.mode = sceneState.baseMode;
    status('回到蛋糕');
    return;
  }
  focusPhoto(experience.getClosestPhotoToCamera());
}

function stepPhoto(direction) {
  if (!selectedPhotos.length) return;
  const nearest = experience.getClosestPhotoToCamera();
  const current = sceneState.mode === MODES.FOCUS ? sceneState.focusTargetIndex : Math.max(0, nearest);
  focusPhoto((current + direction + selectedPhotos.length) % selectedPhotos.length);
}

function updateMusicButton() {
  $('#music-button').textContent = !selectedAudio.dataUrl
    ? '♫ 选择《淡想》'
    : audio.paused ? '♫ 播放音乐' : '♫ 暂停音乐';
}

function playMusic() {
  audio.play().then(updateMusicButton).catch(() => {
    status('点“播放音乐”即可开启背景音乐');
    updateMusicButton();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function startCountdown() {
  $('#start-button').style.display = 'none';
  const display = $('#countdown-display');
  display.style.display = 'block';
  let count = 3;
  display.textContent = count;
  const timer = window.setInterval(() => {
    count -= 1;
    if (count > 0) display.textContent = count;
    else {
      window.clearInterval(timer);
      display.textContent = '✨';
      window.setTimeout(() => $('#start-screen').classList.add('hidden'), 500);
    }
  }, 650);
}

function downloadGift() {
  if (import.meta.env.DEV) {
    status('请直接打开项目里的 Cake.html，修改照片后再保存礼物文件');
    return;
  }
  const copy = document.documentElement.cloneNode(true);
  copy.querySelector('body').classList.remove('maker-mode');
  copy.querySelectorAll('body > canvas').forEach(canvas => canvas.remove());
  copy.querySelector('#loader').classList.remove('hidden');
  copy.querySelector('#start-screen').classList.remove('hidden');
  copy.querySelector('#start-button').style.display = '';
  copy.querySelector('#countdown-display').style.display = '';
  copy.querySelector('#camera-card').classList.remove('camera-card--active');
  copy.querySelector('#camera-button').disabled = false;
  copy.querySelector('#camera-button').textContent = '开启手势';
  copy.querySelector('#tips-panel').classList.add('tips-panel--hidden');
  copy.querySelector('#gallery-overlay').hidden = true;
  copy.querySelector('#gallery-grid').replaceChildren();
  copy.querySelector('#gesture-cursor').hidden = true;
  copy.querySelector('#gift-controls').classList.remove('gift-controls--open');
  copy.querySelector('#photo-tools-button').setAttribute('aria-expanded', 'false');
  copy.querySelector('#status').textContent = '拖动画面看看，也可以开启手势互动';
  copy.querySelector('#gift-data').textContent = JSON.stringify(selectedPhotos).replace(/</g, '\\u003c');
  copy.querySelector('#gift-audio').textContent = JSON.stringify(selectedAudio).replace(/</g, '\\u003c');
  copy.querySelector('#bgm').removeAttribute('src');
  const html = '<!doctype html>\n' + copy.outerHTML;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '送给妹妹-生日蛋糕.html';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  status(`礼物文件已保存，内含 ${selectedPhotos.length} 张照片${selectedAudio.dataUrl ? '和背景音乐' : ''}。`);
}
