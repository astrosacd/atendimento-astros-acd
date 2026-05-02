import { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Activity, Sparkles, X, ExternalLink } from 'lucide-react';
import { AGENTS, type AgentDef } from './agents';
import { Room } from './Room';
import { Workstation } from './Workstation';
import { useAgentRoomEvents } from './useAgentRoomEvents';
import { AGENT_HEX, STATUS_HEX } from './colors';

function StatusDot({ status }: { status: keyof typeof STATUS_HEX }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: STATUS_HEX[status] }}
    />
  );
}

export function SalaAgentesScene() {
  const navigate = useNavigate();
  const { runtime, history } = useAgentRoomEvents();
  const [selected, setSelected] = useState<AgentDef | null>(null);

  const busyCount = useMemo(
    () => Object.values(runtime).filter(s => s.status !== 'idle').length,
    [runtime],
  );

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#f5ecd9] to-[#e6d8be]">
      {/* Canvas 3D */}
      <Canvas
        shadows
        camera={{ position: [14, 13, 14], fov: 38 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#f5ecd9']} />
        <fog attach="fog" args={['#f5ecd9', 28, 55]} />

        {/* Iluminação aconchegante */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[10, 18, 10]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <pointLight position={[0, 5, 0]} intensity={0.4} color="#ffd9a8" />
        <pointLight position={[-8, 4, -8]} intensity={0.3} color="#a8c8ff" />

        <Suspense fallback={null}>
          <Room />
          {AGENTS.map((agent) => {
            const st = runtime[agent.id];
            return (
              <Workstation
                key={agent.id}
                agent={agent}
                status={st?.status || 'idle'}
                message={st?.message}
                onSelect={setSelected}
              />
            );
          })}
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.35}
            scale={28}
            blur={2.4}
            far={6}
          />
        </Suspense>

        <OrbitControls
          enablePan
          minDistance={8}
          maxDistance={28}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1, 0]}
        />
      </Canvas>

      {/* HUD topo-esquerda — título + métricas */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-md">
        <div className="pointer-events-auto rounded-xl bg-white/85 p-3 backdrop-blur shadow-lg ring-1 ring-slate-200">
          <h1 className="font-display text-xl font-extrabold text-slate-900">
            Sala dos Agentes
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Visão ao vivo dos módulos do CRM trabalhando.
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Activity className="mr-1 h-3 w-3" /> {busyCount} ativos
            </Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
              <Sparkles className="mr-1 h-3 w-3" /> {AGENTS.length} agentes
            </Badge>
          </div>
        </div>
      </div>

      {/* Legenda topo-direita */}
      <div className="pointer-events-none absolute right-4 top-4">
        <div className="pointer-events-auto rounded-xl bg-white/85 p-3 backdrop-blur shadow-lg ring-1 ring-slate-200">
          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Status
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
            <li className="flex items-center gap-2"><StatusDot status="idle" /> Ocioso</li>
            <li className="flex items-center gap-2"><StatusDot status="working" /> Trabalhando</li>
            <li className="flex items-center gap-2"><StatusDot status="thinking" /> Pensando</li>
            <li className="flex items-center gap-2"><StatusDot status="talking" /> Comunicando</li>
            <li className="flex items-center gap-2"><StatusDot status="error" /> Erro</li>
          </ul>
        </div>
      </div>

      {/* Histórico ao vivo (rodapé direito) */}
      <div className="pointer-events-none absolute bottom-4 right-4 w-80">
        <Card className="pointer-events-auto bg-white/90 backdrop-blur shadow-xl ring-1 ring-slate-200 border-0">
          <div className="border-b border-slate-200 px-3 py-2">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Atividades em tempo real
            </h3>
          </div>
          <ScrollArea className="h-56">
            <div className="p-2">
              {history.length === 0 ? (
                <div className="flex h-40 items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando eventos...
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((evt) => {
                    const a = AGENTS.find(x => x.id === evt.agentId);
                    if (!a) return null;
                    return (
                      <li key={evt.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-slate-100">
                        <span
                          className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: AGENT_HEX[a.color] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            <span style={{ color: STATUS_HEX[evt.status] }}>{a.name}</span>{' '}
                            <span className="text-slate-500 font-normal">· {a.module}</span>
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">{evt.message}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(evt.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Painel de detalhe do agente clicado */}
      {selected && (
        <div className="pointer-events-none absolute bottom-4 left-4 w-72">
          <Card className="pointer-events-auto bg-white/95 backdrop-blur shadow-xl ring-1 ring-slate-200 border-0">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-slate-900">
                  {selected.name}
                </p>
                <p className="text-[11px] text-slate-500">{selected.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Status</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <StatusDot status={runtime[selected.id]?.status || 'idle'} />
                  {(runtime[selected.id]?.status || 'idle').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Módulo</span>
                <span className="text-xs font-semibold text-slate-800">{selected.module}</span>
              </div>
              {runtime[selected.id]?.message && (
                <div className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] text-slate-700">
                  {runtime[selected.id]?.message}
                </div>
              )}
              {selected.route && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(selected.route!)}
                >
                  Abrir módulo
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Dica de interação */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-medium text-white backdrop-blur">
          Arraste para girar · scroll para zoom · clique no agente para ver detalhes
        </div>
      </div>
    </div>
  );
}
