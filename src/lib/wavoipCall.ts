// Wavoip call client with TTS audio injection.
// Replaces the microphone stream with a MediaStream produced from the
// ElevenLabs TTS MP3, so the script is spoken inside the WhatsApp call.
import { Wavoip } from "@wavoip/wavoip-api";

export interface PlaceCallParams {
  token: string;          // Wavoip device token
  phone: string;          // destination phone (digits only)
  audioUrl: string;       // signed URL of the TTS MP3
  onStatus?: (status: string) => void;
  onEnded?: () => void;
}

export interface ActiveCallHandle {
  hangup: () => Promise<void>;
}

/**
 * Builds a MediaStream from an MP3 URL using WebAudio.
 * Returns the stream + a function that starts playback (must be called after gesture).
 */
async function ttsUrlToStream(audioUrl: string, audioContext: AudioContext) {
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Falha ao baixar áudio TTS: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const dest = audioContext.createMediaStreamDestination();
  let source: AudioBufferSourceNode | null = null;
  let onEndedCb: (() => void) | null = null;

  return {
    stream: dest.stream,
    duration: audioBuffer.duration,
    play() {
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.onended = () => onEndedCb?.();
      source.start(0);
    },
    onEnded(cb: () => void) {
      onEndedCb = cb;
    },
    stop() {
      try { source?.stop(); } catch { /* ignore */ }
    },
  };
}

/**
 * Place a Wavoip call with TTS audio injected as the microphone stream.
 * MUST be called from a user gesture (button click) so AudioContext can resume
 * and getUserMedia patch is in scope.
 */
export async function placeCallWithTTS(params: PlaceCallParams): Promise<ActiveCallHandle> {
  const { token, phone, audioUrl, onStatus, onEnded } = params;

  // 1. Build TTS stream from MP3 (uses its own AudioContext)
  const audioContext = new AudioContext();
  const tts = await ttsUrlToStream(audioUrl, audioContext);

  // 2. Monkey-patch getUserMedia so MediaManager picks up our virtual mic
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const patchedGetUserMedia = async (constraints?: MediaStreamConstraints) => {
    if (constraints?.audio) {
      onStatus?.("Injetando áudio TTS no microfone...");
      return tts.stream;
    }
    return originalGetUserMedia(constraints);
  };
  navigator.mediaDevices.getUserMedia = patchedGetUserMedia as typeof navigator.mediaDevices.getUserMedia;

  const restoreGetUserMedia = () => {
    if (navigator.mediaDevices.getUserMedia === patchedGetUserMedia) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
  };

  let activeCall: any = null;
  let ended = false;

  const cleanup = async () => {
    if (ended) return;
    ended = true;
    restoreGetUserMedia();
    try { tts.stop(); } catch { /* ignore */ }
    try { await audioContext.close(); } catch { /* ignore */ }
    onEnded?.();
  };

  try {
    // 3. Instantiate Wavoip and connect device
    onStatus?.("Conectando ao Wavoip...");
    // @ts-ignore - constructor signature varies between versions
    const wavoip = new Wavoip();
    // @ts-ignore - addDevice returns DeviceConnection or Promise<DeviceConnection>
    const deviceMaybe = wavoip.addDevice ? wavoip.addDevice(token) : wavoip.connect?.(token);
    const device = deviceMaybe && typeof (deviceMaybe as any).then === "function"
      ? await deviceMaybe
      : deviceMaybe;

    // Wait for device to be UP (status events)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout aguardando dispositivo Wavoip ficar pronto")), 15000);
      const checkUp = () => {
        const status = (device as any)?.status ?? (device as any)?.getStatus?.();
        if (status === "UP" || status === "ready" || status === "connected") {
          clearTimeout(timeout);
          resolve();
        }
      };
      checkUp();
      if ((device as any)?.on) {
        (device as any).on("status", (s: string) => {
          onStatus?.(`Dispositivo: ${s}`);
          if (s === "UP" || s === "ready" || s === "connected") {
            clearTimeout(timeout);
            resolve();
          } else if (s === "error" || s === "disconnected") {
            clearTimeout(timeout);
            reject(new Error(`Dispositivo Wavoip: ${s}`));
          }
        });
      } else {
        // Fallback polling
        const iv = setInterval(() => {
          checkUp();
        }, 500);
        setTimeout(() => clearInterval(iv), 15000);
      }
    });

    // 4. Start the call
    onStatus?.("Discando...");
    // @ts-ignore - API: startCall({ to }) returns CallOutgoing
    const outgoing = await (device as any).startCall({ to: phone });
    activeCall = outgoing;

    // Wire events
    const wireEnd = (call: any) => {
      if (!call?.on) return;
      call.on("ended", () => { onStatus?.("Ligação encerrada"); cleanup(); });
      call.on("rejected", () => { onStatus?.("Ligação rejeitada"); cleanup(); });
      call.on("failed", (e: any) => { onStatus?.(`Falha: ${e?.message ?? e}`); cleanup(); });
    };
    wireEnd(outgoing);

    if ((outgoing as any)?.on) {
      (outgoing as any).on("accepted", (active: any) => {
        onStatus?.("Atendida — falando roteiro...");
        activeCall = active ?? outgoing;
        wireEnd(active);

        // Start TTS playback now that peer accepted
        tts.onEnded(() => {
          onStatus?.("Roteiro finalizado, encerrando...");
          (activeCall as any)?.end?.().catch(() => {});
          setTimeout(cleanup, 500);
        });
        try { tts.play(); } catch (e) { console.warn("[wavoipCall] play error", e); }
      });
    }

    return {
      hangup: async () => {
        try { await (activeCall as any)?.end?.(); } catch { /* ignore */ }
        await cleanup();
      },
    };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
