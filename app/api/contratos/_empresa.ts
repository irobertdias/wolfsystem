import { supabaseContratos } from "./_auth";
export async function validarEmpresaRepresentante(workspaceId: string, empresaId: string, representanteId: string) {
  if (!representanteId) throw Object.assign(new Error("Escolha o representante da empresa"), { statusCode: 400 });
  const { data: representante, error } = await supabaseContratos.from("assinatura_wolf_representantes")
    .select("id,empresa_id").eq("id", representanteId).eq("workspace_id", workspaceId).eq("ativo", true).maybeSingle();
  if (error) throw error;
  if (!representante || (empresaId && representante.empresa_id !== empresaId)) {
    throw Object.assign(new Error("O representante não pertence à empresa selecionada neste workspace"), { statusCode: 400 });
  }
  const { data: empresa, error: erroEmpresa } = await supabaseContratos.from("assinatura_wolf_empresas")
    .select("id").eq("id", representante.empresa_id).eq("workspace_id", workspaceId).eq("ativa", true).maybeSingle();
  if (erroEmpresa) throw erroEmpresa;
  if (!empresa) throw Object.assign(new Error("Empresa não encontrada neste workspace"), { statusCode: 400 });
  return empresa.id as string;
}
