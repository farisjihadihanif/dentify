'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface DentistWorld3DCanvasProps {
  className?: string;
}

/**
 * Unified Full-Hero Interactive 3D Dental Examination Canvas (`DentistWorld3DCanvas.tsx`, docs/DESIGN.md §3.1):
 * - Renders edge-to-edge (`absolute inset-0 w-full h-full`) with zero overlay widget chrome
 * - Central sculpted porcelain molar undergoing examination surrounded by 4 orbiting 3D dental instruments:
 *   1. Dental Mouth Mirror (stainless handle, angled stem, reflective mirror glass)
 *   2. Dental Explorer / Probe (knurled handle + curved sickle explorer tip)
 *   3. Ultrasonic Scaler Handpiece (clinical teal band + curved ultrasonic tip + mist ring)
 *   4. Optical Curing / Scanner Wand + translucent scanning light cone & vertical sweep ring
 * - Spring-damped mouse-tracking tilt, layered instrument/particle parallax, and inertial drag-to-spin
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
      .then(async (THREE) => {
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
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.16;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        let pmremGenerator: import('three').PMREMGenerator | null = null;
        try {
          const { RoomEnvironment } = await import(
            'three/examples/jsm/environments/RoomEnvironment.js'
          );
          if (isDisposed) {
            renderer.dispose();
            return;
          }
          pmremGenerator = new THREE.PMREMGenerator(renderer);
          scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        } catch {
          // Proceed cleanly without PMREM environment map
        }

        const camera = new THREE.PerspectiveCamera(38, width / Math.max(height, 1), 0.1, 100);
        camera.position.set(0, 0.2, 7.6);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0f2fe, 2.25);
        scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
        keyLight.position.set(5.0, 6.5, 6.5);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xbae6fd, 1.5);
        fillLight.position.set(-5.5, 2.2, 4.2);
        scene.add(fillLight);

        const rimLight = new THREE.PointLight(0x0284c7, 2.6, 20);
        rimLight.position.set(0, -3.5, 3.2);
        scene.add(rimLight);

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);

        const positionStageForAspect = (w: number, h: number) => {
          const aspect = w / Math.max(h, 1);
          if (aspect >= 1.25) {
            worldGroup.position.set(1.65, -0.05, 0);
            worldGroup.scale.setScalar(1.0);
          } else {
            worldGroup.position.set(0, -0.65, -0.6);
            worldGroup.scale.setScalar(0.84);
          }
        };
        positionStageForAspect(width, height);

        const porcelainMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: 0xf0f9ff,
          emissiveIntensity: 0.18,
          roughness: 0.12,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.07,
          reflectivity: 0.95,
        });

        const steelMaterial = new THREE.MeshStandardMaterial({
          color: 0xdbeafe,
          metalness: 0.88,
          roughness: 0.18,
        });

        const chromeMirrorMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xf8fafc,
          metalness: 0.96,
          roughness: 0.04,
          clearcoat: 1.0,
          reflectivity: 1.0,
        });

        const brandMetalMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x0369a1,
          emissive: 0x0284c7,
          emissiveIntensity: 0.28,
          metalness: 0.42,
          roughness: 0.22,
          clearcoat: 0.8,
        });

        const tealGripMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x0f766e,
          emissive: 0x0f766e,
          emissiveIntensity: 0.2,
          metalness: 0.25,
          roughness: 0.3,
        });

        // 1. Central Sculpted Porcelain Molar
        const toothGroup = new THREE.Group();
        const crownProfile = [
          new THREE.Vector2(0.0, -0.35),
          new THREE.Vector2(0.58, -0.32),
          new THREE.Vector2(0.86, -0.05),
          new THREE.Vector2(0.98, 0.38),
          new THREE.Vector2(0.92, 0.78),
          new THREE.Vector2(0.65, 1.02),
          new THREE.Vector2(0.0, 0.88),
        ];
        const crownBody = new THREE.Mesh(
          new THREE.LatheGeometry(crownProfile, 52),
          porcelainMaterial,
        );
        crownBody.scale.set(1.05, 1.0, 0.92);
        toothGroup.add(crownBody);

        const cuspCoords: Array<[number, number, number]> = [
          [-0.38, 0.86, -0.32],
          [0.38, 0.86, -0.32],
          [-0.38, 0.86, 0.32],
          [0.38, 0.86, 0.32],
        ];
        for (const [cx, cy, cz] of cuspCoords) {
          const cuspMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.48, 32, 32),
            porcelainMaterial,
          );
          cuspMesh.position.set(cx, cy, cz);
          cuspMesh.scale.set(1.0, 0.82, 1.0);
          toothGroup.add(cuspMesh);
        }

        const rootCurveLeft = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.36, -0.22, 0),
          new THREE.Vector3(-0.46, -0.82, 0.04),
          new THREE.Vector3(-0.34, -1.42, 0.08),
        ]);
        toothGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(rootCurveLeft, 24, 0.26, 20, false),
            porcelainMaterial,
          ),
        );
        const leftTip = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 20), porcelainMaterial);
        leftTip.position.set(-0.34, -1.42, 0.08);
        toothGroup.add(leftTip);

        const rootCurveRight = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.36, -0.22, 0),
          new THREE.Vector3(0.46, -0.82, -0.04),
          new THREE.Vector3(0.34, -1.42, -0.08),
        ]);
        toothGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(rootCurveRight, 24, 0.26, 20, false),
            porcelainMaterial,
          ),
        );
        const rightTip = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 20), porcelainMaterial);
        rightTip.position.set(0.34, -1.42, -0.08);
        toothGroup.add(rightTip);

        toothGroup.position.y = 0.14;
        worldGroup.add(toothGroup);

        // 2. Optical Scanning Beam Ring sweeping vertically across the tooth
        const beamGroup = new THREE.Group();
        const beamRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.34, 0.024, 16, 96),
          new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.78,
          }),
        );
        beamRing.rotation.x = Math.PI / 2;
        beamGroup.add(beamRing);

        const beamDisc = new THREE.Mesh(
          new THREE.CircleGeometry(1.32, 64),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        beamDisc.rotation.x = Math.PI / 2;
        beamGroup.add(beamDisc);
        worldGroup.add(beamGroup);

        // 3. Orbiting 3D Dental Instruments (Mirror, Probe, Ultrasonic Scaler, Optical Scanner Wand)
        const instrumentsOrbitGroup = new THREE.Group();
        worldGroup.add(instrumentsOrbitGroup);

        // Instrument A: Dental Mouth Mirror
        const mirrorGroup = new THREE.Group();
        mirrorGroup.add(
          new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 1.35, 16), steelMaterial),
        );
        const mirrorGripBand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.068, 0.22, 16),
          brandMetalMaterial,
        );
        mirrorGripBand.position.y = -0.18;
        mirrorGroup.add(mirrorGripBand);
        const mirrorStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.04, 0.48, 12),
          steelMaterial,
        );
        mirrorStem.position.set(0.06, 0.86, 0);
        mirrorStem.rotation.z = -0.24;
        mirrorGroup.add(mirrorStem);
        const mirrorHeadGroup = new THREE.Group();
        mirrorHeadGroup.position.set(0.14, 1.15, 0.05);
        mirrorHeadGroup.rotation.x = 0.52;
        mirrorHeadGroup.rotation.z = -0.35;
        const mirrorBezel = new THREE.Mesh(
          new THREE.TorusGeometry(0.27, 0.036, 16, 40),
          steelMaterial,
        );
        const mirrorBack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.27, 0.27, 0.04, 32),
          steelMaterial,
        );
        mirrorBack.rotation.x = Math.PI / 2;
        mirrorBack.position.z = -0.02;
        const mirrorGlass = new THREE.Mesh(
          new THREE.CircleGeometry(0.25, 32),
          chromeMirrorMaterial,
        );
        mirrorGlass.position.z = 0.01;
        mirrorHeadGroup.add(mirrorBezel, mirrorBack, mirrorGlass);
        mirrorGroup.add(mirrorHeadGroup);
        instrumentsOrbitGroup.add(mirrorGroup);

        // Instrument B: Dental Explorer / Sickle Probe
        const probeGroup = new THREE.Group();
        probeGroup.add(
          new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 1.25, 16), steelMaterial),
        );
        const probeCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062, 0.062, 0.16, 16),
          tealGripMaterial,
        );
        probeCollar.position.y = 0.34;
        probeGroup.add(probeCollar);
        const probeTipCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.62, 0),
          new THREE.Vector3(0.06, 0.96, 0.03),
          new THREE.Vector3(0.26, 1.16, 0.05),
          new THREE.Vector3(0.18, 1.38, 0.02),
          new THREE.Vector3(0.01, 1.44, 0),
        ]);
        probeGroup.add(
          new THREE.Mesh(new THREE.TubeGeometry(probeTipCurve, 28, 0.02, 12, false), steelMaterial),
        );
        instrumentsOrbitGroup.add(probeGroup);

        // Instrument C: Ultrasonic Scaler Handpiece
        const scalerGroup = new THREE.Group();
        scalerGroup.add(
          new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 1.15, 20), porcelainMaterial),
        );
        const scalerAccent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.092, 0.096, 0.24, 20),
          tealGripMaterial,
        );
        scalerAccent.position.y = 0.08;
        scalerGroup.add(scalerAccent);
        const scalerNozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.072, 0.32, 16),
          steelMaterial,
        );
        scalerNozzle.position.y = 0.72;
        scalerGroup.add(scalerNozzle);
        const scalerTipCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.86, 0),
          new THREE.Vector3(0.04, 1.12, 0),
          new THREE.Vector3(0.18, 1.32, 0.04),
        ]);
        scalerGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(scalerTipCurve, 20, 0.018, 10, false),
            steelMaterial,
          ),
        );
        const mistRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.09, 0.012, 10, 28),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.75,
          }),
        );
        mistRing.position.set(0.18, 1.32, 0.04);
        scalerGroup.add(mistRing);
        instrumentsOrbitGroup.add(scalerGroup);

        // Instrument D: Optical Curing / Scanner Light Wand + Translucent Beam Cone
        const curingGroup = new THREE.Group();
        curingGroup.add(
          new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 1.05, 20), brandMetalMaterial),
        );
        const curingNeck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.058, 0.42, 16),
          steelMaterial,
        );
        curingNeck.position.set(0.1, 0.68, 0);
        curingNeck.rotation.z = -0.45;
        curingGroup.add(curingNeck);
        const curingLens = new THREE.Mesh(
          new THREE.SphereGeometry(0.068, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        );
        curingLens.position.set(0.22, 0.88, 0);
        curingGroup.add(curingLens);
        const lightCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.46, 1.35, 32, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        lightCone.position.set(0.55, 1.44, 0);
        lightCone.rotation.z = 2.62;
        curingGroup.add(lightCone);
        instrumentsOrbitGroup.add(curingGroup);

        // 4. Signature DentHub Orbital Rings & Reactive Particle Field
        const orbitGroup = new THREE.Group();
        const primaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.1, 0.04, 24, 128),
          brandMetalMaterial,
        );
        primaryOrbit.position.y = -0.22;
        primaryOrbit.rotation.x = Math.PI / 2.35;
        primaryOrbit.rotation.y = -0.26;
        orbitGroup.add(primaryOrbit);

        const orbiterNode = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0x0f766e }),
        );
        primaryOrbit.add(orbiterNode);
        orbiterNode.position.set(2.1, 0, 0);

        const secondaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.65, 0.016, 16, 128),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.42,
          }),
        );
        secondaryOrbit.rotation.x = Math.PI / 2.85;
        secondaryOrbit.rotation.y = 0.34;
        orbitGroup.add(secondaryOrbit);
        worldGroup.add(orbitGroup);

        const particleCount = 80;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i += 1) {
          const radius = 2.1 + Math.random() * 2.1;
          const theta = Math.random() * Math.PI * 2;
          const ySpread = (Math.random() - 0.5) * 3.8;
          positions[i * 3] = Math.cos(theta) * radius;
          positions[i * 3 + 1] = ySpread;
          positions[i * 3 + 2] = Math.sin(theta) * radius;
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(
          particleGeo,
          new THREE.PointsMaterial({
            color: 0x0284c7,
            size: 0.06,
            transparent: true,
            opacity: 0.58,
          }),
        );
        worldGroup.add(particles);

        // 5. Real-Time Spring-Damped Cursor Tracking & Animation Loop
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
          positionStageForAspect(nextW, nextH);
        };
        window.addEventListener('resize', handleResize);

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const placeOrbitingInstruments = (t: number) => {
          const r1 = 2.25;
          mirrorGroup.position.set(
            Math.cos(t * 0.55) * r1,
            0.55 + Math.sin(t * 1.1) * 0.25,
            Math.sin(t * 0.55) * r1 * 0.78,
          );
          mirrorGroup.lookAt(0, 0.3, 0);
          mirrorGroup.rotateZ(0.45);

          const a2 = t * 0.55 + Math.PI * 0.55;
          probeGroup.position.set(
            Math.cos(a2) * 2.38,
            -0.35 + Math.cos(t * 0.95) * 0.22,
            Math.sin(a2) * 1.95,
          );
          probeGroup.lookAt(0, 0.1, 0);
          probeGroup.rotateZ(-0.52);

          const a3 = t * 0.55 + Math.PI * 1.08;
          scalerGroup.position.set(
            Math.cos(a3) * 2.42,
            0.2 + Math.sin(t * 1.25 + 1.4) * 0.28,
            Math.sin(a3) * 2.0,
          );
          scalerGroup.lookAt(0, 0.2, 0);
          mistRing.scale.setScalar(1 + Math.sin(t * 5.2) * 0.22);

          const a4 = t * 0.55 + Math.PI * 1.62;
          curingGroup.position.set(
            Math.cos(a4) * 2.2,
            0.78 + Math.cos(t * 1.05 + 0.8) * 0.2,
            Math.sin(a4) * 1.82,
          );
          curingGroup.lookAt(0, 0.35, 0);
          curingGroup.rotateZ(0.35);
        };

        let clock = 0;
        const animate = () => {
          if (isDisposed) return;

          const drag = dragStateRef.current;

          if (!prefersReducedMotion) {
            clock += 0.015;

            const stiffness = 0.068;
            const damping = 0.82;
            springVelX = (springVelX + (pointerNormX - springX) * stiffness) * damping;
            springVelY = (springVelY + (pointerNormY - springY) * stiffness) * damping;
            springX += springVelX;
            springY += springVelY;

            if (!drag.active) {
              drag.yaw += drag.velYaw;
              drag.pitch = Math.max(-0.75, Math.min(0.75, drag.pitch + drag.velPitch));
              drag.velYaw *= 0.94;
              drag.velPitch *= 0.92;
            }

            toothGroup.rotation.y = clock * 0.38 + drag.yaw + springX * 0.62;
            toothGroup.rotation.x = Math.sin(clock * 0.72) * 0.07 + drag.pitch + springY * 0.38;
            toothGroup.position.y = 0.14 + Math.sin(clock * 1.2) * 0.1;

            instrumentsOrbitGroup.rotation.y = drag.yaw * 0.65 + springX * 0.45;
            instrumentsOrbitGroup.rotation.x = drag.pitch * 0.45 + springY * 0.3;
            placeOrbitingInstruments(clock);

            orbitGroup.rotation.y = springX * 0.32;
            orbitGroup.rotation.x = springY * 0.24;
            orbitGroup.position.x = springX * 0.18;
            orbitGroup.position.y = -springY * 0.14;

            primaryOrbit.rotation.z = clock * 0.62;
            secondaryOrbit.rotation.z = -clock * 0.4;

            particles.rotation.y = clock * 0.14 - springX * 0.3;
            particles.rotation.x = -springY * 0.2;
            particles.position.x = -springX * 0.28;
            particles.position.y = springY * 0.2;

            beamGroup.position.y = Math.sin(clock * 1.32) * 1.12 + 0.08;
            beamGroup.rotation.z = springX * 0.16;

            rimLight.position.x = springX * 2.8;
            rimLight.position.y = -3.0 - springY * 1.4;

            renderer.render(scene, camera);
            animationFrameId = window.requestAnimationFrame(animate);
          } else {
            toothGroup.rotation.y = 0.25 + drag.yaw;
            toothGroup.rotation.x = 0.08 + drag.pitch;
            beamGroup.position.y = 0.15;
            placeOrbitingInstruments(0.6);
            renderer.render(scene, camera);
          }
        };
        animate();

        cleanupFn = () => {
          window.removeEventListener('pointermove', handleWindowPointerMove);
          window.removeEventListener('resize', handleResize);
          window.cancelAnimationFrame(animationFrameId);
          pmremGenerator?.dispose();
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
    const dYaw = dx * 0.012;
    const dPitch = dy * 0.01;
    drag.yaw += dYaw;
    drag.pitch = Math.max(-0.75, Math.min(0.75, drag.pitch + dPitch));
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
      aria-label="Animasi 3D Interaktif Gigi dan Instrumen Dokter Gigi DentHub yang merespons gerakan kursor"
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
