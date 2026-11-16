'use strict';
// Instala a Vendedora IA das lojas por cima do motor universal (integração "loja_sistema"
// do bloco Nicho). Os outros nichos e a vendedora da Claro seguem pelo `previous`.
// atendimento.cjs é recarregado quando muda, sem reiniciar o WhatsApp.
const fs = require('node:fs'), path = require('node:path');
const ARQ = path.join(__dirname, 'atendimento.cjs');
let assinatura = '', criado = null;
function carregar(deps) {
  const atual = String((() => { try { return fs.statSync(ARQ).mtimeMs; } catch { return 0; } })());
  if (atual !== assinatura || !criado) {
    try { delete require.cache[ARQ]; criado = require(ARQ)(deps); if (assinatura) console.log('[LojaIA] recarregado'); assinatura = atual; }
    catch (e) { console.error('[LojaIA] recarga falhou, mantendo versão anterior:', e.message); if (!criado) throw e; assinatura = atual; }
  }
  return criado;
}
module.exports = function instalar(ctx) {
  if (ctx.lojaIA) return ctx.lojaIA;
  const previous = ctx.processarUniversalNativo;
  if (typeof previous !== 'function') throw Error('Motor universal nativo não encontrado');
  const log = (n, m) => console.log('[LojaIA ' + String(n).slice(-4) + '] ' + m);
  const deps = { ctx, log, previous };
  ctx.processarUniversalNativo = (...args) => carregar(deps)(...args);
  return ctx.lojaIA = { version: 'loja-ia-1', previous };
};
