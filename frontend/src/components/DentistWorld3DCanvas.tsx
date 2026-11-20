'use client';

import React, { useEffect, useRef } from 'react';

export interface DentistWorld3DCanvasProps {
  className?: string;
}

/**
 * Kanvas 3D Interaktif "Dunia Dentist" menggunakan Three.js (`DentistWorld3DCanvas.tsx`):
 * - Merender model 3D gigi geraham porselen putih mengilap yang halus (sculpted lathe crown +
 *   4 rounded cusps + 3 curved roots) menggunakan `MeshPhysicalMaterial` dengan pencahayaan studio lembut.
 * - Dilingkari cincin orbit biru-cyan tipis yang elegan sesuai logo resmi DentHub (`#0284C7` & `#0369A1`)
 *   serta partikel cahaya halus yang mengikuti gerakan kursor.
 * - Tanpa lapisan blur di atas kanvas sehingga visual 3D tampil tajam dan jernih.
 */
export function DentistWorld3DCanvas({ className = '' }: DentistWorld3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

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
        const height = container.clientHeight || 520;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        // Refleksi studio (environment map) agar porselen tampak mengilap & bervolume
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
          // Lanjut tanpa environment map bila modul tidak tersedia
        }
        const camera = new THREE.PerspectiveCamera(38, width / Math.max(height, 1), 0.1, 100);
        camera.position.set(0, 0.25, 6.6);

        // Pencahayaan studio porselen bersih agar permukaan gigi tampak putih mutiara (bukan abu-abu)
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

        // Material email gigi porselen mutiara mengilap
        const porcelainMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: 0xf0f9ff,
          emissiveIntensity: 0.18,
          roughness: 0.14,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          reflectivity: 0.9,
        });

        const toothGroup = new THREE.Group();

        // 1. Badan Mahkota Gigi (LatheGeometry organik berlekuk anatomis, bukan kotak)
        const crownProfile = [
          new THREE.Vector2(0.0, -0.35),
          new THREE.Vector2(0.58, -0.32),
          new THREE.Vector2(0.86, -0.05),
          new THREE.Vector2(0.98, 0.38),
          new THREE.Vector2(0.92, 0.78),
          new THREE.Vector2(0.65, 1.02),
          new THREE.Vector2(0.0, 0.88),
        ];
        const crownBodyGeo = new THREE.LatheGeometry(crownProfile, 48);
        const crownBody = new THREE.Mesh(crownBodyGeo, porcelainMaterial);
        crownBody.scale.set(1.05, 1.0, 0.92);
        toothGroup.add(crownBody);

        // 2. Empat Puncak Mahkota Gigi Geraham (Sculpted Rounded Cusps)
        const cuspCoords: Array<[number, number, number]> = [
          [-0.38, 0.86, -0.32],
          [0.38, 0.86, -0.32],
          [-0.38, 0.86, 0.32],
          [0.38, 0.86, 0.32],
        ];
        for (const [cx, cy, cz] of cuspCoords) {
          const cuspGeo = new THREE.SphereGeometry(0.48, 32, 32);
          const cuspMesh = new THREE.Mesh(cuspGeo, porcelainMaterial);
          cuspMesh.position.set(cx, cy, cz);
          cuspMesh.scale.set(1.0, 0.82, 1.0);
          toothGroup.add(cuspMesh);
        }

        // 3. Dua Akar Gigi Melengkung Halus (Tapered Organic Roots)
        const rootCurveLeft = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.36, -0.22, 0),
          new THREE.Vector3(-0.46, -0.82, 0.04),
          new THREE.Vector3(-0.34, -1.42, 0.08),
        ]);
        const leftRootGeo = new THREE.TubeGeometry(rootCurveLeft, 24, 0.26, 20, false);
        const leftRoot = new THREE.Mesh(leftRootGeo, porcelainMaterial);
        toothGroup.add(leftRoot);

        const leftTip = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 20), porcelainMaterial);
        leftTip.position.set(-0.34, -1.42, 0.08);
        toothGroup.add(leftTip);

        const rootCurveRight = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.36, -0.22, 0),
          new THREE.Vector3(0.46, -0.82, -0.04),
          new THREE.Vector3(0.34, -1.42, -0.08),
        ]);
        const rightRootGeo = new THREE.TubeGeometry(rootCurveRight, 24, 0.26, 20, false);
        const rightRoot = new THREE.Mesh(rightRootGeo, porcelainMaterial);
        toothGroup.add(rightRoot);

        const rightTip = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 20), porcelainMaterial);
        rightTip.position.set(0.34, -1.42, -0.08);
        toothGroup.add(rightTip);

        toothGroup.position.y = 0.15;
        worldGroup.add(toothGroup);

        // 4. Cincin Orbit Biru-Cyan Tipis Sesuai Identitas Logo DentHub
        const primaryOrbitMat = new THREE.MeshPhysicalMaterial({
          color: 0x0284c7,
          emissive: 0x0369a1,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.3,
        });
        const primaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(1.88, 0.042, 24, 120),
          primaryOrbitMat,
        );
        primaryOrbit.position.y = -0.32;
        primaryOrbit.rotation.x = Math.PI / 2.35;
        primaryOrbit.rotation.y = -0.28;
        worldGroup.add(primaryOrbit);

        const secondaryOrbitMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.45,
        });
        const secondaryOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.25, 0.018, 16, 120),
          secondaryOrbitMat,
        );
        secondaryOrbit.rotation.x = Math.PI / 2.8;
        secondaryOrbit.rotation.y = 0.35;
        worldGroup.add(secondaryOrbit);

        // Bola ion pelindung yang beredar di sepanjang cincin orbit
        const orbiterNode = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0x0284c7 }),
        );
        primaryOrbit.add(orbiterNode);
        orbiterNode.position.set(1.88, 0, 0);

        // 5. Partikel Ion Fluoride Halus
        const particleCount = 70;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i += 1) {
          const radius = 2.1 + Math.random() * 1.6;
          const theta = Math.random() * Math.PI * 2;
          const ySpread = (Math.random() - 0.5) * 3.2;
          positions[i * 3] = Math.cos(theta) * radius;
          positions[i * 3 + 1] = ySpread;
          positions[i * 3 + 2] = Math.sin(theta) * radius;
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
          color: 0x0284c7,
          size: 0.065,
          transparent: true,
          opacity: 0.65,
        });
        const particles = new THREE.Points(particleGeo, particleMat);
        worldGroup.add(particles);

        let targetRotX = 0;
        let targetRotY = 0;
        const handlePointerMove = (e: MouseEvent) => {
          targetRotY = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 0.65;
          targetRotX = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 0.35;
        };
        window.addEventListener('mousemove', handlePointerMove, { passive: true });

        const handleResize = () => {
          if (!mountRef.current) return;
          const nextW = mountRef.current.clientWidth || 560;
          const nextH = mountRef.current.clientHeight || 520;
          camera.aspect = nextW / Math.max(nextH, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(nextW, nextH);
        };
        window.addEventListener('resize', handleResize);

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let clock = 0;
        const animate = () => {
          if (isDisposed) return;
          if (!prefersReducedMotion) {
            clock += 0.014;
            toothGroup.rotation.y = clock * 0.55 + targetRotY;
            toothGroup.rotation.x = Math.sin(clock * 0.8) * 0.08 + targetRotX;
            toothGroup.position.y = 0.15 + Math.sin(clock * 1.3) * 0.12;

            primaryOrbit.rotation.z = clock * 0.7;
            secondaryOrbit.rotation.z = -clock * 0.45;
            particles.rotation.y = clock * 0.15;
          }

          renderer.render(scene, camera);
          if (!prefersReducedMotion) {
            animationFrameId = window.requestAnimationFrame(animate);
          }
        };
        animate();

        cleanupFn = () => {
          window.removeEventListener('mousemove', handlePointerMove);
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

  return (
    <div
      aria-hidden="true"
      data-testid="dentist-3d-canvas"
      className={['relative h-full w-full select-none', className].filter(Boolean).join(' ')}
    >
      <div ref={mountRef} className="relative z-10 h-full w-full" />
    </div>
  );
}

export default DentistWorld3DCanvas;
