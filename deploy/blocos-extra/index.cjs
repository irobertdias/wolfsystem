'use strict';
// Blocos extras do construtor (Pagamento e Inválido), recarregados a quente.
// O executor de fluxos passa todo bloco por ctx.processarUniversalNativo; a loja-ia
// (recarregada a quente) repassa input_pagamento e invalido para ctx.blocosExtra.executarNo.
// A cada minuto confere pagamentos pendentes no Mercado Pago e, aprovado, continua o fluxo.
const fs = require('node:fs'), path = require('node:path');
const ARQ = path.join(__dirname, 'blocos.cjs');
let assinatura = '', mod = null;
function blocos() {
  const atual = String((() => { try { return fs.statSync(ARQ).mtimeMs; } catch { return 0; } })());
  if (atual !== assinatura || !mod) {
    try { delete require.cache[ARQ]; mod = require(ARQ); if (assinatura) console.log('[BlocosExtra] recarregado'); assinatura = atual; }
    catch (e) { console.error('[BlocosExtra] recarga falhou, mantendo a anterior:', e.message); if (!mod) throw e; assinatura = atual; }
  }
  return mod;
}
module.exports = function instalar(ctx) {
  if (ctx.blocosExtra) return ctx.blocosExtra;
  const db = ctx.supabase;
  let rodando = false;
  async function verificarPendentes() {
    if (rodando || typeof ctx.executarFluxo !== 'function') return; rodando = true;
    try {
      const r = await db.from('fluxo_sessoes').select('*').eq('status', 'ativo').eq('tipo_input_aguardado', 'input_pagamento').limit(200);
      if (r.error) throw r.error;
      const fluxos = new Map();
      for (const row of r.data || []) {
        try {
          if (Date.now() - Date.parse(row.updated_at) > 7 * 86400_000) continue; // link vencido há muito tempo
          const k = row.workspace_id + ':' + row.fluxo_id;
          if (!fluxos.has(k)) { const f = await db.from('fluxos').select('id,nos').eq('id', row.fluxo_id).limit(1); fluxos.set(k, f.data?.[0]); }
          const no = fluxos.get(k)?.nos?.find((n) => n.id === row.no_atual && n.tipo === 'input_pagamento');
          const est = (() => { try { return JSON.parse(row.variaveis?.['__pagamento_' + row.no_atual] || '{}'); } catch { return {}; } })();
          const token = String(no?.dados?.access_token || '').trim();
          if (!no || !est.ref || !token) continue;
          const s = await blocos().situacao(token, est.ref);
          if (s.status === 'pendente') continue;
          const c = await ctx.getConfigCanal(row.canal_id), sessao = ctx.sessoes?.[String(row.canal_id)];
          if (c?.workspaceId !== row.workspace_id) continue;
          const enviar = async (m) => {
            let id = null;
            if (c.tipo === 'waba' && typeof ctx.enviarMensagemWaba === 'function') { const x = await ctx.enviarMensagemWaba(c, row.numero, m); id = x?.messages?.[0]?.id || null; }
            else {
              if (sessao?.status !== 'conectado') throw Error('canal desconectado');
              const x = await (typeof ctx.enviarTextoWebjs === 'function' ? ctx.enviarTextoWebjs(sessao.client, row.numero, m) : require('../bko-roteamento.js').enviar(sessao.client, row.numero, m));
              if (x?.success === false) throw Error(x.error || 'envio não confirmado');
              id = x?.id?._serialized || x?.messageId || null;
            }
            await ctx.salvarMensagem?.(row.workspace_id, row.canal_id, c.fila, row.numero, m, 'bot', 'BOT', id);
          };
          console.log(`[BlocosExtra] pagamento ${s.status} ${row.workspace_id}/${String(row.numero).slice(-4)}: continuando o fluxo`);
          await ctx.executarFluxo(row.workspace_id, row.canal_id, row.numero, '', enviar, row.fluxo_id);
        } catch (e) { console.error('[BlocosExtra] pendente:', e.message); }
      }
    } catch (e) { console.error('[BlocosExtra] verificar:', e.message); }
    finally { rodando = false; }
  }
  setInterval(verificarPendentes, 60000).unref?.();
  console.log('[BlocosExtra] instalado');
  return ctx.blocosExtra = {
    executarNo: (...a) => blocos().executarNo(...a),
    mensagemInvalida: (...a) => blocos().mensagemInvalida(...a),
    verificarPendentes,
  };
};
