export async function exigirSuporteOpcoesAssinatura(backend: string) {
  const response = await fetch(`${backend}/assinaturas-wolf/admin/capacidades`, {
    cache: "no-store",
    headers: { "X-Wolf-Signature-Proxy": process.env.WOLF_SIGNATURE_PROXY_SECRET || "" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.opcoes_assinatura !== true) {
    throw Object.assign(new Error("Atualize o backend de contratos para utilizar as etapas de assinatura por participante."), { statusCode: 503 });
  }
}
