import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, Square, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ParticleFace from "@/components/astro/ParticleFace";

type AstroState = "idle" | "listening" | "thinking" | "speaking";
interface Turn { role: "user" | "assistant"; content: string }

/** Codifica PCM float32 mono em WAV 16-bit 16kHz */
function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  const targetRate = 16000;
  const ratio = inputRate / targetRate;
  const outLen = Math.floor(merged.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  w(8, "WAVE"); w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, out.length * 2, true);
  new Int16Array(buffer, 44).set(out);
  return new Blob([buffer], { type: "audio/wav" });
}

export default function Astro() {
  const navigate = useNavigate();
  const [state, setState] = useState<AstroState>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [listenLevel, setListenLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);

  const stateRef = useRef<AstroState>("idle");
  useEffect(() => { stateRef.current = state; }, [state]);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const silenceRef = useRef(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    setListenLevel(0);
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      setState("speaking");
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-tts", {
        body: { preview_text: text },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const url: string | undefined = data?.signed_url;
      if (!url) throw new Error("Áudio não gerado");

      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audioElRef.current = audio;

      let analyser: AnalyserNode | null = null;
      try {
        const ctx = playCtxRef.current ?? new AudioContext();
        playCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
        const src = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyser.connect(ctx.destination);
      } catch {
        analyser = null;
      }

      const buf = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
      const tick = () => {
        if (analyser && buf) {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          setAmplitude(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        } else {
          setAmplitude(0.35 + Math.random() * 0.25);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
      cancelAnimationFrame(rafRef.current);
      setAmplitude(0);
      setState("idle");
    } catch (e) {
      cancelAnimationFrame(rafRef.current);
      setAmplitude(0);
      setState("idle");
      toast.error(`Falha na voz: ${(e as Error).message}`);
    }
  }, []);

  const ask = useCallback(async (text: string) => {
    setState("thinking");
    setReply("");
    try {
      const messages = [...history, { role: "user" as const, content: text }].slice(-12);
      const { data, error } = await supabase.functions.invoke("astro-assistant", { body: { messages } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const answer: string = data?.reply ?? "";
      setReply(answer);
      setHistory([...messages, { role: "assistant" as const, content: answer }].slice(-12));
      await speak(answer);
    } catch (e) {
      setState("idle");
      toast.error(`ASTRO: ${(e as Error).message}`);
    }
  }, [history, speak]);

  const finishListening = useCallback(async () => {
    const chunks = chunksRef.current;
    const rate = micCtxRef.current?.sampleRate ?? 48000;
    stopMic();
    chunksRef.current = [];
    if (chunks.length === 0) { setState("idle"); return; }

    const blob = encodeWav(chunks, rate);
    if (blob.size < 4096) {
      setState("idle");
      toast.error("Não ouvi nada. Tente de novo.");
      return;
    }

    setState("thinking");
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/astro-stt`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
      );
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error ?? `Erro ${res.status}`);
      const text: string = (json.text ?? "").trim();
      if (!text) { setState("idle"); toast.error("Não entendi o que você falou."); return; }
      setTranscript(text);
      await ask(text);
    } catch (e) {
      setState("idle");
      toast.error(`Transcrição: ${(e as Error).message}`);
    }
  }, [ask, stopMic]);

  const finishRef = useRef(finishListening);
  useEffect(() => { finishRef.current = finishListening; }, [finishListening]);

  const startListening = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    setTranscript("");
    setReply("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      micCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = node;
      chunksRef.current = [];
      silenceRef.current = 0;
      let spoke = false;

      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setListenLevel(Math.min(1, rms * 8));

        if (rms > 0.02) { spoke = true; silenceRef.current = 0; }
        else if (spoke) {
          silenceRef.current += input.length / ctx.sampleRate;
          if (silenceRef.current > 1.4) { node.onaudioprocess = null; finishRef.current(); }
        }
      };
      source.connect(node);
      node.connect(ctx.destination);
      setState("listening");
    } catch {
      toast.error("Preciso de acesso ao microfone para te ouvir.");
    }
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    audioElRef.current?.pause();
    stopMic();
  }, [stopMic]);

  const statusLabel: Record<AstroState, string> = {
    idle: "Toque para falar",
    listening: "Ouvindo...",
    thinking: "Processando...",
    speaking: "Respondendo",
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* fundo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />

      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-sm font-semibold tracking-[0.4em] text-muted-foreground">ASTRO</h1>
        <div className="w-20" />
      </header>

      {/* rosto de partículas */}
      <div className="absolute inset-0 z-10">
        <ParticleFace amplitude={amplitude} listening={listenLevel} state={state} />
      </div>

      {/* legendas */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 p-6 pb-10">
        <div className="min-h-[86px] w-full max-w-2xl space-y-2 text-center">
          {transcript && (
            <p className="text-sm text-muted-foreground">
              <span className="opacity-60">Você: </span>{transcript}
            </p>
          )}
          {reply && (
            <p className="flex items-start justify-center gap-2 text-base font-medium text-foreground">
              <Volume2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <span>{reply}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          {state === "listening" ? (
            <Button size="lg" variant="destructive" className="h-16 w-16 rounded-full" onClick={() => finishListening()}>
              <Square className="h-6 w-6" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-16 w-16 rounded-full shadow-lg"
              disabled={state !== "idle"}
              onClick={startListening}
            >
              {state === "idle" ? <Mic className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
            </Button>
          )}
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{statusLabel[state]}</span>
        </div>
      </div>
    </main>
  );
}
