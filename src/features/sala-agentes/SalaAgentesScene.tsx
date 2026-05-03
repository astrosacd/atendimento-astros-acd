import { Suspense, useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, Activity, Sparkles, X, ExternalLink, 
  Share2, ChevronDown, ChevronUp, Clock, Sun, Moon 
} from 'lucide-react';
import { AGENTS, type AgentDef } from './agents';
import { Room } from './Room';
import { Workstation } from './Workstation';
import { VoxelAgent } from './VoxelAgent';
import { useAgentRoomEvents } from './useAgentRoomEvents';
import { AGENT_HEX, STATUS_HEX } from './colors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [showHistory, setShowHistory] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [showHUD, setShowHUD] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareExpiration, setShareExpiration] = useState('24h');

  useEffect(() => {
    // Monitor de eventos falsos para quando não há atividade real
    const demoTimer = setInterval(() => {
      const busyCount = Object.values(runtime).filter(s => s.status !== 'idle').length;
      if (busyCount < 4) { // Garante que sempre tenha gente fazendo algo
        const idleAgents = AGENTS.filter(a => runtime[a.id]?.status === 'idle');
        if (idleAgents.length > 0) {
          const pick = idleAgents[Math.floor(Math.random() * idleAgents.length)];
          const actions = [
            'Otimizando cache...', 
            'Indexando dados', 
            'Análise preventiva', 
            'Sincronizando logs',
            'Verificando segurança',
            'Limpando temporários'
          ];
          // Use dispatchEvent do hook via uma referência ou chamando diretamente se possível
          // Mas aqui vamos apenas deixar o demo do hook agir
        }
      }
    }, 8000);

    const hourTimer = setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => {
      clearInterval(demoTimer);
      clearInterval(hourTimer);
    };
  }, [runtime]);

  const busyCount = useMemo(
    () => Object.values(runtime).filter(s => s.status !== 'idle').length,
    [runtime],
  );

  const isNight = currentHour < 6 || currentHour >= 18;

  const handleShare = async () => {
    setIsGeneratingLink(true);
    try {
      const token = Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      
      const hours = {
        '1h': 1,
        '2h': 2,
        '24h': 24,
        '2d': 48,
        '10d': 240
      }[shareExpiration] || 24;

      expiresAt.setHours(expiresAt.getHours() + hours);

      const { error } = await supabase.from('shared_access_tokens').insert({
        token,
        target_url: '/public/sala-agentes',
        expires_at: expiresAt.toISOString()
      });

      if (error) throw error;

      // Detecta se estamos no domínio lovable.app ou similar para construir a URL correta
      const currentUrl = window.location.href;
      const isLovableDev = currentUrl.includes('lovable.dev') || currentUrl.includes('lovable.app');
      
      let baseUrl = window.location.origin;
      
      // Ajuste crucial: Se estivermos no preview do Lovable, precisamos usar o domínio do Lovable app
      // mas garantindo que o link seja /public/...
      const url = `${baseUrl}/public/sala-agentes?token=${token}`;
      
      await navigator.clipboard.writeText(url);
      toast.success(`Link (${shareExpiration}) copiado com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar link de compartilhamento');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  return (
    <div className={`relative h-[calc(100vh-4rem)] w-full overflow-hidden rounded-xl transition-colors duration-1000 ${
      isNight ? 'bg-[#1a1c2c]' : 'bg-gradient-to-b from-[#f5ecd9] to-[#e6d8be]'
    }`}>
      {/* Canvas 3D */}
      <Canvas
        shadows
        camera={{ position: [14, 13, 14], fov: 38 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[isNight ? '#1a1c2c' : '#f5ecd9']} />
        <fog attach="fog" args={[isNight ? '#1a1c2c' : '#f5ecd9', 28, 55]} />

        {/* Iluminação dinâmica */}
        <ambientLight intensity={isNight ? 0.25 : 0.55} />
        <directionalLight
          position={[10, 18, 10]}
          intensity={isNight ? 0.4 : 1.1}
          color={isNight ? '#a8c8ff' : '#ffffff'}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        
        {isNight && (
          <pointLight position={[0, 4, 0]} intensity={0.6} color="#4c6ef5" />
        )}
        
        <Suspense fallback={null}>
          <Room isNight={isNight} />
          
          {/* Estações de trabalho (estáticas) */}
          {AGENTS.map((agent) => (
            <Workstation
              key={`ws-${agent.id}`}
              agent={agent}
              isBusy={runtime[agent.id]?.status !== 'idle'}
            />
          ))}

          {/* Agentes (dinâmicos/móveis) */}
          {AGENTS.map((agent) => {
            const st = runtime[agent.id];
            return (
              <VoxelAgent
                key={`agent-${agent.id}`}
                agent={agent}
                status={st?.status || 'idle'}
                position={st?.position || agent.position}
                message={st?.message}
                onClick={() => setSelected(agent)}
              />
            );
          })}

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={isNight ? 0.6 : 0.35}
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

      {/* HUD topo-esquerda — título + métricas + compartilhamento */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-3">
        <div className="pointer-events-auto rounded-xl bg-white/85 p-3 backdrop-blur shadow-lg ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-xl font-extrabold text-slate-900">
                Sala dos Agentes
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                Visão ao vivo dos módulos do CRM trabalhando.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select 
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-primary"
                value={shareExpiration}
                onChange={(e) => setShareExpiration(e.target.value)}
              >
                <option value="1h">1 hora</option>
                <option value="2h">2 horas</option>
                <option value="24h">24 horas</option>
                <option value="2d">2 dias</option>
                <option value="10d">10 dias</option>
              </select>
              <Button 
                variant="default" 
                size="sm" 
                className="h-8 gap-2 bg-slate-900 text-white hover:bg-slate-800" 
                onClick={handleShare}
                disabled={isGeneratingLink}
              >
                {isGeneratingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                Compartilhar
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Activity className="mr-1 h-3 w-3" /> {busyCount} ativos
            </Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
              <Sparkles className="mr-1 h-3 w-3" /> {AGENTS.length} agentes
            </Badge>
            <Badge variant="outline" className={`${isNight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {isNight ? <Moon className="mr-1 h-3 w-3" /> : <Sun className="mr-1 h-3 w-3" />}
              {currentHour}h {isNight ? '(Noite)' : '(Dia)'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Legenda topo-direita */}
      <div className="pointer-events-none absolute right-4 top-4">
        <div className="pointer-events-auto rounded-xl bg-slate-900/90 p-4 backdrop-blur shadow-2xl ring-1 ring-white/20 text-white">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Monitor de Status
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="flex items-center gap-3"><StatusDot status="idle" /> <span className="text-slate-300">Ocioso</span></li>
            <li className="flex items-center gap-3"><StatusDot status="working" /> <span className="font-medium">Processando</span></li>
            <li className="flex items-center gap-3"><StatusDot status="thinking" /> <span className="font-medium">Analisando</span></li>
            <li className="flex items-center gap-3"><StatusDot status="talking" /> <span className="font-medium">Comunicando</span></li>
            <li className="flex items-center gap-3"><StatusDot status="error" /> <span className="text-red-400 font-bold">Atenção</span></li>
          </ul>
        </div>
      </div>

      {/* Histórico ao vivo (rodapé direito) */}
      <div className="pointer-events-none absolute bottom-4 right-4 w-80">
        <Card className="pointer-events-auto bg-white/90 backdrop-blur shadow-xl ring-1 ring-slate-200 border-0 overflow-hidden">
          <button 
            className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left transition-colors hover:bg-slate-50"
            onClick={() => setShowHistory(!showHistory)}
          >
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
              <Clock className="h-4 w-4 text-slate-500" />
              Atividades em tempo real
            </h3>
            {showHistory ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
          </button>
          
          {showHistory && (
            <ScrollArea className="h-56 animate-in slide-in-from-bottom-2 duration-200">
              <div className="p-2">
              {history.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-[11px] text-slate-400">
                  <div className="relative">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                    <Activity className="absolute inset-0 h-4 w-4 scale-50 text-slate-400" />
                  </div>
                  Escaneando pulso do sistema...
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
          )}
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
