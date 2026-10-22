"use strict";
function prazo(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("WhatsApp nao confirmou a resposta"), { envioIncerto: true })), ms); })]).finally(() => clearTimeout(timer));
}
function normalizarIdResposta(valor, canalId) {
  const id = String(valor || "").trim();
  const interno = id.match(/^webjs:(\d+):(.+)$/);
  if (!interno) return id;
  if (canalId != null && Number(interno[1]) !== Number(canalId)) throw Object.assign(new Error("A referencia da mensagem original pertence a outro canal"), { statusCode: 400 });
  return interno[2];
}
async function buscarMensagemRespondida(ctx, id, workspaceId, canalId, numero) {
  if (id == null) return null;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw Object.assign(new Error("Mensagem original invalida"), { statusCode: 400 });
  const variantes = ctx.variantesNumeroAtendimento ? ctx.variantesNumeroAtendimento(numero) : [numero];
  const { data, error } = await ctx.supabase.from("mensagens").select("id,provider_message_id,mensagem,de,created_at")
    .eq("id", Number(id)).eq("workspace_id", workspaceId).eq("canal_id", canalId).in("numero", variantes).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Mensagem original nao pertence a esta conversa"), { statusCode: 400 });
  if (!data.provider_message_id) throw Object.assign(new Error("Esta mensagem antiga nao possui identificador do WhatsApp para responder"), { statusCode: 400 });
  return { ...data, provider_message_id: normalizarIdResposta(data.provider_message_id, canalId) };
}
function partesChave(id) {
  const match = String(id || "").match(/^(true|false)_(\d{8,20}@(c\.us|lid))_([^_\s]+)(?:_([^_\s]+))?$/);
  return match ? { autoria: match[1], remoto: match[2], stanza: match[4], participante: match[5] || "" } : null;
}
// citacaoRecuperacaoV6: recuperação isolada e limitada à conversa solicitada.
async function recuperarMensagemCitacao(...args){return require("./citacao-recuperacao.js")(...args);}
async function enviarRespostaWebjs(ctx, client, numero, mensagem, quotedMessageId) {
  quotedMessageId = normalizarIdResposta(quotedMessageId);
  const limiteEnvio = Date.now() + 45000;
  const enviar = (destino, options) => {
    const restante = limiteEnvio - Date.now();
    if (restante <= 0) throw new Error("A recuperacao da mensagem original excedeu o prazo. Tente novamente.");
    return prazo(client.sendMessage(destino, mensagem, options), Math.min(20000, restante));
  };
  let destino;
  const remote = String(quotedMessageId).match(/^(?:true|false)_(\d{8,20}@(c\.us|lid))_/ )?.[1];
  if (remote && ctx.registrarDestinoConversaWebjs) ctx.registrarDestinoConversaWebjs(client, numero, remote);
  if (ctx.resolverDestinoWebjs) destino = (await ctx.resolverDestinoWebjs(client, numero, { timeoutMs: 8000 })).jid;
  else destino = (await prazo(client.getNumberId(numero), 8000))?._serialized;
  if (!destino) throw new Error("Nao foi possivel resolver o destinatario da resposta");
  const citacao = await recuperarMensagemCitacao(client, numero, quotedMessageId, destino, false, limiteEnvio);
  destino = citacao.destino;
  const options = { quotedMessageId: citacao.id, ignoreQuoteErrors: false };
  const confirmar = enviada => {
    if (enviada?.hasQuotedMsg !== true) throw Object.assign(new Error("O WhatsApp nao confirmou a citacao. Confira a conversa antes de reenviar para evitar duplicidade."), { envioIncerto: true });
    return enviada;
  };
  try { return confirmar(await enviar(destino, options)); }
  catch (error) {
    if (/could not get the quoted message/i.test(error.message || "")) {
      const recuperada = await recuperarMensagemCitacao(client, numero, quotedMessageId, destino, true, limiteEnvio);
      try { return confirmar(await enviar(recuperada.destino, { ...options, quotedMessageId: recuperada.id })); }
      catch (falha) {
        if (/could not get the quoted message/i.test(falha.message || "")) throw Object.assign(new Error("Nao foi possivel carregar a mensagem original no WhatsApp. Cancele a resposta ou escolha outra mensagem."), { statusCode: 409 });
        throw falha;
      }
    }
    if (!/no lid|lid is missing|chat table/i.test(error.message || "") || typeof client.getContactLidAndPhone !== "function") throw error;
    const mappings = await prazo(client.getContactLidAndPhone([numero + "@c.us"]), 8000);
    const novoDestino = mappings?.[0]?.lid || mappings?.[0]?.pn;
    if (!/^\d{8,20}@(lid|c\.us)$/.test(novoDestino || "")) throw error;
    const recuperada = await recuperarMensagemCitacao(client, numero, quotedMessageId, novoDestino, false, limiteEnvio);
    return confirmar(await prazo(client.sendMessage(recuperada.destino, mensagem, { ...options, quotedMessageId: recuperada.id }), 20000));
  }
}
async function enviarRespostaWaba(config, numero, mensagem, messageId) {
  const response = await fetch("https://graph.facebook.com/v19.0/" + config.phone_number_id + "/messages", {
    method: "POST", signal: AbortSignal.timeout(20000), headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: numero, type: "text", text: { body: mensagem }, context: { message_id: messageId } })
  });
  const data = await response.json();
  if (!response.ok || data.error || !data.messages?.[0]?.id) throw new Error(data.error?.message || "WhatsApp nao confirmou a resposta");
  return data;
}
function validarFormatoResposta(mensagem, responderMensagemId) {
  if (responderMensagemId == null && /^\u21aa\ufe0f? \*[^*]+\*: "/.test(String(mensagem || ""))) {
    throw Object.assign(new Error("Esta aba ainda usa a resposta antiga. Atualize a pagina com Ctrl + F5 e selecione novamente a mensagem para responder."), { statusCode: 409 });
  }
}
function textoHistoricoResposta(original, mensagem) {
  if (!original) return mensagem;
  const autor = original.de === "cliente" ? "Cliente" : original.de === "bot" ? "BOT" : "Atendente";
  const texto = String(original.mensagem || "").replace(/^\*[^*]+\*\n/, "").slice(0, 100);
  return "\u21aa\ufe0f *" + autor + '*: "' + texto + '"\n\n' + mensagem;
}
module.exports = { normalizarIdResposta, recuperarMensagemCitacao, validarFormatoResposta, buscarMensagemRespondida, enviarRespostaWebjs, enviarRespostaWaba, textoHistoricoResposta };
