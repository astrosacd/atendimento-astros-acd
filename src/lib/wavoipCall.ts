// Wavoip call client with TTS audio injection.
// Replaces the microphone stream with a MediaStream produced from the
// ElevenLabs TTS MP3, so the script is spoken inside the WhatsApp call.
//
// Approach: monkey-patch navigator.mediaDevices.getUserMedia during the call
// so Wavoip's MediaManager picks up our synthetic stream instead of a real mic.
import { Wavoip, type CallActive, type CallOutgoing } from "@wavoip/wavoip-api";
import { supabase } from "@/integrations/supabase/client";

export interface PlaceCallParams {
  token: string;          // Wavoip device token
  phone: string;          // destination phone (digits only, with DDI)
  audioUrl: string;       // signed URL of the TTS MP3
  historicoId?: string;   // for posting outcome to webhook
  preTTSDelayMs?: number; // delay before starting playback after peer accepts
  onStatus?: (status: string) => void;
  onEnded?: () => void;
  audioContext?: AudioContext;
  wavoipInstance?: Wavoip; // optional cached Wavoip client (reuses socket across calls)
}

// No-op kept for backward compatibility with callers that import it.
export function clearWavoipCache() {}

export interface ActiveCallHandle {
  hangup: () => Promise<void>;
}

async function ttsUrlToPlayableStream(audioUrl: string, audioContext: AudioContext) {
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Falha ao baixar áudio TTS: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const dest = audioContext.createMediaStreamDestination();
  let source: AudioBufferSourceNode | null = null;
  let onEndedCb: (() => void) | null = null;

  return {
    stream: dest.stream as MediaStream,
    duration: audioBuffer.duration,
    play() {
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.onended = () => onEndedCb?.();
      source.start(0);
    },
    onEnded(cb: () => void) { onEndedCb = cb; },
    stop() { try { source?.stop(); } catch { /* ignore */ } },
  };
}

async function postHistoricoOutcome(histId: string, payload: Record<string, unknown>) {
  try {
    const url = `https://udxaxemoozddkwpitngq.supabase.co/functions/v1/ligacoes-ia-webhook?hist_id=${encodeURIComponent(histId)}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (e) {
    console.warn("[wavoipCall] failed to post outcome", e);
  }
}

/**
 * Place a Wavoip call with TTS audio injected as the microphone stream.
 * MUST be called from a user gesture (button click).
 */
export async function placeCallWithTTS(params: PlaceCallParams): Promise<ActiveCallHandle> {
  const { token, phone, audioUrl, historicoId, preTTSDelayMs = 3000, onStatus, onEnded, audioContext: providedCtx } = params;

  // 1. Build TTS-backed MediaStream
  onStatus?.("Preparando áudio do roteiro...");
  const audioContext = providedCtx || new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
  const tts = await ttsUrlToPlayableStream(audioUrl, audioContext);

  // 2. Monkey-patch getUserMedia so Wavoip's MediaManager grabs our stream
  const md = navigator.mediaDevices;
  const originalGetUserMedia = md.getUserMedia.bind(md);
  const patched = async (constraints?: MediaStreamConstraints) => {
    if (constraints?.audio) {
      onStatus?.("Injetando áudio TTS no lugar do microfone...");
      return tts.stream;
    }
    return originalGetUserMedia(constraints);
  };
  md.getUserMedia = patched as typeof md.getUserMedia;

  const restorePatch = () => {
    if (md.getUserMedia === patched) {
      md.getUserMedia = originalGetUserMedia;
    }
  };

  let activeCall: CallActive | CallOutgoing | null = null;
  let ended = false;
  let answered = false;
  let playbackStarted = false;
  let playbackCompleted = false;
  let answeredAt = 0;

  const cleanup = async (reason?: string, skipEndedCallback = false) => {
    if (ended) return;
    ended = true;
    restorePatch();
    try { tts.stop(); } catch { /* ignore */ }
    if (!providedCtx) {
      try { await audioContext.close(); } catch { /* ignore */ }
    }

    // Report outcome to the historico webhook
    if (historicoId) {
      const listenedMs = answeredAt ? Date.now() - answeredAt : 0;
      let observacao = reason ?? "";
      let mappedStatus = "finalizada";
      
      if (answered && !playbackCompleted) {
        mappedStatus = "cliente_desligou_antes_audio";
        observacao = playbackStarted
          ? `Cliente desligou durante o áudio (ouviu ~${Math.round(listenedMs / 1000)}s)`
          : `Cliente desligou antes do roteiro começar (atendeu mas desligou durante o delay)`;
      } else if (!answered) {
        mappedStatus = "nao_atendeu";
        observacao = observacao || "Não atendida ou rejeitada";
      } else if (playbackCompleted) {
        observacao = "Roteiro reproduzido por completo";
      }

      void postHistoricoOutcome(historicoId, {
        status: mappedStatus,
        duration_seconds: answeredAt ? Math.round(listenedMs / 1000) : 0,
        observacao,
        playback_completed: playbackCompleted,
        playback_started: playbackStarted,
      });
    }

    if (!skipEndedCallback) {
      onEnded?.();
    }
  };

  try {
    onStatus?.("Conectando ao Wavoip...");
    const wavoip = params.wavoipInstance ?? new Wavoip({ tokens: [token], platform: "lovable-call-ai" });
    await new Promise(r => setTimeout(r, 2000));

    onStatus?.("Discando...");
    const result = await wavoip.startCall({ to: phone });
    if (result.err || !result.call) {
      const detail = result.err?.devices?.map((d) => `${d.token.slice(-6)}:${d.reason}`).join(" | ");
      throw new Error(result.err?.message || detail || "Falha ao iniciar ligação");
    }
    const outgoing = result.call;
    activeCall = outgoing;

    const wireEndEvents = (call: { on: (e: "ended", cb: () => void) => unknown }) => {
      call.on("ended", () => { onStatus?.("Ligação encerrada"); cleanup("Ligação encerrada"); });
    };

    outgoing.on("status", (s) => onStatus?.(`Status: ${s}`));
    outgoing.on("peerReject", () => { onStatus?.("Rejeitada pelo destinatário"); cleanup("Rejeitada"); });
    outgoing.on("unanswered", () => { onStatus?.("Não atendida"); cleanup("Não atendida"); });
    wireEndEvents(outgoing);

    outgoing.on("peerAccept", (active: CallActive) => {
      answered = true;
      answeredAt = Date.now();
      onStatus?.(`Atendida — aguardando ${Math.round(preTTSDelayMs / 1000)}s antes de falar...`);
      activeCall = active;
      active.on("status", (s) => onStatus?.(`Chamada: ${s}`));
      wireEndEvents(active);

      tts.onEnded(() => {
        playbackCompleted = true;
        onStatus?.("Roteiro concluído, encerrando...");
        setTimeout(() => {
          (activeCall as CallActive | null)?.end?.().catch(() => {});
          cleanup("Roteiro concluído");
        }, 800);
      });

      setTimeout(() => {
        if (ended) return;
        onStatus?.("Reproduzindo roteiro...");
        playbackStarted = true;
        try { tts.play(); } catch (e) { console.warn("[wavoipCall] play error", e); }
      }, preTTSDelayMs);
    });

    return {
      hangup: async () => {
        try { await (activeCall as CallActive | CallOutgoing | null)?.end?.(); } catch { /* ignore */ }
        await cleanup("Encerrada pelo operador");
      },
    };
  } catch (e) {
    console.error("[wavoipCall] Fatal error during setup/call:", e);
    await cleanup((e as Error)?.message, true);
    throw e;
  }
}

/**
 * Place a manual Wavoip call using the browser microphone.
 * Consultant talks directly to the customer.
 */
export async function placeManualCall(params: {
  token: string;
  phone: string;
  onStatus?: (status: string) => void;
  onEnded?: () => void;
  wavoipInstance?: Wavoip;
}): Promise<ActiveCallHandle> {
  const { token, phone, onStatus, onEnded } = params;

  let activeCall: CallActive | CallOutgoing | null = null;
  let ended = false;

  const cleanup = async () => {
    if (ended) return;
    ended = true;
    onEnded?.();
  };

  try {
    onStatus?.("Conectando ao Wavoip...");
    const wavoip = params.wavoipInstance ?? new Wavoip({ tokens: [token], platform: "lovable-call-ai" });
    await new Promise(r => setTimeout(r, 1500));

    onStatus?.("Discando...");
    const result = await wavoip.startCall({ to: phone });
    if (result.err || !result.call) {
      const detail = result.err?.devices?.map((d) => `${d.token.slice(-6)}:${d.reason}`).join(" | ");
      throw new Error(result.err?.message || detail || "Falha ao iniciar ligação");
    }
    
    const outgoing = result.call;
    activeCall = outgoing;

    const wireEndEvents = (call: { on: (e: "ended", cb: () => void) => unknown }) => {
      call.on("ended", () => { onStatus?.("Ligação encerrada"); cleanup(); });
    };

    outgoing.on("status", (s) => onStatus?.(`Status: ${s}`));
    outgoing.on("peerReject", () => { onStatus?.("Rejeitada"); cleanup(); });
    outgoing.on("unanswered", () => { onStatus?.("Não atendida"); cleanup(); });
    wireEndEvents(outgoing);

    outgoing.on("peerAccept", (active: CallActive) => {
      onStatus?.("Chamada em andamento (Consultor)");
      activeCall = active;
      active.on("status", (s) => onStatus?.(`Chamada: ${s}`));
      wireEndEvents(active);
    });

    return {
      hangup: async () => {
        try { await (activeCall as CallActive | CallOutgoing | null)?.end?.(); } catch { /* ignore */ }
        await cleanup();
      },
    };
  } catch (e) {
    console.error("[wavoipCall] Manual call error:", e);
    await cleanup();
    throw e;
  }
}
