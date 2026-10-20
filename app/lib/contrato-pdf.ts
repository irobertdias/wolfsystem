export function nomePdfAssinado(nome: string) {
  const base = String(nome || "contrato").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|\r\n]/g, "_");
  return `assinado_${base}.pdf`;
}

export async function lerPdfAssinado(response: Response): Promise<Blob> {
  if (!response.ok) {
    const erro = await response.json().catch(() => ({}));
    throw new Error(erro.error || "Não foi possível abrir o contrato assinado.");
  }
  const arquivo = await response.blob();
  const prefixo = await arquivo.slice(0, 5).text();
  if (prefixo !== "%PDF-") throw new Error("O servidor não retornou um PDF válido. Tente novamente.");
  return arquivo.type === "application/pdf" ? arquivo : new Blob([arquivo], { type: "application/pdf" });
}
