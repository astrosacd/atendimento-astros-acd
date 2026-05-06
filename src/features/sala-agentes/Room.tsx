import { useEffect, useState } from 'react';
import { Html, Float, Text, Image } from '@react-three/drei';
import { ROOM_PALETTE } from './colors';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sala — chão, paredes, vigas e detalhes (plantas, janelas).
 * Tudo estático. Dimensões: 22 (x) x 18 (z), centro em 0,0.
 */
export function Room({ isNight, logoUrl }: { isNight?: boolean; logoUrl?: string | null }) {
  const W = 24;
  const D = 18;

  return (
    <group>
      {/* Chão Principal com Grid Tech */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={isNight ? '#0f172a' : '#f8fafc'} roughness={0.8} />
      </mesh>
      <gridHelper args={[W, 20, isNight ? '#1e293b' : '#e2e8f0', isNight ? '#0f172a' : '#f1f5f9']} position={[0, 0.01, 0]} />

      {/* Divisórias de Vidro (Salas) */}
      <group>
        {/* Comercial vs Smart */}
        <mesh position={[-4, 1.5, -2]}>
          <boxGeometry args={[0.1, 3, 12]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
        {/* Smart vs Administrativo */}
        <mesh position={[4, 1.5, -2]}>
          <boxGeometry args={[0.1, 3, 12]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
        {/* Fundo (Operacional) */}
        <mesh position={[0, 1.5, 4]}>
          <boxGeometry args={[W, 3, 0.1]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
      </group>

      {/* Rótulos das Salas */}
      <Html position={[-8, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          COMERCIAL
        </div>
      </Html>
      <Html position={[0, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          SMART IA
        </div>
      </Html>
      <Html position={[8, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          FINANCEIRO
        </div>
      </Html>
      <Html position={[0, 3.5, 6]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          OPERACIONAL
        </div>
      </Html>

      {/* Tapetes das Salas com bordas brilhantes */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.1} />
      </mesh>

      {/* Janelas com Céu Dinâmico */}
      {[-8, 0, 8].map((x) => (
        <group key={`win-group-${x}`} position={[x, 4, -D / 2 + 0.1]}>
          <mesh>
            <boxGeometry args={[4, 2.5, 0.1]} />
            <meshStandardMaterial 
              color={isNight ? '#0a192f' : '#87ceeb'} 
              emissive={isNight ? '#1a2c4e' : '#bae0ff'} 
              emissiveIntensity={isNight ? 1.2 : 0.4} 
            />
          </mesh>
          {/* Sol ou Lua na Janela */}
          <mesh position={[isNight ? -1 : 1, 0.5, 0.1]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={isNight ? '#fdfcf0' : '#ffcf33'} />
          </mesh>
          {isNight && (
            <group>
              {[...Array(5)].map((_, i) => (
                <mesh key={i} position={[Math.random() * 3 - 1.5, Math.random() * 1.5 - 0.75, 0.15]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshBasicMaterial color="white" />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}

      {/* Servidor Central (HUB de Integração) */}
      <group position={[0, 0, -2]}>
        <mesh castShadow position={[0, 0.8, 0]}>
          <boxGeometry args={[1.5, 1.6, 1.5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Luzes pulsantes no servidor */}
        {[...Array(12)].map((_, i) => (
          <mesh key={i} position={[0.76, 1.4 - i * 0.12, 0]}>
            <boxGeometry args={[0.02, 0.05, 0.6]} />
            <meshStandardMaterial 
              color={i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#10b981' : '#f59e0b'} 
              emissive={i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#10b981' : '#f59e0b'} 
              emissiveIntensity={2} 
            />
          </mesh>
        ))}
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <group position={[0, 2.8, 0]}>
            {logoUrl ? (
              <Image 
                url={logoUrl} 
                scale={[2, 0.8]} 
                transparent 
                toneMapped={false}
              />
            ) : (
              <>
                <mesh rotation={[0, 0, 0]}>
                  <boxGeometry args={[1.8, 0.6, 0.1]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
                </mesh>
                <Text
                  position={[0, 0, 0.06]}
                  fontSize={0.2}
                  color="#60a5fa"
                  anchorX="center"
                  anchorY="middle"
                >
                  ASTROS CRM
                </Text>
              </>
            )}
            <pointLight position={[0, -0.5, 0]} intensity={1} color="#60a5fa" distance={3} />
          </group>
        </Float>

        {/* Holograma central */}
        <mesh position={[0, 2, 0]}>
          <octahedronGeometry args={[0.4]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.6} emissive="#60a5fa" emissiveIntensity={2} wireframe />
        </mesh>
      </group>

      {/* Sala de Reunião (frontal) — mesa oval + cadeiras */}
      <group position={[0, 0, 7]}>
        {/* Tapete */}
        <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
          <planeGeometry args={[8, 4]} />
          <meshStandardMaterial color={isNight ? '#1e293b' : '#fef3c7'} transparent opacity={0.4} />
        </mesh>
        {/* Mesa oval */}
        <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
          <cylinderGeometry args={[1.6, 1.6, 0.12, 32]} />
          <meshStandardMaterial color="#7c4a2a" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.7, 12]} />
          <meshStandardMaterial color="#1f2937" metalness={0.8} />
        </mesh>
        {/* Cadeiras ao redor */}
        {[0, 60, 120, 180, 240, 300].map(deg => {
          const r = 2.2;
          const rad = (deg * Math.PI) / 180;
          return (
            <group key={deg} position={[Math.cos(rad)*r, 0, Math.sin(rad)*r]} rotation={[0, -rad + Math.PI/2, 0]}>
              <mesh castShadow position={[0, 0.5, 0]}>
                <boxGeometry args={[0.5, 0.1, 0.5]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              <mesh castShadow position={[0, 0.85, -0.2]}>
                <boxGeometry args={[0.5, 0.7, 0.1]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
            </group>
          );
        })}
        {/* Laptop sobre a mesa */}
        <mesh castShadow position={[0.6, 0.78, 0]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.35]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <Html position={[0, 2.5, 0]} center distanceFactor={14}>
          <div className="rounded bg-amber-500/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur whitespace-nowrap">
            🤝 SALA DE REUNIÃO
          </div>
        </Html>
      </group>

      {/* Plantas decorativas nos cantos */}
      {[[-11, -8], [11, -8], [-11, 8], [11, 8]].map(([x, z], i) => (
        <group key={`plant-${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 0.6, 12]} />
            <meshStandardMaterial color="#92400e" />
          </mesh>
          <mesh castShadow position={[0, 1, 0]}>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshStandardMaterial color="#15803d" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.2, 1.4, 0.1]}>
            <sphereGeometry args={[0.4, 10, 10]} />
            <meshStandardMaterial color="#22c55e" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* TVs nas paredes laterais — apenas a TV (moldura + tela viva) */}
      {[-1, 1].map(side => (
        <group key={`quadro-${side}`} position={[side * 11.9, 2.5, 0]} rotation={[0, side > 0 ? -Math.PI/2 : Math.PI/2, 0]}>
          {/* Moldura */}
          <mesh castShadow>
            <boxGeometry args={[2.8, 1.7, 0.08]} />
            <meshStandardMaterial color="#0a0f1c" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Tela base com brilho */}
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[2.6, 1.5]} />
            <meshStandardMaterial 
              color="#020617"
              emissive={side > 0 ? '#10b981' : '#3b82f6'}
              emissiveIntensity={isNight ? 0.55 : 0.35}
            />
          </mesh>
          {/* Conteúdo HTML ao vivo na TV */}
          <Html
            position={[0, 0, 0.05]}
            transform
            distanceFactor={3.2}
            occlude={false}
            style={{ width: '320px', height: '180px', pointerEvents: 'none' }}
          >
            <WallTvContent variant={side > 0 ? 'metrics' : 'logs'} />
          </Html>
        </group>
      ))}

      {/* Recepção / balcão na entrada */}
      <group position={[0, 0, 8.5]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[3, 1, 0.6]} />
          <meshStandardMaterial color="#1e40af" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[3.2, 0.1, 0.7]} />
          <meshStandardMaterial color="#fafafa" metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function WallTvContent({ variant }: { variant: 'metrics' | 'logs' }) {
  const [metrics, setMetrics] = useState({ clientes: 0, leads: 0, propostas: 0, mrr: 0 });
  const [logs, setLogs] = useState<{ msg: string; ts: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (variant === 'metrics') {
          const [c, p] = await Promise.all([
            supabase.from('clientes').select('id, valor_mensal', { count: 'exact', head: false }).limit(500),
            supabase.from('proposals').select('id', { count: 'exact', head: true }),
          ] as any);
          if (cancelled) return;
          const cs: any[] = (c as any).data ?? [];
          const mrr = cs.reduce((s, r) => s + (Number(r.valor_mensal) || 0), 0);
          setMetrics({
            clientes: (c as any).count ?? cs.length,
            leads: 0,
            propostas: (p as any).count ?? 0,
            mrr,
          });
        } else {
          const { data } = await supabase
            .from('system_activities')
            .select('description, created_at')
            .order('created_at', { ascending: false })
            .limit(8);
          if (cancelled) return;
          setLogs((data ?? []).map((r: any) => ({
            msg: String(r.description ?? '').slice(0, 60),
            ts: new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          })));
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [variant]);

  if (variant === 'metrics') {
    return (
      <div className="h-full w-full rounded bg-gradient-to-br from-slate-900 to-emerald-950 p-2 font-mono text-white ring-1 ring-emerald-500/40">
        <div className="flex items-center justify-between border-b border-white/10 pb-1">
          <span className="text-[10px] font-bold tracking-widest text-emerald-300">▣ CRM · MÉTRICAS</span>
          <span className="text-[8px] text-emerald-400">● LIVE</span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Tile label="Clientes" value={metrics.clientes.toString()} c="text-emerald-300" />
          <Tile label="Propostas" value={metrics.propostas.toString()} c="text-amber-300" />
          <Tile label="MRR (R$)" value={metrics.mrr.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} c="text-fuchsia-300" />
          <Tile label="Online" value={'24/7'} c="text-blue-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded bg-[#020617] p-2 font-mono text-emerald-300 ring-1 ring-blue-500/40">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="text-[10px] font-bold tracking-widest text-blue-300">▣ SYS · LOGS</span>
        <span className="text-[8px] text-emerald-400">● LIVE</span>
      </div>
      <div className="mt-1 space-y-0.5 text-[8px] leading-tight">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic">aguardando eventos...</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="truncate">
              <span className="text-slate-500">{l.ts}</span>{' '}
              <span className="text-emerald-300">›</span> {l.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, c }: { label: string; value: string; c: string }) {
  return (
    <div className="rounded bg-black/40 px-1.5 py-1 ring-1 ring-white/5">
      <p className="text-[7px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-base font-extrabold leading-none ${c}`}>{value}</p>
    </div>
  );
}
