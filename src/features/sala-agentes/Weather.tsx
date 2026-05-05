import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type WeatherKind = 'sunny' | 'cloudy' | 'rainy' | 'storm';

/** Picks weather pseudo-randomly but stable for ~10 minutes. */
export function pickWeather(seedMs = Date.now()): WeatherKind {
  // change every 10 minutes
  const bucket = Math.floor(seedMs / (10 * 60 * 1000));
  // simple hash
  let h = bucket * 9301 + 49297;
  h = (h % 233280) / 233280;
  if (h < 0.45) return 'sunny';
  if (h < 0.75) return 'cloudy';
  if (h < 0.93) return 'rainy';
  return 'storm';
}

interface RainProps {
  count?: number;
  area?: [number, number]; // x, z half-extents
  intensity?: number; // 0..1
}

function Rain({ count = 600, area = [16, 12], intensity = 1 }: RainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * area[0] * 2,
      y: Math.random() * 10 + 2,
      z: (Math.random() - 0.5) * area[1] * 2,
      speed: 0.18 + Math.random() * 0.18,
    }));
  }, [count, area]);

  useFrame(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      p.y -= p.speed * (0.7 + intensity * 1.3);
      if (p.y < 0.05) p.y = 10;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.012, 0.18, 0.012);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry />
      <meshBasicMaterial color="#9bc4ff" transparent opacity={0.55} />
    </instancedMesh>
  );
}

function Cloud({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[
        [0, 0, 0, 1.2],
        [0.9, 0.1, 0, 0.9],
        [-0.9, 0.05, 0, 0.95],
        [0.3, 0.4, 0.1, 0.8],
        [-0.4, 0.35, -0.1, 0.7],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <sphereGeometry args={[s as number, 12, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

interface WeatherProps {
  weather: WeatherKind;
  isNight: boolean;
}

export function Weather({ weather, isNight }: WeatherProps) {
  const showRain = weather === 'rainy' || weather === 'storm';
  const showHeavyClouds = weather === 'cloudy' || weather === 'storm' || weather === 'rainy';

  // Painted sky backdrop visible only through windows (placed behind the back wall).
  const skyColor = isNight
    ? (showRain ? '#0a0f1f' : '#0f1c3a')
    : weather === 'sunny'
    ? '#7ec0ee'
    : weather === 'cloudy'
    ? '#8fa1b8'
    : weather === 'rainy'
    ? '#6b7a90'
    : '#3f4a5e';

  // Z position of windows is roughly -8.9 (wall at -9). Put backdrop just behind it,
  // and constrain to the window strip height so clouds never appear inside the room.
  return (
    <group>
      {/* Sky strip directly behind windows only (matches window band: y≈4, height≈2.5) */}
      <mesh position={[0, 4, -9.05]}>
        <planeGeometry args={[24, 2.5]} />
        <meshBasicMaterial color={skyColor} />
      </mesh>

      {/* Painted clouds as flat sprites on the sky strip — cloudy/rainy/storm only */}
      {showHeavyClouds && (
        <group position={[0, 4, -9.04]}>
          <PaintedCloud x={-8} y={0.6} scale={0.9} isNight={isNight} />
          <PaintedCloud x={-2} y={0.2} scale={1.1} isNight={isNight} />
          <PaintedCloud x={4} y={0.7} scale={1} isNight={isNight} />
          <PaintedCloud x={9} y={0.3} scale={0.8} isNight={isNight} />
        </group>
      )}

      {/* Rain confined to the window strip behind glass */}
      {showRain && (
        <group position={[0, 0, -9.03]}>
          <Rain count={weather === 'storm' ? 500 : 280} area={[12, 0.4]} intensity={weather === 'storm' ? 1 : 0.6} />
        </group>
      )}

      {/* Lightning flash visible through windows */}
      {weather === 'storm' && <Lightning />}
    </group>
  );
}

function PaintedCloud({ x, y, scale, isNight }: { x: number; y: number; scale: number; isNight: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = x + Math.sin(clock.getElapsedTime() * 0.04 + x) * 0.6;
  });
  const color = isNight ? '#4a5168' : '#e8eef7';
  return (
    <group ref={ref} position={[x, y, 0]} scale={scale}>
      {[
        [0, 0, 0.55],
        [0.55, 0.05, 0.4],
        [-0.55, 0.05, 0.42],
        [0.25, 0.22, 0.35],
        [-0.25, 0.2, 0.32],
      ].map(([cx, cy, r], i) => (
        <mesh key={i} position={[cx as number, cy as number, 0]}>
          <circleGeometry args={[r as number, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Lightning() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // random flash every few seconds
    const flash = Math.sin(t * 0.3) > 0.97 ? Math.random() * 4 : 0;
    ref.current.intensity = flash;
  });
  return <pointLight ref={ref} position={[0, 8, -9]} color="#bcd4ff" distance={30} intensity={0} />;
}
