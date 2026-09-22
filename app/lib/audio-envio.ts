export function nomeArquivoAudio(mime: string): string {
  const tipo = mime.split(";", 1)[0].trim().toLowerCase();
  const extensoes: Record<string, string> = {
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
    "audio/aac": "aac",
  };
  return `audio_${Date.now()}.${extensoes[tipo] || "bin"}`;
}

export async function lerRespostaAudio(resposta: Response): Promise<void> {
  if (resposta.status === 413) {
    throw new Error("O áudio excedeu o limite de envio do servidor. Grave um áudio mais curto.");
  }
  const dados: unknown = await resposta.json().catch(() => null);
  if (!dados || typeof dados !== "object") {
    throw new Error("O servidor não retornou uma resposta válida ao enviar o áudio. Verifique o histórico antes de tentar novamente.");
  }
  const resultado = dados as { success?: boolean; sucesso?: boolean; error?: unknown; erro?: unknown };
  if (!resposta.ok || !(resultado.success || resultado.sucesso)) {
    const erro = resultado.erro || resultado.error;
    throw new Error(typeof erro === "string" ? erro : "Não foi possível enviar o áudio.");
  }
}
