import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MODES, sceneState } from '../config.js';

export class HandGestureController {
  constructor({ video, canvas, experience, onReady, onError }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.experience = experience;
    this.onReady = onReady;
    this.onError = onError;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.lastHandPos = { x: 0 };
    this.handPos = { x: 0 };
    this.isHandPresent = false;
    this.lastModeChange = 0;
  }

  async init() {
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.srcObject = stream;
      this.video.addEventListener('loadeddata', () => {
        this.resizeCanvas();
        this.predictWebcam();
        this.onReady?.();
      });
    } catch (error) {
      this.onError?.(error);
    }
  }

  resizeCanvas() {
    this.canvas.width = this.video.videoWidth || this.video.clientWidth;
    this.canvas.height = this.video.videoHeight || this.video.clientHeight;
  }

  predictWebcam() {
    if (this.lastVideoTime !== this.video.currentTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.handLandmarker.detectForVideo(this.video, Date.now());
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (result.landmarks?.length) {
        result.landmarks.forEach(landmarks => this.drawSkeleton(landmarks));
        this.processGestures(result);
      } else {
        this.resetGestureState();
      }
    }
    requestAnimationFrame(() => this.predictWebcam());
  }

  drawSkeleton(landmarks) {
    const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';

    connections.forEach(([a, b]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      this.ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      this.ctx.stroke();
    });

    landmarks.forEach(point => {
      this.ctx.beginPath();
      this.ctx.arc(point.x * w, point.y * h, 3, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  processGestures(result) {
    const now = Date.now();
    let detectedRight = false;

    result.landmarks.forEach(landmarks => {
      const palmX = landmarks[9].x;
      if (palmX > 0.55) {
        this.processLeftHandMode(landmarks, now);
      } else if (palmX < 0.45) {
        detectedRight = true;
        this.processRightHandInteraction(landmarks);
      }
    });

    if (!detectedRight) {
      this.resetGestureState();
    } else {
      this.isHandPresent = true;
    }

    if (sceneState.mode !== MODES.FOCUS) sceneState.mode = sceneState.baseMode;
  }

  processLeftHandMode(landmarks, now) {
    if (now - this.lastModeChange < 500) return;
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const wrist = landmarks[0];
    const avgTipToWrist = tips.reduce((sum, tip) => sum + Math.hypot(tip.x - wrist.x, tip.y - wrist.y), 0) / tips.length;

    if (avgTipToWrist < 0.22) {
      sceneState.baseMode = MODES.CAKE;
      this.lastModeChange = now;
    } else if (avgTipToWrist > 0.35) {
      sceneState.baseMode = MODES.SCATTER;
      this.lastModeChange = now;
    }
  }

  processRightHandInteraction(landmarks) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);

    if (!sceneState.isPinching && pinchDist < 0.05) {
      sceneState.isPinching = true;
      if (sceneState.mode !== MODES.FOCUS) {
        const closestIdx = this.experience.getClosestPhotoToCamera();
        if (closestIdx !== -1) {
          sceneState.focusTargetIndex = closestIdx;
          sceneState.mode = MODES.FOCUS;
        }
      }
    } else if (sceneState.isPinching && pinchDist > 0.08) {
      sceneState.isPinching = false;
      if (sceneState.mode === MODES.FOCUS) sceneState.mode = sceneState.baseMode;
    }

    if (!sceneState.isPinching) {
      this.handPos.x = this.handPos.x * 0.5 + landmarks[9].x * 0.5;
      if (this.isHandPresent) {
        const deltaX = this.handPos.x - this.lastHandPos.x;
        if (deltaX > 0.002) sceneState.rotationVelocity -= deltaX * 0.3;
      }
      this.lastHandPos.x = this.handPos.x;
    }
  }

  resetGestureState() {
    this.isHandPresent = false;
    sceneState.isPinching = false;
    if (sceneState.mode === MODES.FOCUS) sceneState.mode = sceneState.baseMode;
  }
}
