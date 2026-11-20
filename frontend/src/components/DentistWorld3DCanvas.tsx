'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, Pause, Play, RotateCcw, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';

export interface DentistWorld3DCanvasProps {
  className?: string;
}

export type InspectionModeId = 'auto' | 'caries' | 'calculus' | 'gingivitis';

interface InspectionModeSpec {
  id: InspectionModeId;
  label: string;
  zoneTitle: string;
  description: string;
  beamY: number;
  targetYaw: number;
  targetPitch: number;
  markerPos: [number, number, number];
  markerHex: number;
}

export const HERO_INSPECTION_MODES: readonly InspectionModeSpec[] = [
  {
    id: 'auto',
    label: 'Pindai Otomatis',
    zoneTitle: 'Pemindaian Optik 360°',
    description:
      'Seret model gigi untuk memutar 360° atau pilih titik inspeksi untuk melihat fokus skrining AI DentHub.',
    beamY: 0,
    targetYaw: 0,
    targetPitch: 0.08,
    markerPos: [0, 0.85, 0.65],
    markerHex: 0x0284c7,
  },
  {
    id: 'caries',
    label: 'Fokus Karies',
    zoneTitle: 'Area Celah Mahkota (Oklusal)',
    description:
      'Model AI memeriksa perubahan warna gelap atau bayangan karies dini pada permukaan kunyah gigi.',
    beamY: 0.88,
    targetYaw: 0.35,
    targetPitch: 0.42,
    markerPos: [0.18, 0.95, 0.25],
    markerHex: 0xb91c1c,
  },
  {
    id: 'calculus',
    label: 'Fokus Karang Gigi',
    zoneTitle: 'Area Leher Gigi (Servikal)',
    description:
      'Penumpukan plak mengeras (calculus) umumnya terdeteksi di sepanjang tepi dasar mahkota gigi.',
    beamY: -0.18,
    targetYaw: -0.55,
    targetPitch: 0.1,
    markerPos: [-0.62, -0.15, 0.56],
    markerHex: 0xb45309,
  },
  {
    id: 'gingivitis',
    label: 'Fokus Gusi',
    zoneTitle: 'Batas Gusi & Akar (Gingiva)',
    description:
      'Indikasi radang gusi (gingivitis) dievaluasi dari kemerahan dan pembengkakan di sekitar garis gusi.',
    beamY: -0.78,
    targetYaw: 0.72,
    targetPitch: -0.12,
    markerPos: [0.46, -0.72, 0.34],
    markerHex: 0x0f766e,
  },
] as const;

/**
 * Interactive 3D Dental Screening Hero (`DentistWorld3DCanvas.tsx`, docs/DESIGN.md §3.1):
 * - Sculpted porcelain molar + curved roots + tilted brand orbital ring (`#0284C7`)
 * - Animated optical scanning beam sweeping vertically across the tooth
 * - Interactive drag-to-rotate + hover tilt + clickable inspection hotspots/modes
 * - Zero `backdrop-blur` over the 3D scene; respects `prefers-reduced-motion`.
 */
export function DentistWorld3DCanvas({ className = '' }: DentistWorld3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [activeMode, setActiveMode] = useState<InspectionModeId>('auto');
  const [isBeamPlaying, setIsBeamPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const modeRef = useRef<InspectionModeId>('auto');
  const beamPlayingRef = useRef<boolean>(true);
  const dragRotationRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const dragPointerRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    modeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    beamPlayingRef.current = isBeamPlaying;
  }, [isBeamPlaying]);

  const currentSpec =
    HERO_INSPECTION_MODES.find((m) => m.id === activeMode) ?? HERO_INSPECTION_MODES[0];

  const handleResetView = () => {
    dragRotationRef.current = { yaw: 0, pitch: 0 };
    setActiveMode('auto');
    setIsBeamPlaying(true);
  };

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

        const width = container.clientWidth || 560;
        const height = container.clientHeight || 420;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
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
          // Proceed cleanly without PMREM environment
        }

        const camera = new THREE.PerspectiveCamera(36, width / Math.max(height, 1), 0.1, 100);
        camera.position.set(0, 0.15, 6.4);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0f2fe, 2.2);
        scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
        keyLight.position.set(4.5, 6.5, 6.0);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xbae6fd, 1.4);
        fillLight.position.set(-5.0, 2.0, 4.0);
        scene.add(fillLight);

        const rimLight = new THREE.PointLight(0x0284c7, 2.2, 18);
        rimLight.position.set(0, -3.5, 3.0);
        scene.add(rimLight);

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);

        // Pearly porcelain molar material
        const porcelainMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: 0xf0f9ff,
          emissiveIntensity: 0.18,
          roughness: 0.14,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          reflectivity: 0.92,
        });

        const toothGroup = new THREE.Group();

        // 1. Sculpted anatomical crown body
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
          new THREE.LatheGeometry(crownProfile, 48),
          porcelainMaterial,
        );
        crownBody.scale.set(1.05, 1.0, 0.92);
        toothGroup.add(crownBody);

        // 2. Four rounded cusps
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

        // 3. Curved organic roots
        const rootCurveLeft = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.36, -0.22, 0),
          new THREE.Vector3(-0.46, -0.82, 0.04),
          new THREE.Vector3(-0.34, -1.42, 0.08),
        ]);
        toothGroup.add(
          new THREE.Mesh(new THREE.TubeGeometry(rootCurveLeft, 24, 0.26, 20, false), porcelainMaterial),
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

        // 4. Interactive 3D inspection hotspot marker on the tooth
        const hotspotMat = new THREE.MeshBasicMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.9,
        });
        const hotspotCore = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), hotspotMat);
        const hotspotPulseRing = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.22, 32),
          new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
          }),
        );
        hotspotCore.add(hotspotPulseRing);
        hotspotCore.visible = false;
        toothGroup.add(hotspotCore);

        toothGroup.position.y = 0.12;
        worldGroup.add(toothGroup);

        // 5. Animated Optical Scanning Beam sweeping vertically across the tooth
        const beamGroup = new THREE.Group();
        const beamRingMat = new THREE.MeshBasicMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.85,
        });
        const beamRing = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.026, 16, 96), beamRingMat);
        beamRing.rotation.x = Math.PI / 2;
        beamGroup.add(beamRing);

        const beamDiscMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const beamDisc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), beamDiscMat);
        beamDisc.rotation.x = Math.PI / 2;
        beamGroup.add(beamDisc);
        worldGroup.add(beamGroup);

        // 6. Signature DentHub orbital rings
        const primaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(1.88, 0.04, 24, 120),
          new THREE.MeshPhysicalMaterial({
            color: 0x0284c7,
            emissive: 0x0369a1,
            emissiveIntensity: 0.35,
            roughness: 0.2,
            metalness: 0.3,
          }),
        );
        primaryOrbit.position.y = -0.28;
        primaryOrbit.rotation.x = Math.PI / 2.35;
        primaryOrbit.rotation.y = -0.28;
        worldGroup.add(primaryOrbit);

        const orbiterNode = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0x0f766e }),
        );
        primaryOrbit.add(orbiterNode);
        orbiterNode.position.set(1.88, 0, 0);

        const secondaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.22, 0.016, 16, 120),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.4,
          }),
        );
        secondaryOrbit.rotation.x = Math.PI / 2.8;
        secondaryOrbit.rotation.y = 0.35;
        worldGroup.add(secondaryOrbit);

        // 7. Subtle orbital particles
        const particleCount = 60;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i += 1) {
          const radius = 2.05 + Math.random() * 1.45;
          const theta = Math.random() * Math.PI * 2;
          const ySpread = (Math.random() - 0.5) * 3.0;
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
            opacity: 0.55,
          }),
        );
        worldGroup.add(particles);

        // Pointer hover + drag rotation
        let hoverRotX = 0;
        let hoverRotY = 0;
        const handleWindowMouseMove = (e: MouseEvent) => {
          hoverRotY = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 0.45;
          hoverRotX = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 0.25;
        };
        window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });

        const handleResize = () => {
          if (!mountRef.current) return;
          const nextW = mountRef.current.clientWidth || 560;
          const nextH = mountRef.current.clientHeight || 420;
          camera.aspect = nextW / Math.max(nextH, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(nextW, nextH);
        };
        window.addEventListener('resize', handleResize);

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let clock = 0;
        let currentBeamY = 0;
        const animate = () => {
          if (isDisposed) return;

          const activeSpec =
            HERO_INSPECTION_MODES.find((m) => m.id === modeRef.current) ?? HERO_INSPECTION_MODES[0];

          if (!prefersReducedMotion) {
            clock += 0.015;
            const autoSpin = activeSpec.id === 'auto' ? clock * 0.42 : activeSpec.targetYaw;
            const desiredY = autoSpin + dragRotationRef.current.yaw + hoverRotY;
            const desiredX =
              activeSpec.targetPitch +
              dragRotationRef.current.pitch +
              Math.sin(clock * 0.8) * 0.06 +
              hoverRotX;

            toothGroup.rotation.y += (desiredY - toothGroup.rotation.y) * 0.08;
            toothGroup.rotation.x += (desiredX - toothGroup.rotation.x) * 0.08;
            toothGroup.position.y = 0.12 + Math.sin(clock * 1.2) * 0.09;

            primaryOrbit.rotation.z = clock * 0.65;
            secondaryOrbit.rotation.z = -clock * 0.4;
            particles.rotation.y = clock * 0.14;

            // Optical scanning beam sweep or focused inspection lock
            const targetBeamY =
              activeSpec.id === 'auto' && beamPlayingRef.current
                ? Math.sin(clock * 1.35) * 1.15
                : activeSpec.beamY;
            currentBeamY += (targetBeamY - currentBeamY) * 0.1;
            beamGroup.position.y = currentBeamY + 0.05;
            beamRingMat.color.setHex(activeSpec.markerHex);
            beamDiscMat.color.setHex(activeSpec.markerHex);

            // Focused hotspot indicator on tooth
            const showHotspot = activeSpec.id !== 'auto';
            hotspotCore.visible = showHotspot;
            if (showHotspot) {
              hotspotCore.position.set(...activeSpec.markerPos);
              hotspotMat.color.setHex(activeSpec.markerHex);
              (hotspotPulseRing.material as import('three').MeshBasicMaterial).color.setHex(
                activeSpec.markerHex,
              );
              const pulse = 1 + Math.sin(clock * 4.5) * 0.25;
              hotspotPulseRing.scale.set(pulse, pulse, 1);
              hotspotPulseRing.lookAt(camera.position);
            }
          } else {
            toothGroup.rotation.y = activeSpec.targetYaw + dragRotationRef.current.yaw;
            toothGroup.rotation.x = activeSpec.targetPitch + dragRotationRef.current.pitch;
            beamGroup.position.y = activeSpec.beamY;
            beamRingMat.color.setHex(activeSpec.markerHex);
            hotspotCore.visible = activeSpec.id !== 'auto';
            if (hotspotCore.visible) {
              hotspotCore.position.set(...activeSpec.markerPos);
              hotspotMat.color.setHex(activeSpec.markerHex);
            }
          }

          renderer.render(scene, camera);
          animationFrameId = window.requestAnimationFrame(animate);
        };
        animate();

        cleanupFn = () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
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
    dragPointerRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPointerRef.current.active) return;
    const dx = e.clientX - dragPointerRef.current.lastX;
    const dy = e.clientY - dragPointerRef.current.lastY;
    dragPointerRef.current.lastX = e.clientX;
    dragPointerRef.current.lastY = e.clientY;
    dragRotationRef.current = {
      yaw: dragRotationRef.current.yaw + dx * 0.012,
      pitch: Math.max(-0.7, Math.min(0.7, dragRotationRef.current.pitch + dy * 0.01)),
    };
  };

  const handlePointerUp = () => {
    dragPointerRef.current.active = false;
    setIsDragging(false);
  };

  return (
    <div
      data-testid="dentist-3d-canvas"
      className={['relative flex h-full w-full flex-col select-none', className]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 3D Interactive Stage — zero backdrop-blur over the 3D scene */}
      <div
        role="application"
        aria-label="Model 3D Interaktif Pemeriksaan Gigi DentHub — seret untuk memutar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          'relative min-h-[260px] flex-1 touch-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
      >
        <div ref={mountRef} className="relative z-10 h-full w-full" />

        {/* Live screening status chip (crisp solid surface, no blur overlay) */}
        <div className="pointer-events-none absolute left-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold text-brand-dark shadow-sm">
          <ScanLine className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          <span>{currentSpec.zoneTitle}</span>
        </div>

        {/* Beam play/pause & reset angle controls */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
          {activeMode === 'auto' && (
            <button
              type="button"
              onClick={() => setIsBeamPlaying((prev) => !prev)}
              aria-label={isBeamPlaying ? 'Jeda animasi sinar pindai' : 'Jalankan animasi sinar pindai'}
              className="inline-flex h-9 w-9 min-h-touch min-w-touch items-center justify-center rounded-pill border border-border bg-surface text-brand-dark shadow-sm transition-colors hover:bg-brand-soft"
            >
              {isBeamPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Atur ulang sudut pandang 3D"
            className="inline-flex h-9 w-9 min-h-touch min-w-touch items-center justify-center rounded-pill border border-border bg-surface text-brand-dark shadow-sm transition-colors hover:bg-brand-soft"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Interactive Hotspot / Screening Mode Selector */}
      <div className="relative z-20 mt-2 space-y-2.5 rounded-card border border-border bg-surface p-3.5 shadow-sm">
        <div
          role="tablist"
          aria-label="Pilih titik inspeksi model 3D gigi"
          className="flex flex-wrap gap-1.5"
        >
          {HERO_INSPECTION_MODES.map((mode) => {
            const active = activeMode === mode.id;
            const Icon =
              mode.id === 'auto' ? Sparkles : mode.id === 'gingivitis' ? ShieldCheck : Eye;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`hero-hotspot-${mode.id}`}
                onClick={() => setActiveMode(mode.id)}
                className={[
                  'inline-flex h-9 min-h-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-brand text-surface shadow-sm'
                    : 'border border-border bg-bg text-text-muted hover:bg-brand-soft hover:text-brand-dark',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <p data-testid="hero-hotspot-description" className="text-xs leading-relaxed text-text-muted">
          {currentSpec.description}
        </p>
      </div>
    </div>
  );
}

export default DentistWorld3DCanvas;
