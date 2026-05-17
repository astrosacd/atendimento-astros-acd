// Wavoip call client with TTS audio injection.
// Replaces the microphone stream with a MediaStream produced from the
// ElevenLabs TTS MP3, so the script is spoken inside the WhatsApp call.
//
// Approach: monkey-patch navigator.mediaDevices.getUserMedia during the call
// so Wavoip's MediaManager picks up our synthetic stream instead of a real mic.
import { Wavoip, type CallActive, type CallOutgoing } from "@wavoip/wavoip-api";

export interface PlaceCallParams {
  token: string;          // Wavoip device token
  phone: string;          // destination phone (digits only, with DDI)
  audioUrl: string;       // signed URL of the TTS MP3
  onStatus?: (status: string) => void;
  onEnded?: () => void;
}

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

/**
 * Place a Wavoip call with TTS audio injected as the microphone stream.
 * MUST be called from a user gesture (button click).
 */
export async function placeCallWithTTS(params: PlaceCallParams): Promise<ActiveCallHandle> {
  const { token, phone, audioUrl, onStatus, onEnded } = params;

  // 1. Build TTS-backed MediaStream
  onStatus?.("Preparando áudio do roteiro...");
  const audioContext = new AudioContext();
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
  const cleanup = async () => {
    if (ended) return;
    ended = true;
    restorePatch();
    try { tts.stop(); } catch { /* ignore */ }
    try { await audioContext.close(); } catch { /* ignore */ }
    onEnded?.();
  };

  try {
    // 3. Build Wavoip client (constructor takes tokens array)
    onStatus?.("Conectando ao Wavoip...");
    const wavoip = new Wavoip({ tokens: [token], platform: "lovable-call-ai" });

    // 4. Start outgoing call
    onStatus?.("Discando...");
    const result = await wavoip.startCall({ to: phone });
    if (result.err || !result.call) {
      throw new Error(result.err?.message || "Falha ao iniciar ligação");
    }
    const outgoing = result.call;
    activeCall = outgoing;

    const wireEndEvents = (call: { on: (e: "ended", cb: () => void) => unknown }) => {
      call.on("ended", () => { onStatus?.("Ligação encerrada"); cleanup(); });
    };

    outgoing.on("status", (s) => onStatus?.(`Status: ${s}`));
    outgoing.on("peerReject", () => { onStatus?.("Rejeitada pelo destinatário"); cleanup(); });
    outgoing.on("unanswered", () => { onStatus?.("Não atendida"); cleanup(); });
    wireEndEvents(outgoing);

    outgoing.on("peerAccept", (active: CallActive) => {
      onStatus?.("Atendida — reproduzindo roteiro...");
      activeCall = active;
      active.on("status", (s) => onStatus?.(`Chamada: ${s}`));
      wireEndEvents(active);

      // Start TTS playback; when it ends, hang up.
      tts.onEnded(() => {
        onStatus?.("Roteiro concluído, encerrando...");
        setTimeout(() => {
          (activeCall as CallActive | null)?.end?.().catch(() => {});
          cleanup();
        }, 800);
      });
      try { tts.play(); } catch (e) { console.warn("[wavoipCall] play error", e); }
    });

    return {
      hangup: async () => {
        try { await (activeCall as CallActive | CallOutgoing | null)?.end?.(); } catch { /* ignore */ }
        await cleanup();
      },
    };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
