'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface DentistWorld3DCanvasProps {
  className?: string;
}

type DentalIconId =
  | 'mirror'
  | 'probe'
  | 'molar'
  | 'shield'
  | 'scaler'
  | 'scan'
  | 'heartTooth'
  | 'toothbrush';

interface OrbitBadgeSpec {
  id: DentalIconId;
  accent: string;
  angle: number;
  ring: 'inner' | 'outer';
  yOffset: number;
}

const ORBIT_BADGES: readonly OrbitBadgeSpec[] = [
  { id: 'mirror', accent: '#0369A1', angle: 0.15, ring: 'outer', yOffset: 1.05 },
  { id: 'scan', accent: '#0E7490', angle: 0.95, ring: 'inner', yOffset: -0.95 },
  { id: 'molar', accent: '#0284C7', angle: 1.75, ring: 'outer', yOffset: 0.85 },
  { id: 'shield', accent: '#0F766E', angle: 2.55, ring: 'inner', yOffset: -0.8 },
  { id: 'probe', accent: '#075985', angle: 3.3, ring: 'outer', yOffset: 0.95 },
  { id: 'scaler', accent: '#0E7490', angle: 4.1, ring: 'inner', yOffset: -1.0 },
  { id: 'toothbrush', accent: '#0369A1', angle: 4.9, ring: 'outer', yOffset: 0.7 },
  { id: 'heartTooth', accent: '#0F766E', angle: 5.65, ring: 'inner', yOffset: -0.75 },
];

/**
 * Draws a crisp high-DPI clinical glass badge texture featuring vector dentistry iconography.
 */
function createDentalIconTexture(
  THREE: typeof import('three'),
  iconId: DentalIconId,
  accent: string,
): import('three').CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Rounded clinical glass card tile
  const r = 54;
  const pad = 16;
  const w = size - pad * 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, w, r);
  const grad = ctx.createLinearGradient(pad, pad, size - pad, size - pad);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  grad.addColorStop(1, 'rgba(221, 243, 245, 0.9)');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(11, 25, 44, 0.14)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.restore();

  // Crisp subtle clinical border
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, w, r);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
  ctx.stroke();

  // Inner subtle badge disc
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 72, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(240, 249, 255, 0.92)';
  ctx.fill();

  // Crisp vector dentistry icons
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (iconId === 'mirror') {
    // Dental mouth mirror
    ctx.beginPath();
    ctx.moveTo(-42, 46);
    ctx.lineTo(14, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(26, -24, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(221, 243, 245, 0.95)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, -32);
    ctx.lineTo(28, -20);
    ctx.lineWidth = 6;
    ctx.stroke();
  } else if (iconId === 'probe') {
    // Dental explorer / sickle probe
    ctx.beginPath();
    ctx.moveTo(-44, 46);
    ctx.lineTo(10, -8);
    ctx.quadraticCurveTo(38, -36, 46, -10);
    ctx.quadraticCurveTo(48, 8, 28, 12);
    ctx.stroke();
  } else if (iconId === 'molar') {
    // Minimal clean molar crown outline
    ctx.beginPath();
    ctx.moveTo(-36, -14);
    ctx.bezierCurveTo(-36, -44, -8, -46, 0, -30);
    ctx.bezierCurveTo(8, -46, 36, -44, 36, -14);
    ctx.bezierCurveTo(36, 12, 26, 46, 14, 46);
    ctx.bezierCurveTo(6, 46, 6, 18, 0, 18);
    ctx.bezierCurveTo(-6, 18, -6, 46, -14, 46);
    ctx.bezierCurveTo(-26, 46, -36, 12, -36, -14);
    ctx.closePath();
    ctx.stroke();
  } else if (iconId === 'shield') {
    // Fluoride protection shield + checkmark
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(40, -32);
    ctx.lineTo(40, 4);
    ctx.bezierCurveTo(40, 30, 18, 44, 0, 52);
    ctx.bezierCurveTo(-18, 44, -40, 30, -40, 4);
    ctx.lineTo(-40, -32);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-4, 16);
    ctx.lineTo(18, -10);
    ctx.stroke();
  } else if (iconId === 'scaler') {
    // Ultrasonic scaler handpiece + sonic wave arcs
    ctx.beginPath();
    ctx.moveTo(-40, 40);
    ctx.lineTo(4, -4);
    ctx.lineTo(26, -36);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(28, -36, 16, -0.4, 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(28, -36, 28, -0.3, 1.1);
    ctx.stroke();
  } else if (iconId === 'scan') {
    // Optical AI dental scan crosshair + beam
    const c = 42;
    const l = 18;
    ctx.beginPath();
    ctx.moveTo(-c, -c + l);
    ctx.lineTo(-c, -c);
    ctx.lineTo(-c + l, -c);
    ctx.moveTo(c - l, -c);
    ctx.lineTo(c, -c);
    ctx.lineTo(c, -c + l);
    ctx.moveTo(c, c - l);
    ctx.lineTo(c, c);
    ctx.lineTo(c - l, c);
    ctx.moveTo(-c + l, c);
    ctx.lineTo(-c, c);
    ctx.lineTo(-c, c - l);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(30, 0);
    ctx.strokeStyle = '#0284C7';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (iconId === 'toothbrush') {
    // Toothbrush + clean bristles
    ctx.beginPath();
    ctx.moveTo(-44, 38);
    ctx.lineTo(38, -22);
    ctx.stroke();
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i += 1) {
      const bx = 8 + i * 10;
      const by = 0 - i * 7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 12, by - 16);
      ctx.stroke();
    }
  } else {
    // Clinical preventive cross inside soft badge
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, 34);
    ctx.moveTo(-34, 0);
    ctx.lineTo(34, 0);
    ctx.lineWidth = 14;
    ctx.stroke();
  }

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Full-Hero Orbiting 3D Dental Icon Sphere/Rings Canvas:
 * - No central cartoon tooth — instead sleek 3D tilted orbital rings & floating clinical glass badges
 *   featuring dentistry & oral health icons revolving in 3D depth AROUND the centered Hero typography
 * - Fluid spring-damped cursor tracking, layered ring/badge/particle parallax, and inertial drag-to-spin
 * - Respects `prefers-reduced-motion`.
 */
export function DentistWorld3DCanvas({ className = '' }: DentistWorld3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    velYaw: number;
    velPitch: number;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0,
    pitch: 0,
    velYaw: 0,
    velPitch: 0,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container || typeof window === 'undefined') return undefined;

    let isDisposed = false;
    let animationFrameId = 0;
    let cleanupFn: (() => void) | null = null;

    void import('three')
      .then((THREE) => {
        if (isDisposed || !mountRef.current) return;

        let renderer: import('three').WebGLRenderer;
        try {
          renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          });
        } catch {
          return;
        }

        const width = container.clientWidth || window.innerWidth || 1200;
        const height = container.clientHeight || window.innerHeight || 680;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, width / Math.max(height, 1), 0.1, 100);
        camera.position.set(0, 0, 9.6);

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);

        // Sleek 3D orbital rings surrounding the centered hero copy
        const ringGroup = new THREE.Group();
        const primaryRing = new THREE.Mesh(
          new THREE.TorusGeometry(4.2, 0.022, 16, 160),
          new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.34,
          }),
        );
        primaryRing.rotation.x = Math.PI / 2.6;
        primaryRing.rotation.y = -0.22;
        ringGroup.add(primaryRing);

        const secondaryRing = new THREE.Mesh(
          new THREE.TorusGeometry(5.1, 0.015, 16, 160),
          new THREE.MeshBasicMaterial({
            color: 0x0e7490,
            transparent: true,
            opacity: 0.24,
          }),
        );
        secondaryRing.rotation.x = Math.PI / 2.2;
        secondaryRing.rotation.y = 0.28;
        ringGroup.add(secondaryRing);

        const tertiaryRing = new THREE.Mesh(
          new THREE.TorusGeometry(3.45, 0.012, 16, 128),
          new THREE.MeshBasicMaterial({
            color: 0x0f766e,
            transparent: true,
            opacity: 0.22,
          }),
        );
        tertiaryRing.rotation.x = Math.PI / 3.2;
        tertiaryRing.rotation.z = 0.35;
        ringGroup.add(tertiaryRing);
        worldGroup.add(ringGroup);

        // Floating 3D Dentistry & Oral Health Icon Badges
        const badgesGroup = new THREE.Group();
        const textures: import('three').CanvasTexture[] = [];
        const badgeSprites: Array<{
          sprite: import('three').Sprite;
          spec: OrbitBadgeSpec;
          baseScale: number;
        }> = [];

        for (const spec of ORBIT_BADGES) {
          const tex = createDentalIconTexture(THREE, spec.id, spec.accent);
          textures.push(tex);
          const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
          });
          const sprite = new THREE.Sprite(mat);
          const baseScale = spec.ring === 'outer' ? 1.18 : 0.98;
          sprite.scale.set(baseScale, baseScale, 1);
          badgesGroup.add(sprite);
          badgeSprites.push({ sprite, spec, baseScale });
        }
        worldGroup.add(badgesGroup);

        // Layered clinical particle field
        const particleCount = 90;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i += 1) {
          const radius = 3.2 + Math.random() * 3.4;
          const theta = Math.random() * Math.PI * 2;
          const ySpread = (Math.random() - 0.5) * 4.8;
          positions[i * 3] = Math.cos(theta) * radius;
          positions[i * 3 + 1] = ySpread;
          positions[i * 3 + 2] = Math.sin(theta) * radius * 0.7;
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(
          particleGeo,
          new THREE.PointsMaterial({
            color: 0x0284c7,
            size: 0.065,
            transparent: true,
            opacity: 0.45,
          }),
        );
        worldGroup.add(particles);

        const updateStageScale = (w: number, h: number) => {
          const aspect = w / Math.max(h, 1);
          const s = aspect < 0.9 ? 0.72 : aspect < 1.25 ? 0.88 : 1.04;
          worldGroup.scale.setScalar(s);
        };
        updateStageScale(width, height);

        const placeOrbitBadges = (t: number) => {
          for (const { sprite, spec, baseScale } of badgeSprites) {
            const speed = spec.ring === 'outer' ? 0.24 : -0.19;
            const theta = spec.angle + t * speed;
            const rx = spec.ring === 'outer' ? 4.65 : 3.55;
            const rz = spec.ring === 'outer' ? 2.85 : 2.3;
            const x = Math.cos(theta) * rx;
            const z = Math.sin(theta) * rz;
            const y = spec.yOffset + Math.sin(theta * 1.5 + t * 0.9) * 0.55;

            sprite.position.set(x, y, z);

            // Subtle depth scaling & fade when passing behind the centered hero copy
            const depthNorm = (z + 3.0) / 6.0; // [0..1]
            const nearCenterX = Math.abs(x) < 1.8 && Math.abs(y) < 1.1;
            const opacity = nearCenterX && z < 0.4 ? 0.22 : 0.48 + depthNorm * 0.52;
            sprite.material.opacity = Math.max(0.18, Math.min(1, opacity));
            const dynamicScale = baseScale * (0.78 + depthNorm * 0.34);
            sprite.scale.set(dynamicScale, dynamicScale, 1);
          }
        };

        let pointerNormX = 0;
        let pointerNormY = 0;
        let springX = 0;
        let springY = 0;
        let springVelX = 0;
        let springVelY = 0;

        const handleWindowPointerMove = (e: PointerEvent) => {
          pointerNormX = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
          pointerNormY = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
        };
        window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });

        const handleResize = () => {
          if (!mountRef.current) return;
          const nextW = mountRef.current.clientWidth || window.innerWidth || 1200;
          const nextH = mountRef.current.clientHeight || window.innerHeight || 680;
          camera.aspect = nextW / Math.max(nextH, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(nextW, nextH);
          updateStageScale(nextW, nextH);
        };
        window.addEventListener('resize', handleResize);

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let clock = 0;
        const animate = () => {
          if (isDisposed) return;

          const drag = dragStateRef.current;
          if (!prefersReducedMotion) {
            clock += 0.015;

            const stiffness = 0.065;
            const damping = 0.82;
            springVelX = (springVelX + (pointerNormX - springX) * stiffness) * damping;
            springVelY = (springVelY + (pointerNormY - springY) * stiffness) * damping;
            springX += springVelX;
            springY += springVelY;

            if (!drag.active) {
              drag.yaw += drag.velYaw;
              drag.pitch = Math.max(-0.55, Math.min(0.55, drag.pitch + drag.velPitch));
              drag.velYaw *= 0.94;
              drag.velPitch *= 0.92;
            }

            badgesGroup.rotation.y = drag.yaw + springX * 0.32;
            badgesGroup.rotation.x = drag.pitch + springY * 0.22;
            placeOrbitBadges(clock);

            ringGroup.rotation.y = drag.yaw * 0.7 + springX * 0.24;
            ringGroup.rotation.x = drag.pitch * 0.7 + springY * 0.18;
            primaryRing.rotation.z = clock * 0.28;
            secondaryRing.rotation.z = -clock * 0.22;
            tertiaryRing.rotation.z = clock * 0.18;

            particles.rotation.y = clock * 0.08 - springX * 0.22;
            particles.position.x = -springX * 0.35;
            particles.position.y = springY * 0.24;

            renderer.render(scene, camera);
            animationFrameId = window.requestAnimationFrame(animate);
          } else {
            placeOrbitBadges(0.4);
            renderer.render(scene, camera);
          }
        };
        animate();

        cleanupFn = () => {
          window.removeEventListener('pointermove', handleWindowPointerMove);
          window.removeEventListener('resize', handleResize);
          window.cancelAnimationFrame(animationFrameId);
          for (const t of textures) t.dispose();
          renderer.dispose();
        };
      })
      .catch(() => {});

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationFrameId);
      cleanupFn?.();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = true;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;
    dragStateRef.current.velYaw = 0;
    dragStateRef.current.velPitch = 0;
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const dYaw = dx * 0.01;
    const dPitch = dy * 0.008;
    drag.yaw += dYaw;
    drag.pitch = Math.max(-0.55, Math.min(0.55, drag.pitch + dPitch));
    drag.velYaw = dYaw;
    drag.velPitch = dPitch;
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
    setIsDragging(false);
  };

  return (
    <div
      data-testid="dentist-3d-canvas"
      role="img"
      aria-label="Orbit 3D Ikon Kesehatan Gigi DentHub yang merespons gerakan kursor"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={[
        'relative h-full w-full touch-none select-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div ref={mountRef} className="relative z-10 h-full w-full" />
    </div>
  );
}

export default DentistWorld3DCanvas;
