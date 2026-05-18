import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, Activity, Sparkles, X, ExternalLink, 
  Share2, ChevronDown, ChevronUp, Clock, Sun, Moon,
  Upload, MessageSquare, Cloud, CloudRain, CloudLightning,
  Map, User, Camera, Play, Pause, RotateCcw
} from 'lucide-react';
import { AGENTS, type AgentDef } from './agents';
import { Room } from './Room';
import { Workstation } from './Workstation';
import { VoxelAgent } from './VoxelAgent';
import { Weather, pickWeather, type WeatherKind } from './Weather';
import { BigScreen } from './BigScreen';
import { LeisureAreas } from './LeisureAreas';
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

export function SalaAgentesScene({ isPublic = false }: { isPublic?: boolean } = {}) {
  const navigate = useNavigate();
  const { runtime, history } = useAgentRoomEvents();
  const [selected, setSelected] = useState<AgentDef | null>(null);
  const [showStatus, setShowStatus] = useState(true);
  const [showHUD, setShowHUD] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'chat'>('activity');
  const [showHistory, setShowHistory] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [weather, setWeather] = useState<WeatherKind>(() => pickWeather());
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareExpiration, setShareExpiration] = useState('24h');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string, sender: string, text: string, time: string }[]>([]);
  
  // Controle de Tour 360 / Passeio
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourTargetIndex, setTourTargetIndex] = useState(0);
  const tourCameraRef = useRef<THREE.PerspectiveCamera>(null);
  const tourControlsRef = useRef<any>(null);
  const tourPoints = useMemo(() => [
    { pos: [22, 12, 22], target: [0, 0, 0], label: "Visão Geral" },
    { pos: [-15, 3, -10], target: [-10, 1, -5], label: "Setor Comercial" },
    { pos: [0, 3, -12], target: [0, 2, -7], label: "Centro Smart IA" },
    { pos: [15, 3, -10], target: [10, 1, -5], label: "Financeiro" },
    { pos: [0, 3, 10], target: [0, 1, 5], label: "Operações & Suporte" },
    { pos: [0, 4, 1.5], target: [0, 1, 1.5], label: "Praça Central" },
    { pos: [-15, 3, 10], target: [-17, 1, 10], label: "Data Center" },
    { pos: [0, 15, 0], target: [0, 0, 0], label: "Vista Superior" }
  ], []);

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
    const weatherTimer = setInterval(() => setWeather(pickWeather()), 60000);
    return () => {
      clearInterval(demoTimer);
      clearInterval(hourTimer);
      clearInterval(weatherTimer);
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
        shadows={false}
        dpr={[1, 1.4]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera 
          makeDefault 
          ref={tourCameraRef} 
          position={[22, 20, 22]} 
          fov={42} 
        />
        
        <TourManager 
          active={isTourActive} 
          targetIndex={tourTargetIndex} 
          points={tourPoints} 
          cameraRef={tourCameraRef}
          onReachedTarget={() => {
            if (isTourActive) {
              // Poderia rotacionar automaticamente aqui se quisesse
            }
          }}
        />

        <color attach="background" args={[isNight ? '#1a1c2c' : '#f5ecd9']} />
        <fog attach="fog" args={[isNight ? '#1a1c2c' : '#f5ecd9', 40, 80]} />

        {/* Iluminação simplificada (sem shadow maps - ContactShadows fornece sombras fake) */}
        <ambientLight intensity={isNight ? 0.45 : 0.8} />
        <directionalLight
          position={[10, 18, 10]}
          intensity={isNight ? 0.5 : 1.0}
          color={isNight ? '#a8c8ff' : '#ffffff'}
        />
        
        {isNight && (
          <pointLight position={[0, 4, 0]} intensity={0.6} color="#4c6ef5" />
        )}
        
        <Suspense fallback={null}>
          <Room isNight={isNight} logoUrl={logoUrl} />
          <Weather weather={weather} isNight={isNight} />
          <LeisureAreas isNight={isNight} />
          <BigScreen busyCount={busyCount} totalAgents={AGENTS.length} />
          
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
            scale={42}
            blur={2.4}
            far={6}
          />
          <FloatingParticles count={80} isNight={isNight} />
          <PulsingBeacons />
        </Suspense>

        <OrbitControls
          ref={tourControlsRef}
          enablePan={!isTourActive}
          enableRotate={true}
          minDistance={isTourActive ? 1 : 10}
          maxDistance={42}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 1, 0]}
          makeDefault
        />
      </Canvas>

      {/* Seletor de Tour (Floating Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        {isTourActive && (
          <div className="flex items-center gap-2 rounded-full bg-slate-900/90 p-1.5 backdrop-blur-md shadow-2xl ring-1 ring-white/20 animate-in fade-in slide-in-from-bottom-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white hover:bg-white/10"
              onClick={() => setTourTargetIndex(prev => (prev > 0 ? prev - 1 : tourPoints.length - 1))}
            >
              <ChevronDown className="h-5 w-5 rotate-90" />
            </Button>
            
            <div className="px-4 py-1 text-center min-w-[140px]">
              <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">Explorando</span>
              <span className="block text-xs font-black text-white">{tourPoints[tourTargetIndex].label}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white hover:bg-white/10"
              onClick={() => setTourTargetIndex(prev => (prev + 1) % tourPoints.length)}
            >
              <ChevronUp className="h-5 w-5 rotate-90" />
            </Button>
            
            <div className="h-6 w-px bg-white/10 mx-1" />
            
            <Button
              variant="destructive"
              size="sm"
              className="h-9 rounded-full px-4 font-bold"
              onClick={() => setIsTourActive(false)}
            >
              Sair do Tour
            </Button>
          </div>
        )}

        {!isTourActive && (
          <Button
            className="group flex h-11 items-center gap-3 rounded-full bg-blue-600 px-6 font-bold text-white shadow-2xl transition-all hover:bg-blue-500 hover:scale-105 active:scale-95"
            onClick={() => {
              setIsTourActive(true);
              setTourTargetIndex(1); // Começa pelo comercial
            }}
          >
            <Map className="h-5 w-5 animate-pulse" />
            Fazer Tour 360°
          </Button>
        )}
      </div>
// ... keep existing code

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
              {!isPublic && (
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
              )}
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
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 capitalize">
                {weather === 'sunny' && <Sun className="mr-1 h-3 w-3" />}
                {weather === 'cloudy' && <Cloud className="mr-1 h-3 w-3" />}
                {weather === 'rainy' && <CloudRain className="mr-1 h-3 w-3" />}
                {weather === 'storm' && <CloudLightning className="mr-1 h-3 w-3" />}
                {weather === 'sunny' ? 'Ensolarado' : weather === 'cloudy' ? 'Nublado' : weather === 'rainy' ? 'Chuvoso' : 'Tempestade'}
              </Badge>
              {!isPublic && (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-slate-800 transition-colors shadow-sm">
                  <Upload className="h-3.5 w-3.5" />
                  {isUploadingLogo ? 'Enviando...' : 'Upload Logo'}
                  <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                </label>
              )}
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

      {/* Dica de interação — movida para o topo-centro para não colidir com Tour e Chat */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-medium text-white backdrop-blur shadow-md ring-1 ring-white/10 whitespace-nowrap">
          Arraste para girar · scroll para zoom · clique no agente
        </div>
      </div>
    </div>
  );
}

/**
 * Componente interno para gerenciar a transição suave da câmera durante o tour
 */
function TourManager({ active, targetIndex, points, cameraRef, onReachedTarget }: { 
  active: boolean, 
  targetIndex: number, 
  points: any[], 
  cameraRef: React.RefObject<THREE.PerspectiveCamera>,
  onReachedTarget: () => void 
}) {
  const targetPos = useMemo(() => new THREE.Vector3(...points[targetIndex].pos), [targetIndex, points]);
  const targetLook = useMemo(() => new THREE.Vector3(...points[targetIndex].target), [targetIndex, points]);
  
  useFrame((state) => {
    if (!active || !cameraRef.current) return;

    // Interpola posição da câmera
    cameraRef.current.position.lerp(targetPos, 0.05);
    
    // Pegamos o controle via a cena
    const controls = (state as any).controls;
    if (controls) {
      controls.target.lerp(targetLook, 0.05);
      if (cameraRef.current.position.distanceTo(targetPos) < 0.1 && controls.target.distanceTo(targetLook) < 0.1) {
        onReachedTarget();
      }
    }
  });

  return null;
}


/**
 * Partículas flutuantes ambientais para dar vida à sala
 */
function FloatingParticles({ count = 60, isNight = false }: { count?: number; isNight?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 36,
      y: 1 + Math.random() * 6,
      z: (Math.random() - 0.5) * 24,
      speed: 0.2 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.offset) * 1.5,
        p.y + Math.sin(t * p.speed * 0.7 + p.offset) * 0.6,
        p.z + Math.cos(t * p.speed + p.offset) * 1.5,
      );
      dummy.scale.setScalar(0.08 + Math.sin(t * 2 + p.offset) * 0.03);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color={isNight ? '#7dd3fc' : '#fbbf24'}
        transparent
        opacity={isNight ? 0.7 : 0.5}
      />
    </instancedMesh>
  );
}

/**
 * Faróis pulsantes nos cantos da sala
 */
function PulsingBeacons() {
  const beaconsRef = useRef<THREE.Group>(null);
  const positions: [number, number, number][] = [
    [-17, 0.2, -11], [17, 0.2, -11], [-17, 0.2, 11], [17, 0.2, 11],
  ];

  useFrame((state) => {
    if (!beaconsRef.current) return;
    const t = state.clock.elapsedTime;
    beaconsRef.current.children.forEach((child, i) => {
      const scale = 1 + Math.sin(t * 2 + i * 0.5) * 0.4;
      child.scale.setScalar(scale);
    });
  });

  return (
    <group ref={beaconsRef}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.3, 0.5, 0.2, 12]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  );
}
