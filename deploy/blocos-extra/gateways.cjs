'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Gateways de pagamento do Wolf (token do próprio cliente; o dinheiro cai na conta dele).
//   criar({ gateway, token, valor, descricao, ref, horas }) → { id, link }
//   situacao({ gateway, token, id, ref })                   → { status: 'aprovado'|'recusado'|'pendente', metodo?, pagamento_id? }
// Mercado Pago (Checkout Pro), Asaas (link de pagamento) e Stripe (Checkout Session).
// ═══════════════════════════════════════════════════════════════════════
const NOMES = { mercadopago: 'Mercado Pago', asaas: 'Asaas', stripe: 'Stripe' };

async function json(url, opcoes) {
  const r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.message || j?.errors?.[0]?.description || j?.error?.message || `${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return j;
}

// ---------- Mercado Pago ----------
const mp = (token, metodo, caminho, corpo) => json('https://api.mercadopago.com' + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
async function mpCriar({ token, valor, descricao, ref, horas }) {
  const p = await mp(token, 'POST', '/checkout/preferences', {
    items: [{ title: descricao, quantity: 1, unit_price: Math.round(valor * 100) / 100, currency_id: 'BRL' }],
    external_reference: ref, date_of_expiration: new Date(Date.now() + horas * 3600_000).toISOString(),
  });
  return { id: ref, link: p.init_point };
}
async function mpSituacao({ token, ref }) {
  const j = await mp(token, 'GET', `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc&limit=10`);
  const l = j.results || [];
  const ok = l.find((p) => p.status === 'approved');
  if (ok) return { status: 'aprovado', metodo: ok.payment_type_id, pagamento_id: String(ok.id) };
  if (l.length && l.every((p) => ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(p.status))) return { status: 'recusado' };
  return { status: 'pendente' };
}

// ---------- Asaas ----------
const asaasBase = (token) => (/_hmlg_/.test(token) ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');
const asaas = (token, metodo, caminho, corpo) => json(asaasBase(token) + caminho, { method: metodo, headers: { access_token: token, 'Content-Type': 'application/json', 'User-Agent': 'WolfSystem' }, body: corpo ? JSON.stringify(corpo) : undefined });
async function asaasCriar({ token, valor, descricao, ref, horas }) {
  const l = await asaas(token, 'POST', '/paymentLinks', {
    name: descricao.slice(0, 100), description: ref, value: Math.round(valor * 100) / 100, billingType: 'UNDEFINED', chargeType: 'DETACHED',
    dueDateLimitDays: Math.max(1, Math.ceil(horas / 24)), maxInstallmentCount: 1, notificationEnabled: false,
  });
  return { id: l.id, link: l.url };
}
async function asaasSituacao({ token, id }) {
  const j = await asaas(token, 'GET', `/payments?paymentLink=${encodeURIComponent(id)}&limit=20`);
  const l = j.data || [];
  const ok = l.find((p) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status));
  if (ok) return { status: 'aprovado', metodo: ok.billingType, pagamento_id: ok.id };
  if (l.length && l.every((p) => ['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'REFUND_REQUESTED'].includes(p.status))) return { status: 'recusado' };
  return { status: 'pendente' };
}

// ---------- Stripe ----------
async function stripe(token, metodo, caminho, campos) {
  const corpo = campos ? new URLSearchParams(campos).toString() : undefined;
  return json('https://api.stripe.com/v1' + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo });
}
async function stripeCriar({ token, valor, descricao, ref, horas }) {
  const s = await stripe(token, 'POST', '/checkout/sessions', {
    mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'brl',
    'line_items[0][price_data][unit_amount]': String(Math.round(valor * 100)), 'line_items[0][price_data][product_data][name]': descricao.slice(0, 120),
    client_reference_id: ref, success_url: 'https://wolfgyn.com.br/pagamento-concluido', expires_at: String(Math.floor(Date.now() / 1000) + Math.min(24, Math.max(1, horas)) * 3600),
  });
  return { id: s.id, link: s.url };
}
async function stripeSituacao({ token, id }) {
  const s = await stripe(token, 'GET', `/checkout/sessions/${encodeURIComponent(id)}`);
  if (s.payment_status === 'paid') return { status: 'aprovado', metodo: 'card', pagamento_id: String(s.payment_intent || s.id) };
  if (s.status === 'expired') return { status: 'recusado' };
  return { status: 'pendente' };
}

const G = { mercadopago: [mpCriar, mpSituacao], asaas: [asaasCriar, asaasSituacao], stripe: [stripeCriar, stripeSituacao] };
const qual = (g) => (G[g] ? g : 'mercadopago');

async function criar({ gateway, token, valor, descricao, ref, horas = 48 }) {
  if (!String(token || '').trim()) throw Error(`falta o token do ${NOMES[qual(gateway)]}`);
  if (!(valor > 0)) throw Error('valor inválido');
  const r = await G[qual(gateway)][0]({ token: token.trim(), valor, descricao: descricao || 'Pagamento', ref, horas });
  if (!r.link) throw Error('o gateway não devolveu o link');
  return r;
}
async function situacao({ gateway, token, id, ref }) {
  return G[qual(gateway)][1]({ token: String(token || '').trim(), id: id || ref, ref: ref || id });
}

module.exports = { criar, situacao, NOMES };
