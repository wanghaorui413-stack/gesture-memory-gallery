import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MODES, sceneState } from '../config.js';

const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const FINGERS = [[8,6],[12,10],[16,14],[20,18]];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Normalize by palm width, so camera distance does not change thresholds.
export function classifyHand(points) {
  const width = Math.max(distance(points[5], points[17]), 0.001);
  const extended = FINGERS.filter(([tip, pip]) =>
    distance(points[tip], points[0]) > distance(points[pip], points[0]) * 1.12
  ).length;
  const indexReach = distance(points[8], points[0]) > distance(points[6], points[0]) * 1.07;
  return {
    x: points[9].x,
    pinchX: (points[4].x + points[8].x) / 2,
    pinchY: (points[4].y + points[8].y) / 2,
    extended,
    pinchRatio: distance(points[4], points[8]) / width,
    pinchEligible: indexReach && extended > 0 && extended < 4,
    pose: extended >= 3 ? MODES.SCATTER : extended <= 1 ? MODES.CAKE : null
  };
}

export class HandGestureController {
  constructor({ video, canvas, experience, onReady, onError, onStatus, onHover }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.experience = experience;
    this.onReady = onReady;
    this.onError = onError;
    this.onStatus = onStatus;
    this.onHover = onHover;
    this.handLandmarker = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.smoothedX = null;
    this.lastX = null;
    this.trackedX = null;
    this.candidatePose = null;
    this.candidateSince = 0;
    this.lastModeChange = 0;
    this.pinchFrames = 0;
    this.releaseFrames = 0;
    this.hoverCandidate = -1;
    this.hoverFrames = 0;
    this.hoverIndex = -1;
  }

  async init() {
    if (this.running) return;
    try {
      this.onStatus?.('正在准备手势识别…');
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
      const options = {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.65,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6
      };
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        options.baseOptions.delegate = 'CPU';
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, options);
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      this.video.srcObject = stream;
      await this.video.play();
      this.canvas.width = this.video.videoWidth || 640;
      this.canvas.height = this.video.videoHeight || 480;
      this.running = true;
      this.onReady?.();
      this.predictWebcam();
    } catch (error) {
      this.onError?.(error);
    }
  }

  predictWebcam() {
    if (!this.running) return;
    requestAnimationFrame(() => this.predictWebcam());
    if (this.video.readyState < 2 || this.lastVideoTime === this.video.currentTime) return;
    this.lastVideoTime = this.video.currentTime;
    try {
      const result = this.handLandmarker.detectForVideo(this.video, performance.now());
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      result.landmarks?.forEach(hand => this.drawSkeleton(hand));
      this.processGestures(result.landmarks || []);
    } catch (error) {
      this.running = false;
      this.resetGestureState();
      this.onError?.(error);
    }
  }

  drawSkeleton(points) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.strokeStyle = 'rgba(255, 214, 148, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.fillStyle = 'rgba(255, 139, 181, 0.95)';
    for (const [a, b] of CONNECTIONS) {
      this.ctx.beginPath();
      this.ctx.moveTo(points[a].x * w, points[a].y * h);
      this.ctx.lineTo(points[b].x * w, points[b].y * h);
      this.ctx.stroke();
    }
    for (const point of points) {
      this.ctx.beginPath();
      this.ctx.arc(point.x * w, point.y * h, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  processGestures(hands) {
    if (!hands.length) {
      this.resetGestureState();
      this.onStatus?.('把手放进画面，试试张开或握拳');
      return;
    }
    const choices = hands.map(classifyHand);
    const hand = this.trackedX === null ? choices[0] :
      choices.reduce((best, next) => Math.abs(next.x - this.trackedX) < Math.abs(best.x - this.trackedX) ? next : best);
    this.trackedX = hand.x;
    const now = performance.now();
    const pointerX = 1 - hand.pinchX;
    const pointerY = hand.pinchY;
    const hovered = this.experience.getPhotoNearScreenPoint(pointerX, pointerY);
    if (hovered === this.hoverCandidate) {
      this.hoverFrames += 1;
    } else {
      this.hoverCandidate = hovered;
      this.hoverFrames = 1;
    }
    if (this.hoverFrames >= 3) this.hoverIndex = hovered;
    sceneState.hoverTargetIndex = this.hoverIndex;
    this.onHover?.({ index: this.hoverIndex, x: pointerX, y: pointerY });

    if (!sceneState.isPinching) {
      this.pinchFrames = hand.pinchEligible && hand.pinchRatio < 0.38 ? this.pinchFrames + 1 : 0;
      if (this.pinchFrames >= 3) {
        if (this.hoverIndex === -1) {
          this.pinchFrames = 0;
          this.onStatus?.('把手移到想看的照片附近，再捏合');
          return;
        }
        sceneState.isPinching = true;
        this.releaseFrames = 0;
        sceneState.focusTargetIndex = this.hoverIndex;
        sceneState.mode = MODES.FOCUS;
        this.onStatus?.('捏住照片 · 松开返回');
      }
    } else {
      this.releaseFrames = hand.pinchRatio > 0.58 || !hand.pinchEligible ? this.releaseFrames + 1 : 0;
      if (this.releaseFrames >= 3) {
        sceneState.isPinching = false;
        sceneState.mode = sceneState.baseMode;
        this.pinchFrames = 0;
      }
    }
    if (sceneState.isPinching) {
      this.lastX = null;
      this.candidatePose = null;
      return;
    }

    if (hand.pose !== this.candidatePose) {
      this.candidatePose = hand.pose;
      this.candidateSince = now;
    } else if (hand.pose && hand.pose !== sceneState.baseMode && now - this.candidateSince > 260 && now - this.lastModeChange > 650) {
      sceneState.baseMode = hand.pose;
      sceneState.mode = hand.pose;
      this.lastModeChange = now;
      this.onStatus?.(hand.pose === MODES.CAKE ? '握拳 · 蛋糕回来啦' : '张开手 · 回忆散开啦');
    }

    // Smooth both swipe directions; ignore landmark jitter and tracking jumps.
    this.smoothedX = this.smoothedX === null ? hand.x : this.smoothedX * 0.65 + hand.x * 0.35;
    if (this.lastX !== null) {
      const delta = this.smoothedX - this.lastX;
      if (Math.abs(delta) > 0.0025 && Math.abs(delta) < 0.12) {
        sceneState.rotationVelocity = Math.max(-0.045, Math.min(0.045, sceneState.rotationVelocity - delta * 0.65));
      }
    }
    this.lastX = this.smoothedX;
  }

  resetGestureState() {
    this.trackedX = null;
    this.smoothedX = null;
    this.lastX = null;
    this.candidatePose = null;
    this.pinchFrames = 0;
    this.releaseFrames = 0;
    this.hoverCandidate = -1;
    this.hoverFrames = 0;
    this.hoverIndex = -1;
    sceneState.isPinching = false;
    sceneState.hoverTargetIndex = -1;
    this.onHover?.(null);
    if (sceneState.mode === MODES.FOCUS) sceneState.mode = sceneState.baseMode;
  }
}
