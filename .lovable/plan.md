## Objetivo
Fazer o roteiro/TTS ser falado automaticamente dentro da chamada Wavoip, sem precisar de operador humano com microfone.

## Estratégia
O Wavoip foi explícito: é preciso editar a entrada/saída de áudio do próprio projeto `wavoip-api`. O ponto único de alteração é o `MediaManager` (`src/modules/media/MediaManager.ts`), que hoje sempre chama `getUserMedia` pra capturar microfone. Vamos vendorizar a lib dentro do nosso repo e substituir esse stream por um stream sintético alimentado pelo MP3 do ElevenLabs.

## Passos

### 1. Vendorizar o wavoip-api
- Copiar `src/modules/*` + `Wavoip.ts` do repo `wavoip/wavoip-api` pra `src/vendor/wavoip/`.
- Ajustar imports (`@/modules/...` → caminhos relativos) e o `?worklet` do Vite (já suportado no nosso projeto).
- Remover dependências de teste (Vitest, biome).

### 2. Patch no MediaManager
Adicionar dois métodos novos sem quebrar a API atual:
- `setVirtualMicStream(stream: MediaStream)` — substitui `this.stream` pelo stream injetado; `startMedia()` passa a retornar esse stream em vez de chamar `getUserMedia`.
- `captureRemoteStream(): MediaStream` — pega o áudio remoto (WhatsApp → nós) via `MediaStreamAudioDestinationNode`, pra opcionalmente gravar.

`startMedia()` ganha um branch: se houver `virtualStream`, pula `getUserMedia` e retorna direto. Isso evita prompt de permissão de microfone também.

### 3. Helper TTS → MediaStream
Criar `src/lib/ttsToStream.ts`:
- Recebe URL do MP3 do ElevenLabs (já temos via `ligacoes-ia-tts`).
- `fetch` → `arrayBuffer` → `AudioContext.decodeAudioData` → `AudioBufferSourceNode` → `MediaStreamAudioDestinationNode` → retorna `destination.stream`.
- Expõe `onEnded` pra sabermos quando o roteiro terminou (e podermos encerrar ou tocar próximo trecho).

### 4. Integração na chamada
Em `LigarComIADialog.tsx` e `LigacoesIA.tsx`:
1. Gerar TTS via edge function (já existe).
2. Criar o stream virtual com o helper.
3. Antes de `wavoip.startCall({ to })`, chamar `mediaManager.setVirtualMicStream(ttsStream)`.
4. Disparar a ligação. Quando peer aceitar (`onPeerAccept`), o áudio TTS começa a tocar automaticamente no lugar do microfone.
5. No `onEnded` do TTS, opcionalmente encerrar a chamada (`callActive.end()`).

### 5. Remover o fallback Click-to-Call
Tirar o popup `https://app.wavoip.com/call?...` — agora a chamada acontece silenciosamente em background via WebRTC, sem janela extra. Resolve também o problema do iframe do Chat Host (sem popup pra bloquear).

### 6. Iframe / permissões
Documentar no README do módulo que o iframe que embute o app precisa de:
```
allow="microphone; autoplay"
```
Mesmo usando stream virtual, o `AudioContext` precisa de user gesture pra dar `resume()`, então a ligação só dispara após clique do usuário (já é o caso).

## Riscos
- Wavoip pode atualizar a lib e quebrar nosso fork — vamos pinar a versão e documentar onde está o patch.
- WebRTC com track sintético é suportado em Chrome/Edge/Safari modernos; navegadores antigos podem falhar.
- ElevenLabs MP3 precisa ser decodificado no client — pode adicionar 200-500ms de latência antes da fala começar (aceitável).

## Arquivos a mexer
- **Criar**: `src/vendor/wavoip/**`, `src/lib/ttsToStream.ts`
- **Editar**: `src/components/LigarComIADialog.tsx`, `src/pages/LigacoesIA.tsx`
- **Remover**: lógica de `window.open` / `call_url` em `supabase/functions/ligacoes-ia-call/index.ts` (agora só registra histórico)

## Próximo passo
Confirma que posso seguir com esse caminho? É ~1h de implementação e testa direto no preview.