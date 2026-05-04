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

  // Window backdrop "world": clouds floating + rain only behind windows (z far)
  const cloudColor = isNight ? '#3b3f55' : '#f0f4ff';

  return (
    <group>
      {/* Skydome backdrop visible through windows — placed far behind the back wall */}
      <mesh position={[0, 6, -11]}>
        <planeGeometry args={[40, 14]} />
        <meshBasicMaterial
          color={
            isNight
              ? showRain
                ? '#0a0f1f'
                : '#0f1c3a'
              : weather === 'sunny'
              ? '#7ec0ee'
              : weather === 'cloudy'
              ? '#9aa9bd'
              : '#5d6b80'
          }
        />
      </mesh>

      {/* Clouds drifting behind windows */}
      <group position={[0, 5.5, -10.5]}>
        <FloatingCloud position={[-6, 1.5, 0]} scale={showHeavyClouds ? 1.4 : 0.9} color={cloudColor} drift={0.4} />
        <FloatingCloud position={[2, 2, 0]} scale={showHeavyClouds ? 1.6 : 1} color={cloudColor} drift={0.3} />
        {showHeavyClouds && (
          <>
            <FloatingCloud position={[6, 1, 0]} scale={1.3} color={cloudColor} drift={0.5} />
            <FloatingCloud position={[-2, 0.5, 0]} scale={1.1} color={cloudColor} drift={0.6} />
          </>
        )}
      </group>

      {/* Rain particles only in window plane area */}
      {showRain && (
        <group position={[0, 0, -10]}>
          <Rain count={weather === 'storm' ? 800 : 400} area={[14, 1]} intensity={weather === 'storm' ? 1 : 0.6} />
        </group>
      )}

      {/* Lightning flash for storm */}
      {weather === 'storm' && <Lightning />}
    </group>
  );
}

function FloatingCloud({
  position,
  scale,
  color,
  drift,
}: {
  position: [number, number, number];
  scale: number;
  color: string;
  drift: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const startX = position[0];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.x = startX + Math.sin(t * 0.05 * drift) * 2;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[
        [0, 0, 0, 1.2],
        [1, 0.1, 0, 0.9],
        [-1, 0.05, 0, 0.95],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <sphereGeometry args={[s as number, 10, 10]} />
          <meshStandardMaterial color={color} roughness={1} emissive={color} emissiveIntensity={0.05} />
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
