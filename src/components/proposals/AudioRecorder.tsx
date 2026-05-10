import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  // Now returns transcribed text instead of base64 audio
  onRecordingComplete: (transcribedText: string) => void;
  isProcessing?: boolean;
}

// Use browser's native Speech Recognition (much more reliable than uploading audio)
export function AudioRecorder({ onRecordingComplete, isProcessing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      finalTranscriptRef.current = '';
      setTranscript('');

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += text + ' ';
          } else {
            interim += text;
          }
        }
        setTranscript(finalTranscriptRef.current + interim);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          const isIframe = window.self !== window.top;
          if (isIframe) {
            toast.error('Permissão de microfone negada. Como o sistema está dentro de um iframe (ex: Chatwoot), verifique se o navegador permite acesso ao microfone para este site.');
          } else {
            toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
          }
        } else if (event.error === 'no-speech') {
          // ignore - user just hasn't spoken yet
          return;
        } else {
          toast.error(`Erro no reconhecimento: ${event.error}`);
        }
        stopRecording();
      };

      recognition.onend = () => {
        // If still flagged recording (user didn't manually stop), restart
        if (recognitionRef.current === recognition && isRecording) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao iniciar gravação:', err);
      toast.error('Não foi possível iniciar a gravação.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    const finalText = (finalTranscriptRef.current + transcript).trim();
    if (!finalText) {
      toast.error('Nenhuma fala detectada. Tente novamente.');
      return;
    }
    onRecordingComplete(finalText);
  };

  const handleDiscard = () => {
    setTranscript('');
    finalTranscriptRef.current = '';
  };

  if (!isSupported) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">
        Seu navegador não suporta reconhecimento de voz nativo.
        <br />
        Use Google Chrome ou Microsoft Edge para esta funcionalidade.
      </div>
    );
  }

  const hasTranscript = transcript.trim().length > 0 || finalTranscriptRef.current.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-muted/30">
      <div className="text-xl font-mono">
        {isRecording ? (
          <span className="text-red-500 animate-pulse">● {formatTime(recordingTime)}</span>
        ) : (
          hasTranscript ? 'Gravação concluída' : 'Pronto para gravar'
        )}
      </div>

      {(isRecording || hasTranscript) && (
        <div className="w-full min-h-[60px] max-h-[120px] overflow-y-auto p-3 bg-background rounded border text-sm">
          {transcript || (
            <span className="text-muted-foreground italic">Fale agora...</span>
          )}
        </div>
      )}

      <div className="flex gap-2 items-center">
        {!isRecording && !hasTranscript && (
          <Button
            type="button"
            onClick={startRecording}
            disabled={isProcessing}
            className="rounded-full h-12 w-12 p-0"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}

        {isRecording && (
          <Button
            type="button"
            onClick={stopRecording}
            variant="destructive"
            className="rounded-full h-12 w-12 p-0"
          >
            <Square className="h-6 w-6" />
          </Button>
        )}

        {!isRecording && hasTranscript && (
          <>
            <Button
              type="button"
              onClick={handleDiscard}
              variant="outline"
              disabled={isProcessing}
              className="rounded-full h-12 w-12 p-0"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={isProcessing}
              className="px-6 h-12"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Gerar Proposta
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Explique o que deve ter na proposta (serviços, valores, prazos)
      </p>
    </div>
  );
}
