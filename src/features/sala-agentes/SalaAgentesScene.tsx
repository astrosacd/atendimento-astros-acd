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
  Share2, ChevronDown, ChevronUp, Clock, Sun, Moon,
  Upload, MessageSquare
} from 'lucide-react';
import { AGENTS, type AgentDef } from './agents';
import { Room } from './Room';
import { Workstation } from './Workstation';
import { VoxelAgent } from './VoxelAgent';
import { useAgentRoomEvents } from './useAgentRoomEvents';
import { AGENT_HEX, STATUS_HEX } from './colors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { copyToClipboard } from '@/utils/clipboard';

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
  const [showStatus, setShowStatus] = useState(true);
  const [showHUD, setShowHUD] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'chat'>('activity');
  const [showHistory, setShowHistory] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareExpiration, setShareExpiration] = useState('24h');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string, sender: string, text: string, time: string }[]>([]);

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'company_logo').single();
      if (data?.value) setLogoUrl(data.value);
    };
    fetchLogo();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('company_assets').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('company_assets').getPublicUrl(fileName);
      await supabase.from('system_settings').upsert({ key: 'company_logo', value: publicUrl }, { onConflict: 'key' });
      setLogoUrl(publicUrl);
      toast.success('Logo atualizada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro no upload');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Simulação de chat entre agentes baseada no histórico de eventos REALTIME
  useEffect(() => {
    if (history.length > 0) {
      const last = history[0];
      const agent = AGENTS.find(a => a.id === last.agentId);
      
      // Só dispara mensagem de chat se for um evento recente (últimos 3 segundos)
      const isRecent = (Date.now() - last.ts) < 3000;
      
      if (agent && isRecent) {
        const responses = [
          `Confirmado! Processando ${last.message.toLowerCase()}.`,
          "Entendido, alteração registrada no banco.",
          `Módulo ${agent.module} operando normalmente.`,
          "Ação concluída com sucesso.",
          "Notifiquei o restante do sistema.",
          "Dados sincronizados agora mesmo.",
          "IA validou o processo."
        ];
        
        const msg = {
          id: Math.random().toString(),
          sender: agent.name,
          text: responses[Math.floor(Math.random() * responses.length)],
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        
        setChatMessages(prev => [msg, ...prev].slice(0, 8));
      }
    }
  }, [history]);

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

      // Usamos a URL base vinda de project_urls ou window.location dependendo do ambiente
      const baseUrl = "https://atendimento-astros-acd.lovable.app";
      const url = `${baseUrl}/public/sala-agentes?token=${token}`;
      
      await copyToClipboard(url);
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
          <Room isNight={isNight} logoUrl={logoUrl} />
          
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
        <div className="pointer-events-auto flex items-center gap-2 mb-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-white/90 shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => setShowHUD(!showHUD)}
          >
            {showHUD ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {!showHUD && (
            <div className="rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
              SALA DOS AGENTES
            </div>
          )}
        </div>

        {showHUD && (
          <div className="pointer-events-auto rounded-xl bg-white/85 p-3 backdrop-blur shadow-lg ring-1 ring-slate-200 animate-in slide-in-from-top-4 duration-300">
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
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-slate-800 transition-colors shadow-sm">
                <Upload className="h-3.5 w-3.5" />
                {isUploadingLogo ? 'Enviando...' : 'Upload Logo'}
                <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Chat removido daqui pois agora está dentro do painel de atividades */}

      {/* Monitor de Status topo-direita */}
      <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="pointer-events-auto h-8 w-8 rounded-full bg-slate-900/80 shadow-md ring-1 ring-white/20 hover:bg-slate-800 text-white"
          onClick={() => setShowStatus(!showStatus)}
        >
          {showStatus ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {showStatus && (
          <div className="pointer-events-auto rounded-xl bg-slate-900/90 p-4 backdrop-blur shadow-2xl ring-1 ring-white/20 text-white animate-in slide-in-from-top-2 duration-200">
            <p className="font-display text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Monitor de Status
            </p>
            <ul className="mt-3 space-y-2 text-xs min-w-[180px]">
              {(['idle','working','thinking','talking','error'] as const).map(s => {
                const count = Object.values(runtime).filter(r => r.status === s).length;
                const labels = { idle:'Ocioso', working:'Processando', thinking:'Analisando', talking:'Comunicando', error:'Atenção' };
                return (
                  <li key={s} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><StatusDot status={s} /> <span className={s==='error'?'text-red-400 font-bold':'text-slate-200'}>{labels[s]}</span></span>
                    <span className="font-mono font-bold tabular-nums text-white">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Histórico ao vivo (rodapé direito) */}
      <div className="pointer-events-none absolute bottom-4 right-4 w-80">
        <Card className="pointer-events-auto bg-white/90 backdrop-blur shadow-xl ring-1 ring-slate-200 border-0 overflow-hidden">
          <div className="flex w-full items-center justify-between border-b border-slate-200 px-1 py-1">
            <div className="flex items-center gap-1">
              <button 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'activity' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => { setActiveTab('activity'); setShowHistory(true); }}
              >
                Atividades
              </button>
              <button 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'chat' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => { setActiveTab('chat'); setShowHistory(true); }}
              >
                Chat dos Agentes
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-900"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          
          {showHistory && (
            <ScrollArea className="h-56 animate-in slide-in-from-bottom-2 duration-200">
              <div className="p-2">
                {activeTab === 'activity' ? (
                  history.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-[11px] text-slate-400">
                      <div className="relative">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                        <Activity className="absolute inset-0 h-4 w-4 scale-50 text-slate-400" />
                      </div>
                      Esperando atividades...
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {history.map((evt) => {
                        const a = AGENTS.find(x => x.id === evt.agentId);
                        if (!a) return null;
                        return (
                          <li key={evt.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-slate-100">
                            <span className="mt-1 h-2 w-2 rounded-full" style={{ background: AGENT_HEX[a.color] }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                              <p className="text-[11px] text-slate-600 truncate">{evt.message}</p>
                            </div>
                            <span className="text-[10px] text-slate-400">{new Date(evt.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : (
                  chatMessages.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-[11px] text-slate-400 italic">
                      Nenhuma conversa iniciada...
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {chatMessages.map((msg) => (
                        <li key={msg.id} className="flex flex-col rounded-md bg-slate-50 p-2 border border-slate-100">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold text-slate-900">{msg.sender}</span>
                            <span className="text-[9px] text-slate-400">{msg.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 italic leading-tight">"{msg.text}"</p>
                        </li>
                      ))}
                    </ul>
                  )
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
