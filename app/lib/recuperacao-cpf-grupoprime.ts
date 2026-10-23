

export function normalizarCpf(valor: unknown) { return typeof valor === 'string' ? valor.replace(/\D/g, '') : ''; }
export function cpfValido(valor: unknown) {
  if (typeof valor !== 'string' || !/^[\d.\-\s]+$/.test(valor)) return false;
  const cpf = normalizarCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let pos = 9; pos <= 10; pos++) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += Number(cpf[i]) * (pos + 1 - i);
    const digito = (soma * 10) % 11;
    if ((digito === 10 ? 0 : digito) !== Number(cpf[pos])) return false;
  }
  return true;
}

export function normalizarStatus(valor: unknown) { return String(valor || '').trim().toUpperCase().replace(/\s+/g, ' '); }
export function dataNascimentoISO(valor: unknown) {
  if (typeof valor !== 'string') return null;
  const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/) || valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return null;
  const [ano, mes, dia] = partes[1].length === 4 ? partes.slice(1).map(Number) : [Number(partes[3]), Number(partes[2]), Number(partes[1])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (ano < 1900 || data > new Date() || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function validarRecuperacaoCpf(body: Record<string, unknown>) {
  const falhar = (message: string) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!Number.isSafeInteger(Number(body.proposta_id)) || Number(body.proposta_id) <= 0) falhar('Venda inválida.');
  if (!cpfValido(body.cpf_novo)) falhar('Informe um novo CPF válido.');
  const anterior = normalizarCpf(body.cpf_reprovado);
  if (anterior.length !== 11 || anterior === normalizarCpf(body.cpf_novo)) falhar('O CPF deve ser diferente do CPF reprovado.');
  const nome = typeof body.nome_novo_titular === 'string' ? body.nome_novo_titular.trim() : '';
  const mae = typeof body.nome_mae_novo_titular === 'string' ? body.nome_mae_novo_titular.trim() : '';
  if (nome.length < 5 || nome.length > 200 || !nome.includes(' ')) falhar('Informe o nome completo do novo titular.');
  if (mae.length < 5 || mae.length > 200 || !mae.includes(' ')) falhar('Informe o nome completo da mãe do novo titular.');
  const nascimento = dataNascimentoISO(body.nascimento_novo_titular);
  if (!nascimento) falhar('Informe a data de nascimento válida do novo titular.');
  if (normalizarStatus(body.autorizacao_novo_titular) !== 'SIM') falhar('Confirme a autorização do novo titular para o cadastro.');
  return { propostaId: Number(body.proposta_id), anterior, cpf: normalizarCpf(body.cpf_novo), nome, mae, nascimento };
}
