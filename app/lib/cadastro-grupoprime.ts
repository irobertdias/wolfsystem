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

export function blocosCadastroGrupoPrime(apiKey: string) {
  const campos = [...CAMPOS_CADASTRO_GRUPOPRIME.map(c => c.nome), 'plano_interesse', 'tipo_pessoa'];
  return {
    nos: [
      { id: 'prime_cadastro_preparar', tipo: 'script', x: 200, y: 1220, saidas: ['Próximo'], dados: { codigo: `
delete variaveis.cadastro_confirmado;
delete variaveis.cadastro_valido;
delete variaveis.cadastro_pendencias;
delete variaveis.__fluxo_ia_prime_cadastro_ia;
setVariable('endereco_proposto', variaveis.endereco_completo || variaveis.endereco_proposto || '');
delete variaveis.endereco_completo;
return true;` } },
      { id: 'prime_cadastro_ia', tipo: 'fluxo_ia', x: 200, y: 1440, saidas: ['Dados confirmados', 'Erro', 'Limite de recusas atingido', 'Limite de lembretes atingido'], dados: {
        apiKey, modelo: 'gpt-4o-mini', agrupamento_ms: 3500, limite_recusas: 3,
        mensagem_inicial_literal: false,
        prompt: `Você é o assistente da Grupo Prime. O cliente já escolheu o plano. Agora complete o CADASTRO antes de pedir qualquer documento.
Colete, nessa ordem, os dados ainda faltantes: nome completo, CPF, data de nascimento, nome completo da mãe, confirmação do endereço já informado, dia do vencimento, forma de pagamento, e-mail, telefone com WhatsApp e segundo telefone para ligação normal. Uma pergunta por vez. Aproveite os dados já informados; não invente ou substitua por dados do contato.
Para confirmar novamente o endereço, apresente o endereço proposto: {{endereco_proposto}}. Pergunte se está correto. Somente após a resposta do cliente salve endereco_completo com o endereço por extenso (nunca salve apenas “sim”). Se houver correção, grave o endereço corrigido. Mantenha o CEP coerente; divergência de cidade/CEP deve ser conferida pela equipe antes de seguir.
Peça DOIS números diferentes, ambos com DDD: telefone1 é WhatsApp; telefone2 é para ligação normal. O número real desta conversa é {{numero}}, fornecido pelo sistema. Não use o telefone do canal da empresa como telefone do cliente. Não presuma que o número desta conversa seja um dos contatos sem confirmar com o cliente.
Ao perguntar pelo WhatsApp, se o cliente responder “esse mesmo”, “esse aqui”, “o que estou usando”, “este número” ou equivalente, reconheça a referência ao número real desta conversa. Se {{numero}} contiver um telefone válido, apresente esse número com DDD e pergunte: “Confirma que posso cadastrar este WhatsApp: [número desta conversa]?”. Depois do sim, salve telefone1 com os dígitos do número real. Nunca salve “esse mesmo”, “sim” ou o texto de um marcador como telefone. Não invente dígitos, não acrescente o nono dígito por conta própria e não peça para redigitar o número que já está disponível. Se o cliente já confirmou explicitamente esse número por extenso, aproveite a confirmação. Se o número real estiver ausente ou não for um telefone válido, peça DDD e número. Se corrigir o contato, registre o número que ele informou.
Depois de confirmar o WhatsApp, peça o segundo telefone para ligação normal. Se disser “o mesmo” nessa etapa, explique brevemente que é necessário outro número e peça somente o contato alternativo; não sobrescreva telefone1 nem reinicie o cadastro.
O vencimento pode ser qualquer dia de 1 a 31. Salve só o número, sem data/mês/ano. Explique que a operadora confirma o calendário da cobrança. Pagamento: cartão de crédito, boleto ou PIX; salve CARTAO, BOLETO ou PIX. Nunca peça dados do cartão, senha ou pagamento antecipado.
Não peça RG, comprovante, foto nem arquivo nesta fase. Quando TODOS os dados estiverem preenchidos, o sistema mostrará o resumo completo e pedirá confirmação. Se o cliente corrigir qualquer item, altere só o que pediu, preserve o restante e apresente o resumo completo novamente. Só avance depois da confirmação explícita do resumo corrigido. Um “sim” durante a coleta ou a confirmação isolada do endereço não confirma o cadastro inteiro.
Não diga que o pedido foi enviado, aprovado ou que a instalação está marcada. Após confirmar o cadastro, a próxima etapa pedirá RG frente, RG verso e comprovante de endereço para encaminhar o pedido à auditoria.`,
        variaveis: CAMPOS_CADASTRO_GRUPOPRIME,
        followups_extensao_ativa: false, reengajamento_ativo: false,
      } },
      { id: 'prime_cadastro_confirmado', tipo: 'script', x: 200, y: 1660, saidas: ['Próximo'], dados: {
        codigo: `const campos = ${JSON.stringify(campos)};
delete variaveis.cadastro_confirmado;
const invalidos = campos.filter(c => !String(variaveis[c] || '').trim());
const telefone = valor => { const n = String(valor || '').replace(/\\D/g, ''); const local = n.length === 12 || n.length === 13 ? (n.startsWith('55') ? n.slice(2) : '') : n; return /^[1-9]\\d[2-9]\\d{7,8}$/.test(local) ? '55' + local : ''; };
if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(variaveis.email || '').trim())) invalidos.push('email');
if (!telefone(variaveis.telefone1)) invalidos.push('telefone1');
if (!telefone(variaveis.telefone2) || telefone(variaveis.telefone1) === telefone(variaveis.telefone2)) invalidos.push('telefone2');
if (!/^(?:[1-9]|[12]\\d|3[01])$/.test(String(variaveis.vencimento || '').trim())) invalidos.push('vencimento');
if (!['CARTAO','BOLETO','PIX'].includes(String(variaveis.forma_pagamento || '').trim().toUpperCase())) invalidos.push('forma_pagamento');
for (const campo of invalidos) delete variaveis[campo];
setVariable('cadastro_valido', invalidos.length ? 'NAO' : 'SIM');
if (!invalidos.length) setVariable('cadastro_confirmado', JSON.stringify(Object.fromEntries(campos.map(c => [c, String(variaveis[c] || '')]))));
return true;`,
      } },
      { id: 'prime_cadastro_liberado', tipo: 'condicao', x: 200, y: 1880, saidas: ['Sim', 'Não'], dados: { variavel: 'cadastro_valido', operador: 'igual', valor: 'SIM' } },
    ],
    conexoes: [
      { id: 'prime_cadastro_entrada', de: 'prime_cadastro_preparar', saidaIndex: 0, para: 'prime_cadastro_ia' },
      ...[0, 1, 2, 3].map(saidaIndex => ({ id: `prime_cadastro_saida_${saidaIndex}`, de: 'prime_cadastro_ia', saidaIndex, para: saidaIndex === 0 ? 'prime_cadastro_confirmado' : 'prime_humano' })),
      { id: 'prime_cadastro_validar', de: 'prime_cadastro_confirmado', saidaIndex: 0, para: 'prime_cadastro_liberado' },
      { id: 'prime_cadastro_documentos', de: 'prime_cadastro_liberado', saidaIndex: 0, para: 'prime_documentos_preparar' },
      { id: 'prime_cadastro_corrigir', de: 'prime_cadastro_liberado', saidaIndex: 1, para: 'prime_cadastro_ia' },
    ],
  };
}
