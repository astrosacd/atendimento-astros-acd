import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onRecordingComplete: (base64Audio: string) => void;
  isProcessing?: boolean;
}

export function AudioRecorder({ onRecordingComplete, isProcessing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      // Remover o prefixo data:audio/webm;base64,
      const base64Data = base64Audio.split(',')[1];
      onRecordingComplete(base64Data);
      setAudioBlob(null);
    };
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30">
      <div className="text-2xl font-mono">
        {isRecording ? (
          <span className="text-red-500 animate-pulse">● {formatTime(recordingTime)}</span>
        ) : (
          audioBlob ? "Gravação concluída" : "Pronto para gravar"
        )}
      </div>

      <div className="flex gap-2">
        {!isRecording && !audioBlob && (
          <Button onClick={startRecording} disabled={isProcessing} className="rounded-full h-12 w-12 p-0">
            <Mic className="h-6 w-6" />
          </Button>
        )}

        {isRecording && (
          <Button onClick={stopRecording} variant="destructive" className="rounded-full h-12 w-12 p-0">
            <Square className="h-6 w-6" />
          </Button>
        )}

        {audioBlob && !isRecording && (
          <>
            <Button 
              onClick={() => setAudioBlob(null)} 
              variant="outline" 
              disabled={isProcessing}
              className="rounded-full h-12 w-12 p-0"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={isProcessing}
              className="px-6 h-12"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Processar Áudio
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
