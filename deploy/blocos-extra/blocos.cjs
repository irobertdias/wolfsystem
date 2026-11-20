'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Blocos do construtor que antes não faziam nada (recarregado a quente).
//  • input_pagamento: gera o link do Mercado Pago (token do próprio cliente), manda ao
//    cliente e espera o pagamento. Saída 0 = Aprovado, saída 1 = Recusado / não pago.
//    A confirmação vem quando o cliente responde ("paguei") ou sozinha, pela checagem
//    automática a cada minuto (index.cjs → verificarPendentes).
//  • invalido: envia a mensagem configurada e segue para o próximo bloco.
// ═══════════════════════════════════════════════════════════════════════
const so = (v) => String(v || '').replace(/\D/g, '');
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => { if (typeof v === 'number') return v; const n = Number(String(v || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

const path = require('node:path');
/** Gateways (Mercado Pago, Asaas, Stripe), relido a cada uso para seguir o arquivo atualizado. */
const gw = () => { const a = path.join(__dirname, 'gateways.cjs'); delete require.cache[a]; return require(a); };
/** Gateway pelo formato do token (Asaas: $aact_…, Stripe: sk_/rk_…, senão Mercado Pago). */
const gatewayDoToken = (t) => (/^\$?aact_/.test(String(t).trim()) ? 'asaas' : /^(sk|rk)_/.test(String(t).trim()) ? 'stripe' : 'mercadopago');
/** Situação de uma cobrança: 'aprovado' | 'recusado' | 'pendente'.
 *  Formato curto (token, ref) usado pela checagem automática: ref = "wolf-…" (Mercado Pago) ou "wolf-…|id" (Asaas/Stripe). */
async function situacao(a, b) {
  if (typeof a !== 'string') return gw().situacao(a);
  const [ref, id] = String(b || '').split('|');
  return gw().situacao({ gateway: gatewayDoToken(a), token: a, ref, id: id || ref });
}
const DESISTIU = /\b(cancel|desist|n[aã]o vou (mais )?pagar|n[aã]o quero mais|deixa (pra|para) l[aá])/i;

async function pagamento({ fluxo, no, d, variaveis, mensagemCliente, processarInput, fnEnviar, ctx, proximoNo, substituirVariaveis }) {
  const chave = '__pagamento_' + no.id;
  const est = (() => { try { return JSON.parse(variaveis[chave] || '{}'); } catch { return {}; } })();
  const salvar = () => { variaveis[chave] = JSON.stringify(est); };
  const saida = (i) => ({ proximoNoId: proximoNo(fluxo, no.id, i)?.id || null });
  const token = String(d.access_token || '').trim();
  const gateway = d.gateway || gatewayDoToken(token);

  if (!processarInput || !est.ref) {
    const valor = numero(substituirVariaveis(String(d.valor ?? ''), variaveis));
    if (!token) { console.error('[Pagamento] bloco sem token do gateway'); await fnEnviar(substituirVariaveis(d.mensagem_erro || 'Não consegui gerar o pagamento agora. Um atendente vai te ajudar. 🙏', variaveis)); return saida(1); }
    if (!(valor > 0)) { console.error('[Pagamento] valor inválido:', d.valor); await fnEnviar(substituirVariaveis(d.mensagem_erro || 'Não consegui gerar o pagamento agora. Um atendente vai te ajudar. 🙏', variaveis)); return saida(1); }
    const descricao = substituirVariaveis(String(d.descricao || 'Pagamento'), variaveis).slice(0, 120) || 'Pagamento';
    est.ref = `wolf-${ctx?.workspaceId || 'ws'}-${so(ctx?.numero)}-${Date.now().toString(36)}`;
    est.valor = valor; est.tentativas = 0; est.criado = new Date().toISOString(); est.gateway = gateway;
    try {
      const c = await gw().criar({ gateway, token, valor, descricao, ref: est.ref, horas: Math.max(1, Number(d.validade_horas) || 48) });
      est.link = c.link; est.id = c.id;
      if (gateway !== 'mercadopago') est.ref = `${est.ref}|${c.id}`; // a checagem automática acha o id por aqui
    } catch (e) {
      console.error('[Pagamento] criar link:', e.message);
      await fnEnviar(substituirVariaveis(d.mensagem_erro || 'Não consegui gerar o pagamento agora. Um atendente vai te ajudar. 🙏', variaveis));
      delete est.ref; salvar(); return saida(1);
    }
    variaveis.pagamento_link = est.link; variaveis.pagamento_valor = brl(valor); variaveis.pagamento_ref = est.ref; variaveis.pagamento_status = 'pendente';
    if (d.variavel) variaveis[d.variavel] = est.link;
    salvar();
    const msg = substituirVariaveis(d.mensagem || '💳 Para finalizar, pague *{{pagamento_valor}}* por este link (Pix ou cartão):\n{{pagamento_link}}\n\nAssim que o pagamento for aprovado, eu te aviso por aqui. 😊', variaveis);
    if (!msg.includes(est.link)) await fnEnviar(msg + '\n' + est.link); else await fnEnviar(msg);
    return { aguardarInput: true };
  }

  // Cliente respondeu (ou checagem automática): confere no Mercado Pago.
  let s = { status: 'pendente' };
  try { s = await situacao({ gateway: est.gateway || gateway, token, id: est.id, ref: String(est.ref).split('|')[0] }); } catch (e) { console.error('[Pagamento] consultar:', e.message); }
  if (s.status === 'aprovado') {
    variaveis.pagamento_status = 'aprovado'; variaveis.pagamento_id = String(s.pagamento_id || ''); variaveis.pagamento_metodo = String(s.metodo || '');
    est.aprovado = new Date().toISOString(); salvar();
    const ok = substituirVariaveis(d.mensagem_aprovado || '✅ Pagamento de {{pagamento_valor}} aprovado! Obrigado. 💚', variaveis);
    if (ok) await fnEnviar(ok);
    return saida(0);
  }
  const texto = String(mensagemCliente || '');
  est.tentativas = (est.tentativas || 0) + (texto.trim() ? 1 : 0); salvar();
  const limite = Math.max(1, Number(d.tentativas) || 4);
  if (s.status === 'recusado' || DESISTIU.test(texto) || est.tentativas >= limite) {
    variaveis.pagamento_status = s.status === 'recusado' ? 'recusado' : 'nao_pago'; salvar();
    const nao = substituirVariaveis(d.mensagem_recusado || '', variaveis);
    if (nao) await fnEnviar(nao);
    return saida(1);
  }
  if (texto.trim()) await fnEnviar(substituirVariaveis(d.mensagem_aguardando || 'Ainda não identifiquei o pagamento. 🙏 Se já pagou, aguarde alguns instantes (Pix costuma cair na hora). O link continua valendo:\n{{pagamento_link}}', variaveis));
  return { aguardarInput: true };
}

async function invalido({ fluxo, no, d, variaveis, fnEnviar, proximoNo, substituirVariaveis }) {
  const msg = substituirVariaveis(String(d.mensagem || ''), variaveis);
  if (msg) await fnEnviar(msg);
  return { proximoNoId: proximoNo(fluxo, no.id, 0)?.id || null };
}

/** Mensagem personalizada para resposta inválida: a do bloco "Inválido" do fluxo, se houver. */
function mensagemInvalida(fluxo, variaveis, motivo, tentativas, substituirVariaveis) {
  const inv = (fluxo?.nos || []).find((n) => n.tipo === 'invalido' && String(n.dados?.mensagem || '').trim());
  if (!inv) return null;
  const base = substituirVariaveis(String(inv.dados.mensagem), variaveis || {});
  return `${base}${motivo ? `\n${motivo}` : ''}${tentativas >= 3 ? '\n\nSe preferir, digite "atendente" para falar com uma pessoa.' : ''}`;
}

// Mesmas regras do executor de fluxos (routes/fluxos.js).
function substituirVariaveis(texto, variaveis) {
  if (!texto) return '';
  return String(texto).replace(/\{\{(\w+)\}\}/g, (m, nome) => {
    if (variaveis[nome] !== undefined && variaveis[nome] !== null) return String(variaveis[nome]);
    if (nome === 'data') return new Date().toISOString().slice(0, 10);
    if (nome === 'hora') return new Date().toTimeString().slice(0, 5);
    return m;
  });
}
function proximoNo(fluxo, noAtualId, saidaIndex) {
  const c = (fluxo.conexoes || []).find((x) => x.de === noAtualId && Number(x.saidaIndex || 0) === saidaIndex);
  return c ? (fluxo.nos || []).find((n) => n.id === c.para) || null : null;
}
/** Chamado pelo gancho processarUniversalNativo (mesma assinatura de processarNo). */
function executarNo(fluxo, no, variaveis, mensagemCliente, processarInput, fnEnviar, ctx) {
  const args = { fluxo, no, d: no.dados || {}, variaveis, mensagemCliente, processarInput, fnEnviar, ctx, proximoNo, substituirVariaveis };
  return no.tipo === 'input_pagamento' ? pagamento(args) : invalido(args);
}

/** Cria cobrança (usado pela Vendedora IA). */
const cobrar = (o) => gw().criar({ ...o, gateway: o.gateway || gatewayDoToken(o.token) });

module.exports = { executarNo, mensagemInvalida, situacao, substituirVariaveis, cobrar, gatewayDoToken };
