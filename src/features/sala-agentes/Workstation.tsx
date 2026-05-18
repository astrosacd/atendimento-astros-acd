import { useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_PALETTE } from './colors';
import type { AgentDef } from './agents';

interface Props {
  agent: AgentDef;
  isBusy: boolean;
}

/**
 * Estação de trabalho: mesa + monitor + cadeira + plaquinha.
 * Performance: removido <Html transform> do terminal (custava muito DOM-in-canvas)
 * e removido useFrame por estação. Tela só com emissive estático.
 */
export function Workstation({ agent, isBusy }: Props) {
  return (
    <group position={[agent.position[0], 0, agent.position[1]]}>
      {/* Mesa */}
      <mesh position={[0, 0.72, -0.6]}>
        <boxGeometry args={[1.7, 0.08, 0.8]} />
        <meshStandardMaterial 
          color="#1e293b" 
          roughness={0.3} 
          metalness={0.4} 
        />
      </mesh>
      
      {/* Pés da mesa */}
      <mesh position={[-0.75, 0.36, -0.6]}>
        <boxGeometry args={[0.06, 0.72, 0.7]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.75, 0.36, -0.6]}>
        <boxGeometry args={[0.06, 0.72, 0.7]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Monitor (moldura) */}
      <mesh position={[0, 1.25, -0.9]}>
        <boxGeometry args={[1.1, 0.5, 0.04]} />
        <meshStandardMaterial color="#000000" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tela com brilho fixo (sem useFrame) - cor muda quando ativo */}
      <mesh position={[0, 1.25, -0.87]}>
        <boxGeometry args={[1.05, 0.45, 0.02]} />
        <meshStandardMaterial
          color={isBusy ? '#0f3460' : ROOM_PALETTE.monitorScreen}
          emissive={isBusy ? '#3b82f6' : ROOM_PALETTE.monitorScreen}
          emissiveIntensity={isBusy ? 0.55 : 0.2}
        />
      </mesh>

      {/* Suporte do Monitor */}
      <mesh position={[0, 0.88, -0.9]}>
        <cylinderGeometry args={[0.03, 0.04, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>

      {/* Cadeira */}
      <group position={[0, 0, 0.3]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.55, 0.1, 0.55]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1, 0.25]}>
          <boxGeometry args={[0.55, 0.9, 0.1]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.5]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
      </group>

      {/* Plaquinha do módulo (Html center é leve, sem transform) */}
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
    </group>
  );
}
