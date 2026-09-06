import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MODES, sceneState } from '../config.js';
import { Particle } from './Particle.js';

export class Experience {
  constructor(container = document.body) {
    this.container = container;
    this.particles = [];
    this.photos = [];
    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initLighting();
    this.initPostProcessing();
    this.initMaterials();
    this.generateContent();
    this.bindResize();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 2;
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 50);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);
  }

  initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const internalLight = new THREE.PointLight(0xffaa00, 1.5, 30);
    internalLight.position.set(0, 5, 0);
    this.mainGroup.add(internalLight);

    const spotGold = new THREE.SpotLight(0xffd700, 1000);
    spotGold.position.set(30, 40, 40);
    spotGold.angle = 0.5;
    spotGold.penumbra = 0.5;
    this.scene.add(spotGold);

    const spotRose = new THREE.SpotLight(0xff1493, 800);
    spotRose.position.set(-30, 20, -30);
    spotRose.angle = 0.6;
    spotRose.penumbra = 0.7;
    this.scene.add(spotRose);
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  initMaterials() {
    this.materials = {
      sponge: new THREE.MeshStandardMaterial({ color: 0xffeebb, roughness: 0.9, metalness: 0 }),
      spongeDark: new THREE.MeshStandardMaterial({ color: 0xffdca0, roughness: 0.9 }),
      icingRose: new THREE.MeshPhysicalMaterial({ color: 0xff69b4, metalness: 0.1, roughness: 0.2, clearcoat: 0.5 }),
      icingWhite: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.3 }),
      heartRed: new THREE.MeshPhysicalMaterial({ color: 0xff2048, metalness: 0.25, roughness: 0.12, clearcoat: 1, emissive: 0x330000 }),
      heartPink: new THREE.MeshPhysicalMaterial({ color: 0xff1493, metalness: 0.2, roughness: 0.1, clearcoat: 1 }),
      candle: new THREE.MeshStandardMaterial({ color: 0xf4f2e8, roughness: 0.4 }),
      flame: new THREE.MeshBasicMaterial({ color: 0xff6a00 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 })
    };
  }

  generateContent() {
    const boxGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
    const sphereGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const heartGeo = this.createHeartGeometry();
    const candleGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
    const flameGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const confettiGeo = new THREE.PlaneGeometry(0.2, 0.4);

    for (let i = 0; i < 2800; i += 1) {
      const rand = Math.random();
      let mesh;
      let type;
      if (rand < 0.45) {
        mesh = new THREE.Mesh(boxGeo, Math.random() > 0.5 ? this.materials.sponge : this.materials.spongeDark);
        type = 'SPONGE';
      } else if (rand < 0.78) {
        const material = Math.random() > 0.55 ? this.materials.icingRose : this.materials.icingWhite;
        mesh = new THREE.Mesh(sphereGeo, material);
        type = 'ICING';
      } else {
        mesh = new THREE.Mesh(heartGeo, Math.random() > 0.5 ? this.materials.heartRed : this.materials.heartPink);
        type = 'HEART';
      }
      this.mainGroup.add(mesh);
      this.particles.push(new Particle(mesh, type, i));
    }

    for (let i = 0; i < 24; i += 1) {
      const candle = new THREE.Mesh(candleGeo, this.materials.candle);
      const flame = new THREE.Mesh(flameGeo, this.materials.flame);
      this.mainGroup.add(candle, flame);
      this.particles.push(new Particle(candle, 'CANDLE', i));
      this.particles.push(new Particle(flame, 'FLAME', i));
    }

    const colors = [0xff2048, 0x25d0b0, 0x4c84ff, 0xffd700, 0xff69b4, 0xffffff];
    for (let i = 0; i < 2200; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(confettiGeo, material);
      this.mainGroup.add(mesh);
      this.particles.push(new Particle(mesh, 'CONFETTI', i));
    }
  }

  createHeartGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0.25, 0.25);
    shape.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
    shape.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
    shape.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
    shape.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
    shape.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
    shape.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 });
    geometry.center();
    geometry.scale(1.6, 1.6, 1.6);
    return geometry;
  }

  addPhotoTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.15), this.materials.frame);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture }));
    photo.position.z = 0.08;
    frame.add(photo);
    this.mainGroup.add(frame);

    const particle = new Particle(frame, 'PHOTO', this.photos.length, this.photos.length + 1);
    this.particles.push(particle);
    this.photos.push(particle);
    this.rebalancePhotoAngles();
  }

  addPhotoFromDataUrl(dataUrl) {
    new THREE.TextureLoader().load(dataUrl, texture => this.addPhotoTexture(texture));
  }

  createPlaceholderPhoto(label = 'MEMORY') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#ff69b4');
    gradient.addColorStop(0.55, '#101010');
    gradient.addColorStop(1, '#d4af37');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = '700 54px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 256);
    this.addPhotoTexture(new THREE.CanvasTexture(canvas));
  }

  rebalancePhotoAngles() {
    const total = this.photos.length;
    this.photos.forEach((photo, index) => {
      photo.index = index;
      photo.cakeParams.angle = (index / total) * Math.PI * 2;
    });
  }

  getClosestPhotoToCamera() {
    if (this.photos.length === 0) return -1;
    let minDistance = Infinity;
    let closestIndex = -1;
    const worldPos = new THREE.Vector3();

    this.photos.forEach((photo, index) => {
      photo.mesh.getWorldPosition(worldPos);
      const dx = worldPos.x;
      const dz = worldPos.z - this.camera.position.z;
      const distance = dx * dx + dz * dz;
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start() {
    this.clock.start();
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const time = this.clock.getElapsedTime();
    this.updateRotation();
    this.particles.forEach(particle => particle.update(sceneState.mode, time, this.mainGroup, this.camera));
    this.composer.render();
  }

  updateRotation() {
    if (sceneState.mode !== MODES.FOCUS) {
      this.mainGroup.rotation.y += 0.002 + sceneState.rotationVelocity;
      sceneState.rotationVelocity *= 0.94;
      if (Math.abs(sceneState.rotationVelocity) < 0.0001) sceneState.rotationVelocity = 0;
    }
  }
}
