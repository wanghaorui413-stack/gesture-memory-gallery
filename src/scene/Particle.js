import * as THREE from 'three';
import { MODES, sceneState } from '../config.js';

export class Particle {
  constructor(mesh, type, index, totalPhotos = 1) {
    this.mesh = mesh;
    this.type = type;
    this.index = index;
    this.currentPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08);
    this.cakeParams = {
      t: Math.random(),
      angle: type === 'PHOTO' ? (index / totalPhotos) * Math.PI * 2 : Math.random() * Math.PI * 2,
      flickerOffset: Math.random() * 100
    };

    this.scatterPos = new THREE.Vector3(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 44,
      (Math.random() - 0.5) * 50
    );
    this.scatterPos.normalize().multiplyScalar(8 + Math.random() * 20);
  }

  update(mode, time, mainGroup, camera) {
    if (mode === MODES.CAKE) {
      this.updateCakeTarget(time);
    } else if (mode === MODES.SCATTER) {
      this.targetPos.copy(this.scatterPos);
      this.mesh.rotation.x += this.velocity.x;
      this.mesh.rotation.y += this.velocity.y;
    } else if (mode === MODES.FOCUS) {
      this.updateFocusTarget(mainGroup, camera);
    }

    this.currentPos.lerp(this.targetPos, 0.08);
    this.mesh.position.copy(this.currentPos);
    this.mesh.scale.lerp(this.getTargetScale(mode, time), 0.1);
  }

  updateCakeTarget(time) {
    if (this.type === 'CONFETTI') {
      const t = (time * 0.05 + this.cakeParams.t) % 1;
      const y = t * 40 - 20;
      const radius = 16 + Math.sin(time + this.index) * 2;
      const angle = this.cakeParams.angle + time * 0.2;
      this.targetPos.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      this.mesh.rotation.x += 0.02;
      this.mesh.rotation.y += 0.02;
      return;
    }

    if (this.type === 'CANDLE' || this.type === 'FLAME') {
      const radius = 3.5 + Math.sin(this.index) * 0.5;
      const angle = this.cakeParams.angle;
      const y = this.type === 'FLAME' ? 9.2 + Math.sin(time * 15 + this.cakeParams.flickerOffset) * 0.1 : 8;
      this.targetPos.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      if (this.type === 'CANDLE') this.mesh.lookAt(this.targetPos.x, y + 10, this.targetPos.z);
      return;
    }

    const t = this.cakeParams.t;
    let y;
    let radius;
    if (t < 0.4) {
      y = -10 + (t / 0.4) * 8;
      radius = 10;
    } else if (t < 0.75) {
      y = -2 + ((t - 0.4) / 0.35) * 6;
      radius = 7;
    } else {
      y = 4 + ((t - 0.75) / 0.25) * 4;
      radius = 4;
    }

    if (this.type === 'PHOTO') {
      y = 2;
      radius = 8.5;
    } else {
      radius += (Math.random() - 0.5) * 1.5;
    }

    const angle = this.cakeParams.angle + (this.type !== 'PHOTO' ? t * 8 : 0);
    this.targetPos.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    this.mesh.lookAt(0, y, 0);
    this.mesh.rotation.y += Math.PI;
    if (this.type === 'HEART') this.mesh.rotation.z = Math.sin(time + this.index) * 0.2;
  }

  updateFocusTarget(mainGroup, camera) {
    if (this.type === 'PHOTO' && this.index === sceneState.focusTargetIndex) {
      const worldTarget = new THREE.Vector3(0, 5, 38);
      this.targetPos.copy(worldTarget).applyMatrix4(mainGroup.matrixWorld.clone().invert());
      this.mesh.quaternion.copy(camera.quaternion);
      return;
    }

    this.targetPos.copy(this.scatterPos);
    this.targetPos.z -= 10;
    this.targetPos.multiplyScalar(1.5);
  }

  getTargetScale(mode, time) {
    const scale = new THREE.Vector3(1, 1, 1);
    if (this.type === 'PHOTO') {
      if (mode === MODES.FOCUS && this.index === sceneState.focusTargetIndex) scale.set(5, 5, 5);
      else if (mode === MODES.CAKE) scale.set(0.6, 0.6, 0.6);
      else if (mode === MODES.SCATTER) scale.set(2, 2, 2);
      else scale.set(1.5, 1.5, 1.5);
      return scale;
    }

    let value = 1;
    if (this.type === 'CONFETTI') value = 0.3;
    if (this.type === 'FLAME') value = 0.5 + Math.sin(time * 20) * 0.1;
    if (this.type === 'HEART') value = 0.8;
    scale.set(value, value, value);
    return scale;
  }
}
