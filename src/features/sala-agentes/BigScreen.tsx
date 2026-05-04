import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  position?: [number, number, number];
  rotation?: [number, number, number];
  busyCount: number;
  totalAgents: number;
}

/**
 * TV grande na parede mostrando um mini-dashboard ao vivo (gráfico + KPIs).
 * Usa Html para texto crisp, mas apoiada em uma moldura 3D.
 */
export function BigScreen({
  position = [0, 4, -8.9],
  rotation = [0, 0, 0],
  busyCount,
  totalAgents,
}: Props) {
  const screenRef = useRef<THREE.MeshStandardMaterial>(null);

  // Histórico de busyCount para desenhar um gráfico
  const historyRef = useRef<number[]>(Array(20).fill(0));
  const lastTickRef = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (screenRef.current) {
      screenRef.current.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.05;
    }
    if (t - lastTickRef.current > 1.5) {
      historyRef.current = [...historyRef.current.slice(1), busyCount];
      lastTickRef.current = t;
    }
  });

  const points = useMemo(() => historyRef.current, [busyCount]);
  const max = Math.max(totalAgents, 1);

  return (
    <group position={position} rotation={rotation}>
      {/* Moldura */}
      <mesh castShadow>
        <boxGeometry args={[5.5, 3.2, 0.15]} />
        <meshStandardMaterial color="#0a0f1c" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Tela */}
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[5.2, 2.9]} />
        <meshStandardMaterial
          ref={screenRef}
          color="#0d1b2a"
          emissive="#1f6feb"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Conteúdo HTML sobreposto (dashboard) */}
      <Html
        position={[0, 0, 0.12]}
        transform
        distanceFactor={3.5}
        occlude={false}
        style={{ width: '520px', height: '290px', pointerEvents: 'none' }}
      >
        <div className="h-full w-full rounded bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-3 font-mono text-white shadow-2xl ring-1 ring-blue-500/40">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-[11px] font-bold tracking-widest text-blue-300">
              ▣ ASTROS · LIVE OPS
            </span>
            <span className="text-[10px] text-emerald-300">● ON-AIR</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Kpi label="Agentes ativos" value={busyCount.toString()} accent="text-emerald-300" />
            <Kpi label="Total módulos" value={totalAgents.toString()} accent="text-blue-300" />
            <Kpi
              label="Taxa de uso"
              value={`${Math.round((busyCount / max) * 100)}%`}
              accent="text-amber-300"
            />
          </div>
          <div className="mt-2 rounded bg-black/40 p-1.5 ring-1 ring-white/5">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-400">
              Atividade nos últimos minutos
            </p>
            <Chart points={points} max={max} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400">
            <span>SLA: 99.97%</span>
            <span>Auto-refresh · 1.5s</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded bg-black/40 px-2 py-1 ring-1 ring-white/5">
      <p className="text-[8px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-lg font-extrabold leading-none ${accent}`}>{value}</p>
    </div>
  );
}

function Chart({ points, max }: { points: number[]; max: number }) {
  const W = 500;
  const H = 90;
  const step = W / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = H - (v / max) * (H - 8) - 4;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#lg)" />
      <path d={path} stroke="#60a5fa" strokeWidth="2" fill="none" />
    </svg>
  );
}
