import { useEffect, useState, useRef } from 'react';
import { Html, Float, Text, Image, useHelper } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_PALETTE } from './colors';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sala — chão, paredes, vigas e detalhes (plantas, janelas).
 * Reformulada para um visual mais realista e empresarial.
 */
export function Room({ isNight, logoUrl }: { isNight?: boolean; logoUrl?: string | null }) {
  const W = 40;
  const D = 28;
  const ceilingHeight = 6;

  return (
    <group>
      {/* --- CHÃO PREMIUM --- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial 
          color={isNight ? '#0a101f' : '#f0f4f8'} 
          roughness={0.4} 
          metalness={0.1}
        />
      </mesh>
      
      {/* Grid discreto (apenas para senso de escala) */}
      <gridHelper 
        args={[W, 40, isNight ? '#1e293b' : '#cbd5e1', isNight ? '#0f172a' : '#f1f5f9']} 
        position={[0, 0.01, 0]} 
      />

      {/* --- TETO COM PAINÉIS LED --- */}
      <group position={[0, ceilingHeight, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, D]} />
          <meshStandardMaterial color={isNight ? '#0f172a' : '#ffffff'} />
        </mesh>
        
        {/* Vigas Estruturais */}
        {[-16, -12, -8, -4, 0, 4, 8, 12, 16].map(x => (
          <mesh key={`beam-v-${x}`} position={[x, -0.1, 0]}>
            <boxGeometry args={[0.2, 0.2, D]} />
            <meshStandardMaterial color={isNight ? '#1e293b' : '#e2e8f0'} />
          </mesh>
        ))}
        {[-10, -5, 0, 5, 10].map(z => (
          <mesh key={`beam-h-${z}`} position={[0, -0.1, z]}>
            <boxGeometry args={[W, 0.2, 0.2]} />
            <meshStandardMaterial color={isNight ? '#1e293b' : '#e2e8f0'} />
          </mesh>
        ))}

        {/* Painéis de Luz LED Embutidos (emissivos, sem rectAreaLight pra perf) */}
        {[-12, -6, 0, 6, 12].map(x => [-7, 0, 7].map(z => (
          <mesh key={`light-${x}-${z}`} position={[x, -0.05, z]}>
            <boxGeometry args={[2, 0.05, 1]} />
            <meshStandardMaterial 
              color="#ffffff" 
              emissive="#ffffff" 
              emissiveIntensity={isNight ? 0.6 : 1.2} 
            />
          </mesh>
        )))}
      </group>

      {/* --- PAREDES --- */}
      <group>
        {/* Parede Fundo (com janelas) */}
        <mesh position={[0, 2.5, -D/2]}>
          <boxGeometry args={[W, 5, 0.2]} />
          <meshStandardMaterial color={isNight ? '#0f172a' : '#cbd5e1'} />
        </mesh>
        {/* Parede Lateral Direita */}
        <mesh position={[W/2, 2.5, 0]}>
          <boxGeometry args={[0.2, 5, D]} />
          <meshStandardMaterial color={isNight ? '#0f172a' : '#cbd5e1'} />
        </mesh>
        {/* Parede Lateral Esquerda */}
        <mesh position={[-W/2, 2.5, 0]}>
          <boxGeometry args={[0.2, 5, D]} />
          <meshStandardMaterial color={isNight ? '#0f172a' : '#cbd5e1'} />
        </mesh>
      </group>

      {/* --- DIVISÓRIAS DE VIDRO CORPORATIVAS (4 departamentos) --- */}
      <group>
        {[-5, 5].map(x => (
          <group key={`glass-${x}`} position={[x, 1.5, -3]}>
            <mesh>
              <boxGeometry args={[0.05, 3, 14]} />
              <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.15} transmission={0.9} thickness={0.1} roughness={0} />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[0.1, 0.1, 14]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </group>
        ))}
        {/* Vidro Fundo (separa operacional) */}
        <group position={[0, 1.5, 3]}>
          <mesh>
            <boxGeometry args={[W, 3, 0.05]} />
            <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.1} transmission={0.9} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[W, 0.1, 0.1]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      </group>

      {/* Rótulos das Salas */}
      <Html position={[-11, 4.5, -10]} center distanceFactor={14}>
        <div className="rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
          DEPT. COMERCIAL
        </div>
      </Html>
      <Html position={[0, 4.5, -10]} center distanceFactor={14}>
        <div className="rounded-full bg-blue-600/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
          CENTRO SMART IA
        </div>
      </Html>
      <Html position={[11, 4.5, -10]} center distanceFactor={14}>
        <div className="rounded-full bg-emerald-600/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
          FINANCEIRO
        </div>
      </Html>
      <Html position={[0, 4.5, 9]} center distanceFactor={14}>
        <div className="rounded-full bg-orange-600/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
          OPERAÇÕES & SUPORTE
        </div>
      </Html>

      {/* --- JANELAS PANORÂMICAS --- */}
      {[-15, -7.5, 0, 7.5, 15].map((x) => (
        <group key={`window-${x}`} position={[x, 3.2, -D / 2 + 0.11]}>
          <mesh>
            <boxGeometry args={[5, 3.2, 0.02]} />
            <meshPhysicalMaterial color="#bae0ff" transparent opacity={0.2} transmission={0.8} />
          </mesh>
          <mesh>
            <boxGeometry args={[5.2, 3.4, 0.1]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[5, 3.2, 0.05]} />
            <meshStandardMaterial color="#0f172a" wireframe />
          </mesh>
        </group>
      ))}

      {/* --- SERVIDOR CENTRAL (HUB DE DADOS) --- */}
      <group position={[0, 0, -11]}>
        <mesh castShadow position={[0, 0.9, 0]}>
          <boxGeometry args={[1.6, 1.8, 1.6]} />
          <meshPhysicalMaterial 
            color="#020617" 
            roughness={0.05} 
            metalness={0.95} 
            emissive="#1e3a8a" 
            emissiveIntensity={0.1}
          />
        </mesh>
        {/* Luzes de Atividade */}
        {[...Array(15)].map((_, i) => (
          <mesh key={i} position={[0.81, 1.6 - i * 0.1, 0.2]}>
            <boxGeometry args={[0.02, 0.04, 0.8]} />
            <meshStandardMaterial 
              color={Math.random() > 0.5 ? '#60a5fa' : '#34d399'} 
              emissive={Math.random() > 0.5 ? '#60a5fa' : '#34d399'} 
              emissiveIntensity={2} 
            />
          </mesh>
        ))}
        
        <Float speed={2.5} rotationIntensity={0.4} floatIntensity={0.6}>
          <group position={[0, 3.2, 0]}>
            {logoUrl ? (
              <Image url={logoUrl} scale={[2.4, 1]} transparent toneMapped={false} />
            ) : (
              <Text fontSize={0.25} color="#60a5fa" font="/fonts/Inter-Bold.woff">
                ASTROS CRM
              </Text>
            )}
            <pointLight position={[0, -0.5, 0]} intensity={1.5} color="#3b82f6" distance={4} />
          </group>
        </Float>

        {/* Holograma Core */}
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshStandardMaterial 
            color="#60a5fa" 
            transparent 
            opacity={0.3} 
            emissive="#60a5fa" 
            emissiveIntensity={3} 
            wireframe 
          />
        </mesh>
      </group>

      {/* --- SALA DE REUNIÃO EXECUTIVA --- */}
      <group position={[0, 0, 10]}>
        {/* Tapete de Luxo */}
        <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[10, 5]} />
          <meshStandardMaterial color={isNight ? '#0f172a' : '#f1f5f9'} />
        </mesh>
        {/* Mesa de Vidro/Mármore */}
        <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
          <cylinderGeometry args={[2, 1.8, 0.1, 48]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.1} 
            transmission={0.6} 
            thickness={0.5} 
          />
        </mesh>
        {/* Base da Mesa */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.8, 1, 0.7, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {/* Cadeiras Office Pro */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const r = 2.8;
          const rad = (deg * Math.PI) / 180;
          return (
            <group key={deg} position={[Math.cos(rad)*r, 0, Math.sin(rad)*r]} rotation={[0, -rad + Math.PI/2, 0]}>
              <mesh castShadow position={[0, 0.5, 0]}>
                <boxGeometry args={[0.6, 0.1, 0.6]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
              </mesh>
              <mesh castShadow position={[0, 1, -0.25]}>
                <boxGeometry args={[0.6, 1, 0.1]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.5]} />
                <meshStandardMaterial color="#444" metalness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* --- PAISAGISMO CORPORATIVO --- */}
      {[[-18, -12], [18, -12], [-18, 12], [18, 12], [-18, 0], [18, 0]].map(([x, z], i) => (
        <group key={`plant-${i}`} position={[x, 0, z]}>
          {/* Vaso Moderno */}
          <mesh castShadow position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.5, 0.4, 0.8, 24]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} />
          </mesh>
          {/* Folhagens (várias camadas) */}
          <group position={[0, 0.8, 0]}>
            {[1.2, 1.8, 2.4].map((h, j) => (
              <mesh key={j} position={[0, h/3, 0]} rotation={[0, j * 0.5, 0]}>
                <coneGeometry args={[0.7 - j*0.15, h, 8]} />
                <meshStandardMaterial color={j === 0 ? "#14532d" : "#166534"} roughness={0.8} />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* --- TVS LATERAIS (DASHBOARDS) --- */}
      {[-1, 1].map(side => (
        <group key={`tv-${side}`} position={[side * (W/2 - 0.15), 2.8, 0]} rotation={[0, side > 0 ? -Math.PI/2 : Math.PI/2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[4, 2.2, 0.1]} />
            <meshStandardMaterial color="#000000" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <planeGeometry args={[3.8, 2]} />
            <meshStandardMaterial color="#020617" emissive={side > 0 ? '#10b981' : '#3b82f6'} emissiveIntensity={0.2} />
          </mesh>
          <Html
            position={[0, 0, 0.07]}
            transform
            distanceFactor={4}
            style={{ width: '400px', height: '220px', pointerEvents: 'none' }}
          >
            <WallTvContent variant={side > 0 ? 'metrics' : 'logs'} />
          </Html>
        </group>
      ))}

      {/* --- RECEPÇÃO / BALCÃO (frente) --- */}
      <group position={[0, 0, 13]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[5, 1.1, 0.8]} />
          <meshPhysicalMaterial color="#1e3a8a" roughness={0.1} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[5.2, 0.08, 0.9]} />
          <meshPhysicalMaterial color="#ffffff" metalness={0.5} roughness={0.1} />
        </mesh>
        <pointLight position={[0, 1.5, 0]} intensity={1} color="#ffffff" distance={4} />
      </group>

      {/* --- JARDIM INTERNO + BANCOS (centro entre depto e operações) --- */}
      <group position={[0, 0, 1.5]}>
        {/* Tapete circular verde */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[2.5, 32]} />
          <meshStandardMaterial color={isNight ? '#022c22' : '#86efac'} roughness={0.9} />
        </mesh>
        {/* Árvore central */}
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 1.2, 12]} />
          <meshStandardMaterial color="#7c5a3a" roughness={0.9} />
        </mesh>
        {[1.4, 2.0, 2.6].map((h, i) => (
          <mesh key={i} castShadow position={[0, 1 + h/3, 0]} rotation={[0, i * 0.7, 0]}>
            <coneGeometry args={[1.1 - i*0.2, h, 10]} />
            <meshStandardMaterial color={i === 0 ? '#15803d' : '#16a34a'} roughness={0.85} />
          </mesh>
        ))}
        {/* Bancos ao redor */}
        {[0, 90, 180, 270].map(deg => {
          const rad = (deg * Math.PI) / 180;
          const r = 2.0;
          return (
            <group key={deg} position={[Math.cos(rad)*r, 0, Math.sin(rad)*r]} rotation={[0, -rad, 0]}>
              <mesh castShadow position={[0, 0.3, 0]}>
                <boxGeometry args={[1.2, 0.1, 0.4]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <mesh position={[-0.55, 0.15, 0]}>
                <boxGeometry args={[0.1, 0.3, 0.4]} />
                <meshStandardMaterial color="#475569" metalness={0.7} />
              </mesh>
              <mesh position={[0.55, 0.15, 0]}>
                <boxGeometry args={[0.1, 0.3, 0.4]} />
                <meshStandardMaterial color="#475569" metalness={0.7} />
              </mesh>
            </group>
          );
        })}
        <Html position={[0, 4, 0]} center distanceFactor={16}>
          <div className="rounded-full bg-emerald-700/90 px-3 py-1 text-[9px] font-bold text-white border border-white/20 shadow-lg">
            🌿 PRAÇA CENTRAL
          </div>
        </Html>
      </group>

      {/* --- SALA DE SERVIDORES (rack farm canto fundo esquerdo) --- */}
      <group position={[-17, 0, -10]}>
        {[0, 1, 2].map(i => (
          <group key={i} position={[i * 0.9, 0, 0]}>
            <mesh castShadow position={[0, 1.1, 0]}>
              <boxGeometry args={[0.7, 2.2, 0.7]} />
              <meshPhysicalMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
            </mesh>
            {[...Array(8)].map((_, k) => (
              <mesh key={k} position={[0, 1.9 - k*0.22, 0.36]}>
                <boxGeometry args={[0.6, 0.06, 0.02]} />
                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={Math.random() > 0.5 ? 1.2 : 0.3} />
              </mesh>
            ))}
          </group>
        ))}
        <Html position={[1, 3, 0]} center distanceFactor={14}>
          <div className="rounded-full bg-cyan-700/90 px-3 py-1 text-[9px] font-bold text-white border border-white/20">
            DATA CENTER
          </div>
        </Html>
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
        if (cancelled) return;
        if (variant === 'metrics') {
          const { data: c, count: cc } = await supabase.from('clientes').select('valor', { count: 'exact' });
          const { count: pc } = await supabase.from('proposals').select('*', { count: 'exact', head: true });
          
          const mrr = (c || []).reduce((s, r) => s + (Number(r.valor) || 0), 0);
          setMetrics({ clientes: cc || 0, leads: 0, propostas: pc || 0, mrr });
        } else {
          const { data } = await supabase
            .from('system_activities')
            .select('description, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
          setLogs((data || []).map((r: any) => ({
            msg: String(r.description || '').slice(0, 50),
            ts: new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [variant]);

  return (
    <div className={`h-full w-full rounded p-3 font-mono text-white ${variant === 'metrics' ? 'bg-gradient-to-br from-slate-900 to-blue-950' : 'bg-black'} border border-white/10 shadow-2xl`}>
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <span className="text-xs font-black tracking-widest opacity-80">{variant === 'metrics' ? 'DATA·CENTER' : 'SYSTEM·MONITOR'}</span>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold">LIVE</span>
        </div>
      </div>
      
      {variant === 'metrics' ? (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="CLIENTES" val={metrics.clientes} color="text-blue-400" />
          <Stat label="PROPOSTAS" val={metrics.propostas} color="text-emerald-400" />
          <Stat label="MRR ESTIMADO" val={`R$ ${metrics.mrr.toLocaleString('pt-BR')}`} color="text-amber-400" full />
        </div>
      ) : (
        <div className="space-y-1 text-[9px]">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2 opacity-90 border-l border-blue-500/30 pl-2">
              <span className="text-slate-500">{l.ts}</span>
              <span className="truncate">{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, val, color, full }: any) {
  return (
    <div className={`bg-white/5 p-2 rounded border border-white/5 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[8px] opacity-50 font-bold">{label}</div>
      <div className={`text-xl font-black ${color}`}>{val}</div>
    </div>
  );
}

