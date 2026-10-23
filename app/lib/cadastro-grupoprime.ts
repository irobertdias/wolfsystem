export const CAMPOS_CADASTRO_GRUPOPRIME = [
  { nome: 'nome', label: 'Nome completo', tipo: 'nome', obrigatoria: true },
  { nome: 'cpf', label: 'CPF do titular', tipo: 'cpf', obrigatoria: true },
  { nome: 'data_nascimento', label: 'Data de nascimento', tipo: 'data', obrigatoria: true },
  { nome: 'nome_mae', label: 'Nome completo da mãe', tipo: 'nome', obrigatoria: true },
  { nome: 'endereco_completo', label: 'Endereço completo da instalação', tipo: 'texto', obrigatoria: true },
  { nome: 'cep', label: 'CEP da instalação', tipo: 'cep', obrigatoria: true },
  { nome: 'vencimento', label: 'Dia do vencimento da fatura', tipo: 'texto', obrigatoria: true },
  { nome: 'forma_pagamento', label: 'Forma de pagamento mensal', tipo: 'texto', obrigatoria: true },
  { nome: 'email', label: 'E-mail', tipo: 'email', obrigatoria: true },
  { nome: 'telefone1', label: 'Telefone de contato com WhatsApp (DDD e número)', tipo: 'telefone', obrigatoria: true },
  { nome: 'telefone2', label: 'Segundo telefone para ligação normal (DDD e número)', tipo: 'telefone', obrigatoria: true },
];

function telefone(valor: unknown) {
  const n = String(valor ?? '').replace(/\D/g, '');
  const local = n.length === 12 || n.length === 13 ? (n.startsWith('55') ? n.slice(2) : '') : n;
  return /^[1-9]\d[2-9]\d{7,8}$/.test(local) ? `55${local}` : '';
}

export function conferirCadastroGrupoPrime(vars: Record<string, unknown>) {
  const falhar = (): never => { throw Object.assign(new Error('Preencha e confirme novamente o cadastro completo antes dos documentos.'), { statusCode: 422 }); };
  const normalizar = (campo: string, valor: unknown) => {
    if (campo === 'cpf' || campo === 'cep') return String(valor ?? '').replace(/\D/g, '');
    if (campo.startsWith('telefone')) return telefone(valor);
    return String(valor ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  };
  let confirmado: Record<string, unknown>;
  try { confirmado = JSON.parse(String(vars.cadastro_confirmado || '')); } catch { return falhar(); }
  if (!confirmado || typeof confirmado !== 'object' || Array.isArray(confirmado)) falhar();
  for (const campo of [...CAMPOS_CADASTRO_GRUPOPRIME.map(c => c.nome), 'plano_interesse', 'tipo_pessoa']) {
    if (!normalizar(campo, vars[campo]) || normalizar(campo, vars[campo]) !== normalizar(campo, confirmado![campo])) falhar();
  }
  const email = String(vars.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) falhar();
  const telefone1 = telefone(vars.telefone1), telefone2 = telefone(vars.telefone2);
  if (!telefone1 || !telefone2 || telefone1 === telefone2) falhar();
  const vencimento = String(vars.vencimento ?? '').trim();
  if (!/^(?:[1-9]|[12]\d|3[01])$/.test(vencimento)) falhar();
  const forma_pagamento = String(vars.forma_pagamento ?? '').trim().toUpperCase();
  if (!['CARTAO', 'BOLETO', 'PIX'].includes(forma_pagamento)) falhar();
  return { email, telefone1, telefone2, vencimento, forma_pagamento };
}
