// As mesmas verificações valem para todos os workspaces e destinos (WhatsApp/Meta).
export function verificarSinalAudio(canais: Float32Array[], sampleRate: number): void {
  if (!canais.length || !sampleRate) throw new Error("A gravação ficou vazia. Grave novamente.");
  const duracao = canais[0].length / sampleRate;
  let pico = 0;
  let segundosComSinal = 0;
  const janela = Math.max(1, Math.floor(sampleRate * 0.02));
  for (let inicio = 0; inicio < canais[0].length; inicio += janela) {
    let maiorRms = 0;
    const fim = Math.min(inicio + janela, canais[0].length);
    for (const canal of canais) {
      let soma = 0;
      for (let i = inicio; i < fim; i++) { const v = canal[i] || 0; soma += v * v; pico = Math.max(pico, Math.abs(v)); }
      maiorRms = Math.max(maiorRms, Math.sqrt(soma / (fim - inicio)));
    }
    if (maiorRms > 0.0018) segundosComSinal += (fim - inicio) / sampleRate;
  }
  if (pico < 0.001 || (duracao > 2 && segundosComSinal < 0.25)) {
    throw new Error("A gravação ficou sem som. Confira o microfone selecionado e grave novamente. O áudio não foi enviado.");
  }
}

export async function validarGravacaoAudio(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error("A gravação ficou vazia. Grave novamente.");
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return; // O backend também valida o áudio antes de enviar.
  const ctx = new AudioCtx();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return; // Alguns navegadores não decodificam localmente todos os formatos que gravam.
  } finally {
    await ctx.close().catch(() => {});
  }
  verificarSinalAudio(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)), buffer.sampleRate);
}
