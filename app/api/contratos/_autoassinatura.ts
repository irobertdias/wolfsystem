import { supabaseContratos } from "./_auth";

// Empresa que assina sozinha: a etapa "empresa" do envelope é concluída logo
// após a criação, usando o carimbo/assinatura cadastrado, e o link segue direto
// para o cliente. Configuração em assinatura_wolf_empresas
// (assinatura_automatica + carimbo_assinatura — migração 20261113).

export const OPCOES_EMPRESA_AUTOMATICA = { exigir_otp: false, facial: "nenhuma", exigir_documento_identidade: false };

export async function empresaAssinaSozinha(workspaceId: string, empresaId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseContratos.from("assinatura_wolf_empresas")
      .select("assinatura_automatica,carimbo_assinatura").eq("id", empresaId).eq("workspace_id", workspaceId).maybeSingle();
    if (error || !data) return null;
    const carimbo = String((data as any).carimbo_assinatura || "");
    return (data as any).assinatura_automatica === true && /^data:image\/png;base64,/.test(carimbo) ? carimbo : null;
  } catch { return null; } // coluna ainda não criada → comportamento antigo
}

/** Conclui a etapa da empresa com o carimbo. Nunca derruba a criação: devolve o erro em texto. */
export async function assinarEtapaEmpresa(backend: string, envelope: any, workspaceId: string, carimbo: string) {
  try {
    const empresa = (envelope?.signatarios || []).find((s: any) => s.papel === "empresa" && s.status === "pendente");
    if (!envelope?.id || !empresa?.id) return { ok: false, erro: "Etapa da empresa não encontrada" };
    const cab = { "Content-Type": "application/json", "X-Wolf-Signature-Proxy": process.env.WOLF_SIGNATURE_PROXY_SECRET || "" };
    const l = await fetch(`${backend}/assinaturas-wolf/envelopes/admin/${encodeURIComponent(envelope.id)}/signatarios/${encodeURIComponent(empresa.id)}/link`, {
      method: "POST", cache: "no-store", headers: cab, body: JSON.stringify({ workspace_id: workspaceId }),
    }).then((r) => r.json()).catch(() => null);
    const token = String(l?.link || "").split("/assinar/")[1]?.split(/[?#]/)[0];
    if (!token) return { ok: false, erro: l?.error || "Não foi possível obter o link da etapa da empresa" };
    const c = await fetch(`${backend}/assinaturas-wolf/envelopes/${encodeURIComponent(token)}/concluir`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "User-Agent": "Wolf System - assinatura automatica da empresa" },
      body: JSON.stringify({ aceite_contrato: true, aceite_assinatura_eletronica: true, aceite_selfie: true, assinatura: carimbo }),
    }).then((r) => r.json()).catch(() => null);
    if (!c?.success) return { ok: false, erro: c?.error || "A assinatura automática da empresa falhou" };
    return { ok: true, proximo: c.proximo || "Cliente/contratante" };
  } catch (e: any) {
    return { ok: false, erro: e?.message || "A assinatura automática da empresa falhou" };
  }
}
