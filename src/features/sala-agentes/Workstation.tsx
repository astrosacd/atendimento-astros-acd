import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_PALETTE } from './colors';
import type { AgentDef, AgentStatus } from './agents';
import { VoxelAgent } from './VoxelAgent';

const TYPING_LINES: Record<string, string[]> = {
  default: [
    '> SELECT * FROM clientes WHERE ativo=true;',
    '> processando lote #4821...',
    '> sync_baserow.run() OK',
    '> 12 registros atualizados',
    '> verificando cache...',
    '> webhook → n8n.dispatch()',
    '> AI.classify(lead) = quente',
    '> sending notification...',
    '> commit eb91f2 saved',
  ],
};

interface Props {
  agent: AgentDef;
  isBusy: boolean;
}

/**
 * Estação de trabalho: mesa + monitor + cadeira + agente + plaquinha.
 * Posicionada em [x, 0, z] no mundo. Agente fica na frente da mesa.
 */
export function Workstation({ agent, isBusy }: Props) {
  const screenRef = useRef<THREE.Mesh>(null);

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
      {/* Tela do código sendo "digitado" */}
      <Html
        position={[0, 1.2, -0.795]}
        transform
        distanceFactor={2.6}
        occlude={false}
        style={{ width: '210px', height: '125px', pointerEvents: 'none' }}
      >
        <TypingScreen seed={agent.id} active={isBusy} />
      </Html>
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

      {/* Agente removido daqui para permitir movimento livre na cena principal */}
    </group>
  );
}

function TypingScreen({ seed, active }: { seed: string; active: boolean }) {
  const lines = TYPING_LINES.default;
  // Pseudo-aleatório estável por agente
  const offset = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9999;
    return h;
  }, [seed]);
  const tickRef = useRef(0);
  const charRef = useRef(0);
  const lineIdxRef = useRef(0);
  const displayRef = useRef<HTMLDivElement>(null);
  const linesShownRef = useRef<string[]>([]);

  useFrame(({ clock }) => {
    if (!displayRef.current) return;
    const speed = active ? 0.04 : 0.12;
    const t = clock.getElapsedTime();
    if (t - tickRef.current < speed) return;
    tickRef.current = t;

    const currentLine = lines[(lineIdxRef.current + offset) % lines.length];
    charRef.current++;
    if (charRef.current > currentLine.length) {
      linesShownRef.current = [...linesShownRef.current, currentLine].slice(-6);
      charRef.current = 0;
      lineIdxRef.current++;
    }
    const partial = currentLine.slice(0, charRef.current);
    const html =
      linesShownRef.current.map((l) => `<div>${l}</div>`).join('') +
      `<div>${partial}<span class="text-emerald-400">▌</span></div>`;
    displayRef.current.innerHTML = html;
  });

  return (
    <div className="h-full w-full overflow-hidden rounded-sm bg-[#0a1428] p-1 font-mono text-[7px] leading-tight text-emerald-300 ring-1 ring-blue-500/30">
      <div className="mb-1 flex items-center gap-1 border-b border-white/10 pb-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="ml-1 text-[6px] text-slate-400">~/astros</span>
      </div>
      <div ref={displayRef} className="space-y-0.5" />
    </div>
  );
}

