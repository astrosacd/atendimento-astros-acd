# ASTRO: rosto fiel, voz correta e menor latência

## Objetivo
Aproximar o ASTRO da referência enviada: rosto humano frontal reconhecível em malha luminosa, reação orgânica durante fala/escuta, mesma voz configurada em Ligações IA e resposta perceptivelmente mais rápida.

## Execução
1. **Reconstruir o avatar 3D**
   - Trocar o esferoide uniforme por uma geometria facial paramétrica com testa, órbitas, nariz, maçãs, lábios, mandíbula e queixo.
   - Renderizar duas camadas: pontos luminosos + conexões trianguladas discretas.
   - Adicionar partículas soltas e faíscas orbitando o rosto, com brilho branco/ciano e profundidade.
   - Animar boca, bochechas e emissão de partículas conforme o áudio; manter reações próprias para escuta e processamento.
   - Ajustar enquadramento responsivo para o rosto dominar a tela sem cobrir controles/legendas.

2. **Garantir a mesma voz de Ligações IA**
   - Manter o TTS ligado à configuração central de Ligações IA (`elevenlabs_default_voice_id`, modelo, estabilidade, similaridade e velocidade).
   - Validar e expor erro claro caso a voz padrão não esteja configurada, evitando fallback silencioso para outra voz.

3. **Reduzir o atraso da conversa**
   - Encurtar a espera de silêncio do detector de voz sem cortar palavras.
   - Eliminar etapas evitáveis no cliente e preparar o áudio para tocar assim que estiver disponível.
   - Usar resposta curta e modelo rápido no assistente, preservando as ferramentas e permissões existentes.
   - Mostrar estados separados de transcrição, consulta e preparação da voz para o atraso não parecer travamento.

4. **Validar**
   - Verificar renderização WebGL em desktop e mobile, enquadramento, ausência de sobreposição e animação.
   - Testar o ciclo: escutar → transcrever → consultar → gerar voz → falar → reabrir microfone.
   - Confirmar que nenhum módulo existente foi alterado fora de ASTRO e da função de TTS compartilhada, se necessário.

## Impacto e riscos
- A malha será procedural e inspirada na referência; não é captura facial/fotogrametria do vídeo original.
- A latência externa de STT, IA e ElevenLabs não pode ser zerada, mas o pipeline local e os tempos de espera serão reduzidos.
- Alterações na função compartilhada de TTS serão limitadas a validação/latência e devem preservar Ligações IA.
