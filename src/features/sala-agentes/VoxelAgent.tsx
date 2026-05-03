import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AGENT_HEX, STATUS_HEX } from './colors';
import type { AgentDef } from './agents';
import type { AgentStatus } from './agents';

interface Props {
  agent: AgentDef;
  status: AgentStatus;
  position: [number, number]; // [x, z]
  message?: string;
  onClick?: () => void;
}

/**
 * Bonequinho voxel cúbico — composto por cabeça, tronco, braços e pernas.
 * Anima sutilmente quando idle (respiração) e mais intensamente quando working/talking.
 */
export function VoxelAgent({ agent, status, position, message, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const bodyColor = AGENT_HEX[agent.color];
  const statusColor = STATUS_HEX[status];
  const isBusy = status !== 'idle';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Suaviza a posição X e Z (movimento)
      const prevX = groupRef.current.position.x;
      const prevZ = groupRef.current.position.z;
      
      groupRef.current.position.x = THREE.MathUtils.lerp(prevX, position[0], 0.05);
      groupRef.current.position.z = THREE.MathUtils.lerp(prevZ, position[1], 0.05);

      // Distância percorrida neste frame para animar as pernas
      const deltaX = position[0] - groupRef.current.position.x;
      const deltaZ = position[1] - groupRef.current.position.z;
      const moveDist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      const isMoving = moveDist > 0.01;

      // Respiração leve sempre, mais intensa quando trabalhando
      const breath = Math.sin(t * (isBusy ? 4 : 1.5)) * (isBusy ? 0.04 : 0.015);
      
      // Se estiver andando, dá um "pulo" leve
      const walkJump = isMoving ? Math.abs(Math.sin(t * 10)) * 0.15 : 0;
      groupRef.current.position.y = 0.5 + breath + walkJump;

      if (isMoving) {
        // Rotaciona para olhar para onde está indo
        const targetRotation = Math.atan2(deltaX, deltaZ);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.1);
      } else {
        // Volta para a rotação padrão (olhando para o centro [0,0])
        const lookAtCenter = Math.atan2(-groupRef.current.position.x, -groupRef.current.position.z);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, lookAtCenter, 0.05);
      }
    }

    // Animação das pernas se estiver andando
    const isMoving = groupRef.current ? Math.sqrt(
      Math.pow(position[0] - groupRef.current.position.x, 2) + 
      Math.pow(position[1] - groupRef.current.position.z, 2)
    ) > 0.01 : false;

    if (isMoving && leftArmRef.current && rightArmRef.current) {
      const swing = Math.sin(t * 12) * 0.5;
      leftArmRef.current.rotation.x = swing;
      rightArmRef.current.rotation.x = -swing;
    } else if ((status === 'working' || status === 'talking') && leftArmRef.current && rightArmRef.current) {
      const swing = Math.sin(t * 6) * 0.6;
      leftArmRef.current.rotation.x = swing;
      rightArmRef.current.rotation.x = -swing;
    } else {
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, 0.1);
      if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
    }

    if (headRef.current && status === 'thinking') {
      headRef.current.rotation.y = Math.sin(t * 2) * 0.3;
    }
    if (haloRef.current && isBusy) {
      haloRef.current.rotation.y = t * 1.5;
      const s = 1 + Math.sin(t * 4) * 0.08;
      haloRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0.5, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      {/* Tronco */}
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.35]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
      {/* Cabeça */}
      <mesh ref={headRef} castShadow position={[0, 1.0, 0]}>
        <boxGeometry args={[0.48, 0.45, 0.45]} />
        <meshStandardMaterial color="#f1d2b0" roughness={0.6} />
      </mesh>
      {/* Olhos */}
      <mesh position={[-0.1, 1.05, 0.23]}>
        <boxGeometry args={[0.07, 0.07, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.1, 1.05, 0.23]}>
        <boxGeometry args={[0.07, 0.07, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Braços */}
      <mesh ref={leftArmRef} castShadow position={[-0.36, 0.55, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.18]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[0.36, 0.55, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.18]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
      {/* Pernas */}
      <mesh castShadow position={[-0.13, 0.05, 0]}>
        <boxGeometry args={[0.2, 0.4, 0.2]} />
        <meshStandardMaterial color="#2c3340" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.13, 0.05, 0]}>
        <boxGeometry args={[0.2, 0.4, 0.2]} />
        <meshStandardMaterial color="#2c3340" roughness={0.7} />
      </mesh>

      {/* Halo de status sob os pés */}
      <mesh ref={haloRef} position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.55, 24]} />
        <meshBasicMaterial color={statusColor} transparent opacity={isBusy ? 0.9 : 0.35} />
      </mesh>

      {/* Indicador acima da cabeça */}
      {isBusy && (
        <mesh position={[0, 1.55, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      )}

      {/* Balão de fala — só renderiza se houver mensagem ativa */}
      {isBusy && message && (
        <Html position={[0, 1.95, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
          <div
            className="pointer-events-none whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg"
            style={{ background: statusColor }}
          >
            {message}
          </div>
        </Html>
      )}
    </group>
  );
}
