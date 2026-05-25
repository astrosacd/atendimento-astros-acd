import { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SalaAgentesScene } from '@/features/sala-agentes/SalaAgentesScene';
import { Loader2 } from 'lucide-react';

export default function SalaAgentesPublica() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setStatus('unauthorized');
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('validate_shared_access_token', { p_token: token });

        const row = Array.isArray(data) ? data[0] : null;
        if (error || !row || !row.valid) {
          setStatus('unauthorized');
          return;
        }

        setStatus('authorized');
      } catch (err) {
        setStatus('unauthorized');
      }
    }

    validateToken();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium animate-pulse">Validando acesso à Sala dos Agentes...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-900 text-white p-6 text-center">
        <div className="rounded-full bg-red-500/10 p-4 ring-1 ring-red-500/50">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold">Link Expirado ou Inválido</h1>
        <p className="max-w-md text-slate-400">
          Este link de compartilhamento não é mais válido. Peça um novo link ao administrador do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-900 p-2 md:p-4">
      <SalaAgentesScene isPublic />
    </div>
  );
}

import { X } from 'lucide-react';
