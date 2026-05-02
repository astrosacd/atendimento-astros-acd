import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_PALETTE } from './colors';
import type { AgentDef, AgentStatus } from './agents';
import { VoxelAgent } from './VoxelAgent';

interface Props {
  agent: AgentDef;
  status: AgentStatus;
  message?: string;
  onSelect?: (agent: AgentDef) => void;
}

/**
 * Estação de trabalho: mesa + monitor + cadeira + agente + plaquinha.
 * Posicionada em [x, 0, z] no mundo. Agente fica na frente da mesa.
 */
export function Workstation({ agent, status, message, onSelect }: Props) {
  const screenRef = useRef<THREE.Mesh>(null);
  const isBusy = status !== 'idle';

  useFrame(({ clock }) => {
    if (screenRef.current && isBusy) {
      // pisca suave da tela quando trabalhando
      const m = screenRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.4 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
    } else if (screenRef.current) {
      const m = screenRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.15;
    }
  });

  // Mesa virada para o centro (sul) — agente fica entre câmera e mesa
  return (
    <group position={[agent.position[0], 0, agent.position[1]]}>
      {/* Mesa (tampo + 2 pés) */}
      <mesh castShadow receiveShadow position={[0, 0.7, -0.6]}>
        <boxGeometry args={[1.6, 0.08, 0.7]} />
        <meshStandardMaterial color={ROOM_PALETTE.deskTop} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-0.65, 0.35, -0.6]}>
        <boxGeometry args={[0.08, 0.7, 0.6]} />
        <meshStandardMaterial color={ROOM_PALETTE.desk} />
      </mesh>
      <mesh castShadow position={[0.65, 0.35, -0.6]}>
        <boxGeometry args={[0.08, 0.7, 0.6]} />
        <meshStandardMaterial color={ROOM_PALETTE.desk} />
      </mesh>

      {/* Monitor */}
      <mesh castShadow position={[0, 1.2, -0.85]}>
        <boxGeometry args={[0.9, 0.55, 0.05]} />
        <meshStandardMaterial color={ROOM_PALETTE.monitor} />
      </mesh>
      <mesh ref={screenRef} position={[0, 1.2, -0.82]}>
        <boxGeometry args={[0.82, 0.48, 0.02]} />
        <meshStandardMaterial
          color={ROOM_PALETTE.monitorScreen}
          emissive={ROOM_PALETTE.monitorScreen}
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, 0.85, -0.85]}>
        <boxGeometry args={[0.1, 0.15, 0.05]} />
        <meshStandardMaterial color={ROOM_PALETTE.monitor} />
      </mesh>

      {/* Holograma flutuante (só quando ocupado) */}
      {isBusy && (
        <mesh position={[0, 1.85, -0.6]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.55, 0.35, 0.02]} />
          <meshStandardMaterial
            color={ROOM_PALETTE.hologram}
            emissive={ROOM_PALETTE.hologram}
            emissiveIntensity={0.6}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}

      {/* Cadeira (atrás do agente) */}
      <mesh castShadow position={[0, 0.45, 0.2]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color={ROOM_PALETTE.chair} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0.4]}>
        <boxGeometry args={[0.5, 0.7, 0.08]} />
        <meshStandardMaterial color={ROOM_PALETTE.chair} />
      </mesh>

      {/* Plaquinha do módulo (em cima da mesa) */}
      <Html
        position={[0, 1.65, -0.85]}
        center
        distanceFactor={9}
        occlude={false}
      >
        <div className="pointer-events-none rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-800 shadow-md ring-1 ring-slate-300">
          {agent.module}
        </div>
      </Html>

      {/* Agente */}
      <VoxelAgent
        agent={agent}
        status={status}
        message={message}
        onClick={() => onSelect?.(agent)}
      />
    </group>
  );
}
