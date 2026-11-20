'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Vendedora IA genérica do Wolf (bloco Nicho com integracao "vendedora_ia").
// Tudo vem da configuração do bloco no construtor de fluxos: nicho, empresa,
// catálogo (manual, planilha do Google ou API), dados a coletar, links e avisos.
// Nenhum código por cliente. atendimento.cjs é recarregado a quente.
// ═══════════════════════════════════════════════════════════════════════
const fs = require('node:fs'), path = require('node:path');
const ARQ = path.join(__dirname, 'atendimento.cjs');
let assinatura = '', criado = null;
function carregar(deps) {
  const atual = String((() => { try { return fs.statSync(ARQ).mtimeMs; } catch { return 0; } })());
  if (atual !== assinatura || !criado) {
    try { delete require.cache[ARQ]; criado = require(ARQ)(deps); if (assinatura) console.log('[VendedoraIA] recarregada'); assinatura = atual; }
    catch (e) { console.error('[VendedoraIA] recarga falhou, mantendo a anterior:', e.message); if (!criado) throw e; assinatura = atual; }
  }
  return criado;
}
module.exports = function instalar(ctx) {
  if (ctx.vendedoraIA) return ctx.vendedoraIA;
  const anterior = ctx.processarUniversalNativo;
  if (typeof anterior !== 'function') throw Error('Motor universal nativo não encontrado');
  const log = (n, m) => console.log('[VendedoraIA ' + String(n).slice(-4) + '] ' + m);
  const deps = { ctx, log };
  ctx.processarUniversalNativo = (f, no, ...resto) => (no?.tipo === 'nicho_atendimento' && no.dados?.integracao === 'vendedora_ia')
    ? carregar(deps)(f, no, ...resto)
    : anterior(f, no, ...resto);
  console.log('[VendedoraIA] instalada');
  return ctx.vendedoraIA = { version: 'vendedora-ia-3' };
};
