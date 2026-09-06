export const MODES = {
  CAKE: 'CAKE',
  SCATTER: 'SCATTER',
  FOCUS: 'FOCUS'
};

export const STORAGE_KEY = 'gesture_memory_gallery_photos_v1';

export const sceneState = {
  mode: MODES.CAKE,
  baseMode: MODES.CAKE,
  focusTargetIndex: -1,
  isPinching: false,
  rotationVelocity: 0
};
