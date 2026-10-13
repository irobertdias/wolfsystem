export type RepresentanteEmpresa = {
  id?: string; empresa_id?: string; nome: string; cpf?: string; cargo: string;
  email: string; numero: string; padrao: boolean;
};
export type EmpresaContrato = {
  id: string; razao_social: string; nome_fantasia?: string; cnpj: string;
  endereco_completo: string; email: string; telefone?: string;
  representantes: RepresentanteEmpresa[];
};
export function representantePadrao(empresa?: EmpresaContrato) {
  return empresa?.representantes.find(r => r.padrao) || empresa?.representantes[0];
}
export function empresaDoContrato(empresas: EmpresaContrato[], snapshot?: { empresa_id?: string; representante_id?: string }) {
  return empresas.find(e => e.id === snapshot?.empresa_id);
}
export function validarCadastroEmpresa(empresa: Record<string, unknown>, representantes: RepresentanteEmpresa[]) {
  const digitos = (v: unknown) => String(v || "").replace(/\D/g, "");
  const email = (v: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  if (String(empresa.razao_social || "").trim().length < 3 || digitos(empresa.cnpj).length !== 14 || String(empresa.endereco_completo || "").trim().length < 10 || !email(empresa.email)) {
    throw Object.assign(new Error("Informe razão social, CNPJ, e-mail e endereço completo da empresa"), { statusCode: 400 });
  }
  if (!representantes.length) throw Object.assign(new Error("Cadastre ao menos um representante"), { statusCode: 400 });
  const vistos = new Set<string>();
  representantes.forEach((r, i) => {
    if (!r || typeof r !== "object") throw Object.assign(new Error(`Revise os dados do representante ${i + 1}`), { statusCode: 400 });
    if (String(r.nome || "").trim().length < 3 || digitos(r.cpf).length !== 11 || String(r.cargo || "").trim().length < 2 || digitos(r.numero).length < 10 || !email(r.email)) {
      throw Object.assign(new Error(`Revise os dados do representante ${i + 1}`), { statusCode: 400 });
    }
    if (r.id && vistos.has(String(r.id).toLowerCase())) throw Object.assign(new Error("Representante duplicado"), { statusCode: 400 });
    if (r.id) vistos.add(String(r.id).toLowerCase());
  });
}

export function formatarCnpj(cnpj: string) {
  const digitos = String(cnpj || "").replace(/\D/g, "");
  return digitos.length === 14 ? digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : cnpj;
}
