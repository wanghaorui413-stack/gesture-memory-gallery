export const MODES = {
  CAKE: 'CAKE',
  SCATTER: 'SCATTER',
  FOCUS: 'FOCUS'
};

export const sceneState = {
  mode: MODES.CAKE,
  baseMode: MODES.CAKE,
  focusTargetIndex: -1,
  hoverTargetIndex: -1,
  isPinching: false,
  rotationVelocity: 0
};
