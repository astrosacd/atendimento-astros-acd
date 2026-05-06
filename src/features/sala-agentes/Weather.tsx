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

  // Cores de céu mais naturais
  const skyColor = isNight
    ? (showRain ? '#050a1a' : '#080e1f')
    : weather === 'sunny'
    ? '#4fa3e0'
    : weather === 'cloudy'
    ? '#7c8ea6'
    : weather === 'rainy'
    ? '#5d6b7d'
    : '#2d3745';

  return (
    <group>
      {/* Background do Céu (Fundo das janelas) */}
      <mesh position={[0, 3.2, -9.1]}>
        <planeGeometry args={[26, 4]} />
        <meshBasicMaterial color={skyColor} />
      </mesh>

      {/* Estrelas (apenas se noite e sem nuvens pesadas) */}
      {isNight && weather === 'sunny' && (
        <group position={[0, 3.2, -9.09]}>
          {[...Array(40)].map((_, i) => (
            <mesh key={i} position={[Math.random() * 20 - 10, Math.random() * 3 - 1.5, 0]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="white" />
            </mesh>
          ))}
        </group>
      )}

      {/* Nuvens Suaves (substituindo os círculos por algo mais etéreo) */}
      {showHeavyClouds && (
        <group position={[0, 3.2, -9.08]}>
          <SoftCloud x={-10} y={0.5} scale={1.2} opacity={0.4} isNight={isNight} />
          <SoftCloud x={-4} y={-0.2} scale={1.5} opacity={0.3} isNight={isNight} />
          <SoftCloud x={3} y={0.6} scale={1.3} opacity={0.4} isNight={isNight} />
          <SoftCloud x={10} y={0.1} scale={1.1} opacity={0.3} isNight={isNight} />
        </group>
      )}

      {/* Chuva (confinada à área externa das janelas) */}
      {showRain && (
        <group position={[0, 0, -9.05]}>
          <Rain count={weather === 'storm' ? 600 : 300} area={[13, 0.5]} intensity={weather === 'storm' ? 1 : 0.6} />
        </group>
      )}

      {/* Clarão de relâmpago */}
      {weather === 'storm' && <Lightning />}
    </group>
  );
}

function SoftCloud({ x, y, scale, opacity, isNight }: any) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = x + Math.sin(clock.getElapsedTime() * 0.05 + x) * 0.8;
  });

  const color = isNight ? '#2a3142' : '#ffffff';
  
  return (
    <group ref={ref} position={[x, y, 0]} scale={scale}>
      <mesh>
        <planeGeometry args={[3, 1.5]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function Lightning() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const flash = Math.sin(t * 0.4) > 0.98 ? Math.random() * 5 : 0;
    ref.current.intensity = flash;
  });
  return <pointLight ref={ref} position={[0, 6, -9]} color="#d0e0ff" distance={30} intensity={0} />;
}
