// ═══════════════════════════════════════════════════════════════════════
// 🌐 TRADUTOR DE ERROS TÉCNICOS → PT AMIGÁVEL
// ═══════════════════════════════════════════════════════════════════════
// Recebe qualquer erro (string, Error, response JSON, etc) e devolve
// uma mensagem amigável pra mostrar pro usuário final.
//
// Centraliza TODOS os erros conhecidos do sistema:
//   - Meta WhatsApp Business API (códigos #100, #190, #131xxx, etc)
//   - WhatsApp Web (Puppeteer / WebJS)
//   - Supabase (Auth lock, PostgREST, RLS)
//   - HTTP genérico (4xx, 5xx)
//   - Browser (microfone, popup, network)
//
// Uso:
//   import { traduzirErro } from "@/lib/traduzir_erro";
//
//   try { ... }
//   catch (e) { notify(traduzirErro(e), "erro"); }
//
//   // Ou com response não-throw:
//   const data = await resp.json();
//   if (!data.success) notify(traduzirErro(data), "erro");
// ═══════════════════════════════════════════════════════════════════════

export function traduzirErro(err: any): string {
  if (!err) return "Ocorreu um erro inesperado. Tente novamente.";

  // 1) Extrai mensagem técnica de diferentes formatos
  let msg = "";
  let codigo: number | string | undefined;

  if (typeof err === "string") {
    msg = err;
  } else if (err.error) {
    const erroInterno = err.error;
    msg = typeof erroInterno === "object"
      ? [erroInterno.error_user_title, erroInterno.error_user_msg, erroInterno.title, erroInterno.message, erroInterno.error_data?.details].filter(Boolean).join(" | ")
      : String(erroInterno);
    codigo = err.codigo ?? err.code ?? erroInterno?.code;
  } else if (err.message) {
    msg = String(err.message);
    codigo = err.code;
  } else if (err.statusText) {
    msg = String(err.statusText);
    codigo = err.status;
  } else {
    try { msg = JSON.stringify(err); } catch { msg = String(err); }
  }

  // Algumas rotas antigas salvam o código dentro da própria mensagem.
  // Recupera esse número para que a tradução continue específica.
  const codigoNoTexto = msg.match(/(?:code[=\s:]|\(code\s+)(\d{3,})/i)?.[1];
  if (codigo === undefined && codigoNoTexto) codigo = codigoNoTexto;

  // 🆕 Subcodes específicos da Meta — sempre prioritários quando presentes
  // (vêm no error_subcode da resposta da Graph API)
  const subcodeNoTexto = msg.match(/subcode[=\s:]+(\d+)/i)?.[1];
  const subcode = Number(err?.error_subcode ?? err?.subcodigo ?? err?.meta?.error_subcode ?? subcodeNoTexto);
  if (subcode === 2388001) return "A conta business da Meta não atende aos requisitos de política do WhatsApp. Abra um chamado no Meta Business Suite (Recursos → Falar com suporte) com o fbtrace_id deste erro.";
  if (subcode === 2388023) return "O nome de exibição do WhatsApp foi rejeitado. Altere no Gerenciador de Negócios da Meta para um nome que represente a empresa.";
  if (subcode === 2388092) return "A verificação da empresa está pendente na Meta. Conclua a verificação empresarial antes de registrar o número.";
  if (subcode === 2388013) return "Número já em uso em outra conta Business da Meta. Migre o número ou use outro.";

  // Título amigável que a Meta às vezes manda pronto
  const titleMeta = err?.error_user_title;
  const msgMeta = err?.error_user_msg;
  if (titleMeta && typeof titleMeta === "string" && titleMeta.length < 100) {
    const textoMeta = `${titleMeta} ${msgMeta || ""}`.toLowerCase();
    if (textoMeta.includes("unsupported get request") || textoMeta.includes("object with id")) {
      return "A Meta não encontrou o identificador informado ou o token não possui acesso a ele. Confira se o ID e o token pertencem à mesma conta.";
    }
    // Só mostra o texto original quando ele já veio em português.
    if (/\b(não|erro|falha|conta|número|permissão|acesso|mensagem)\b/i.test(`${titleMeta} ${msgMeta || ""}`)) {
      return titleMeta + (msgMeta && msgMeta.length < 300 ? ` — ${msgMeta}` : "");
    }
  }

  const m = [msg, titleMeta, msgMeta, err?.meta?.message, err?.meta?.error_data?.details].filter(Boolean).join(" ").toLowerCase();

  // ─── 2) Códigos específicos da Meta WhatsApp Business API ────────────
  // Lista oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
  if (codigo !== undefined) {
    const cod = Number(codigo);
    if (cod === 100 && (m.includes("unsupported get request") || m.includes("object with id") || m.includes("does not exist"))) return "A Meta não encontrou o identificador informado ou o token não possui acesso a ele. Confira se o ID e o token pertencem à mesma conta.";
    if (cod === 100)    return "Dado inválido enviado ao WhatsApp. Verifique o número, os identificadores da conta e o conteúdo da mensagem.";
    if (cod === 190)    return "A conexão com o WhatsApp expirou. Reconecte o canal nas Configurações.";
    if (cod === 10)     return "Permissão negada pelo WhatsApp. Verifique as permissões do app no Meta Business.";
    if (cod === 4)      return "Limite de chamadas do WhatsApp atingido. Aguarde alguns minutos.";
    if (cod === 17)     return "Limite de uso do WhatsApp atingido por hora. Aguarde.";
    if (cod === 80007)  return "Limite de mensagens do WhatsApp por dia atingido.";
    if (cod === 130429) return "O limite de envios deste número foi atingido. Aguarde alguns minutos e tente novamente.";
    if (cod === 131000) return "PIN de 2 fatores necessário. Cancele o primeiro popup pra digitar o PIN.";
    if (cod === 131005) return "Acesso negado ao número. Verifique se o número está na sua conta Meta Business.";
    if (cod === 131008) return "Parâmetro obrigatório faltando na requisição.";
    if (cod === 131009) return "Valor do parâmetro inválido.";
    if (cod === 131016) return "Serviço do WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.";
    if (cod === 131021) return "Não é possível enviar mensagem pra si mesmo (mesmo número).";
    if (cod === 131026) return "Mensagem não pode ser entregue — o número pode estar inativo no WhatsApp.";
    if (cod === 131031) return "Conta do WhatsApp Business foi bloqueada pela Meta.";
    if (cod === 131042) return "Falha no pagamento da conta WhatsApp Business. Verifique o método de pagamento na Meta.";
    if (cod === 131045) return "Número ainda não foi registrado. Ative-o primeiro.";
    if (cod === 131047) return "Janela de 24h expirou. Use um template pré-aprovado pra reabrir a conversa.";
    if (cod === 131048) return "Limite de mensagens por taxa atingido. Aguarde e tente novamente.";
    if (cod === 131049) return "A Meta limitou temporariamente mensagens de marketing para este contato. Tente novamente mais tarde.";
    if (cod === 131051) return "Tipo de mensagem não suportado pelo WhatsApp Business.";
    if (cod === 131052) return "Falha ao baixar mídia do cliente. Tente novamente em alguns segundos.";
    if (cod === 131053) return "Falha ao enviar mídia. O arquivo pode estar corrompido ou ser muito grande.";
    if (cod === 131056) return "Limite de mensagens de retomada atingido. Espere antes de reengajar este contato.";
    if (cod === 131057) return "Muitas mensagens foram enviadas para este mesmo contato em pouco tempo. Aguarde e tente novamente mais tarde.";
    if (cod === 132000) return "Template do WhatsApp tem parâmetros incompatíveis. Revise o template aprovado.";
    if (cod === 132001) return "Template não existe ou não foi aprovado pela Meta.";
    if (cod === 132005) return "Hash do template não corresponde. O template pode ter sido atualizado.";
    if (cod === 132007) return "Template pausado por baixa qualidade. Aguarde reativação automática pela Meta.";
    if (cod === 132012) return "Parâmetros do template formatados incorretamente.";
    if (cod === 132015) return "Template pausado por desempenho ruim.";
    if (cod === 132016) return "Template foi desativado pela Meta.";
    if (cod === 133000) return "Erro de registro do WhatsApp. Tente desincorporar e reincorporar o número.";
    if (cod === 133004) return "Servidor do WhatsApp temporariamente indisponível.";
    if (cod === 133005) return "PIN de 2 fatores incorreto. Verifique o código no Meta Business.";
    if (cod === 133006) return "Verificação do número falhou. Confirme no Meta Business.";
    if (cod === 133008) return "Tentativas demais. Aguarde algumas horas antes de tentar registrar de novo.";
    if (cod === 133009) return "PIN incorreto demais. Aguarde antes de tentar de novo.";
    if (cod === 133010) return "Número já está registrado nesta conta.";
    if (cod === 133015) return "Aguardando aprovação. Tente novamente em alguns minutos.";
    if (cod === 135000) return "A Meta não conseguiu processar esta mensagem. Tente novamente; se continuar, fale com o suporte.";
  }

  // ─── 3) Padrões textuais conhecidos (sem código específico) ──────────

  // Meta API genérico
  // Traduções por texto para respostas da Meta que chegam sem código ou com código novo.
  if (m.includes("payment") || m.includes("billing") || m.includes("credit line") || m.includes("insufficient funds"))
    return "O envio foi bloqueado por um problema de pagamento na Meta. Regularize a forma de pagamento e tente novamente.";
  if (m.includes("account locked") || m.includes("account blocked") || m.includes("account disabled") || m.includes("account restricted") || m.includes("banned") || m.includes("suspended"))
    return "A conta do WhatsApp Business está bloqueada ou restrita pela Meta. Verifique a conta no Meta Business.";
  if ((m.includes("template") && m.includes("paused")) || (m.includes("template") && m.includes("disabled")))
    return "Este modelo foi pausado pela Meta e não pode ser usado agora. Escolha outro modelo aprovado.";
  if ((m.includes("template") && m.includes("rejected")) || (m.includes("template") && m.includes("not approved")))
    return "Este modelo não foi aprovado pela Meta. Corrija o modelo ou escolha outro aprovado.";
  if (m.includes("template") && (m.includes("does not exist") || m.includes("not found")))
    return "O modelo selecionado não foi encontrado na Meta. Sincronize os modelos e escolha um aprovado.";
  if (m.includes("healthy ecosystem") || m.includes("marketing messages") && m.includes("limit"))
    return "A Meta limitou temporariamente mensagens de marketing para este contato. Tente novamente mais tarde.";
  if (m.includes("not a valid whatsapp") || m.includes("not on whatsapp") || m.includes("recipient is not valid"))
    return "Este número não possui WhatsApp ou está inválido. Confira o número informado.";
  if (m.includes("undeliverable") || m.includes("could not be delivered") || m.includes("cannot be delivered"))
    return "A mensagem não pôde ser entregue. O número pode estar sem WhatsApp, desligado ou indisponível.";
  if (m.includes("outside") && m.includes("24") && m.includes("window"))
    return "A conversa está fora da janela de 24 horas. Envie usando um modelo aprovado pela Meta.";
  if (m.includes("phone number") && (m.includes("not registered") || m.includes("not connected")))
    return "O número da empresa não está conectado corretamente à Meta. Reconecte o canal.";
  if (m.includes("quality") && (m.includes("low") || m.includes("poor")))
    return "A qualidade do número ou do modelo está baixa. Reduza os envios e verifique os alertas da Meta.";

  if (m.includes("unsupported get request") || m.includes("object with id") || (m.includes("does not exist") && m.includes("permission")))
    return "A Meta não encontrou o identificador informado ou o token não possui acesso a ele. Confira se o ID e o token pertencem à mesma conta.";
  if (m.includes("missing permissions") || m.includes("permission") && m.includes("cannot"))
    return "O token não possui as permissões necessárias para realizar essa consulta na Meta.";
  if (m.includes("invalid parameter")) return "Algum dado enviado ao WhatsApp está em formato inválido. Verifique e tente de novo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Você fez muitas requisições em pouco tempo. Aguarde 1-2 minutos e tente novamente.";
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid")))
    return "Token de acesso expirou. Reconecte o canal nas Configurações.";

  // WhatsApp Web / Puppeteer / WebJS
  if (m.includes("detached frame") || m.includes("frame was detached"))
    return "A sessão do WhatsApp Web desconectou. Vamos reconectar automaticamente em alguns segundos.";
  if (m.includes("session closed") || m.includes("protocol error") || m.includes("target closed"))
    return "Conexão com o navegador interno foi fechada. Reconecte o canal pra continuar.";
  if (m.includes("webjs") || m.includes("whatsapp-web")) {
    if (m.includes("disconnect")) return "WhatsApp Web desconectou. Reescaneie o QR Code.";
    if (m.includes("auth")) return "Falha de autenticação no WhatsApp Web. Reescaneie o QR Code.";
  }
  if (m.includes("evaluate failed") || m.includes("execution context"))
    return "Erro interno no navegador do WhatsApp Web. Reinicie o canal.";

  // Supabase / Auth
  if (m.includes("auth-token") && m.includes("lock"))
    return "Conexão com o servidor temporariamente lenta. Aguarde alguns segundos e tente novamente.";
  if (m.includes("jwt") && m.includes("expired"))
    return "Sua sessão expirou. Faça login novamente.";
  if (m.includes("row-level security") || m.includes("rls"))
    return "Você não tem permissão pra essa ação. Verifique com o administrador.";
  if (m.includes("violates") && m.includes("not-null"))
    return "Algum campo obrigatório não foi preenchido.";
  if (m.includes("duplicate key") || m.includes("violates unique"))
    return "Esse registro já existe. Use outro valor ou edite o existente.";
  if (m.includes("violates foreign key"))
    return "Referência inválida. O item relacionado não existe ou foi removido.";

  // HTTP genérico
  if (m.includes("503") || m.includes("service unavailable"))
    return "Serviço temporariamente indisponível. Tente novamente em alguns segundos.";
  if (m.includes("502") || m.includes("bad gateway"))
    return "Servidor está reiniciando. Aguarde alguns segundos e tente novamente.";
  if (m.includes("504") || m.includes("gateway timeout"))
    return "O servidor demorou demais pra responder. Tente novamente.";
  if (m.includes("500") || m.includes("internal server error"))
    return "Erro no servidor. Se persistir, abra um chamado.";
  if (m.includes("401") || m.includes("unauthorized"))
    return "Você precisa fazer login pra essa ação.";
  if (m.includes("403") || m.includes("forbidden"))
    return "Você não tem permissão pra essa ação.";
  if (m.includes("404") || m.includes("not found"))
    return "O item solicitado não foi encontrado.";
  if (m.includes("400") || m.includes("bad request"))
    return "Algum dado enviado está em formato incorreto.";

  // Browser
  if (m.includes("notallowederror") && m.includes("media"))
    return "Permissão de microfone negada. Libere nas configurações do navegador.";
  if (m.includes("permission denied") && m.includes("media"))
    return "Permissão de microfone negada. Libere nas configurações do navegador.";
  if (m.includes("notfounderror") && m.includes("media"))
    return "Microfone não encontrado. Verifique se está conectado.";
  if (m.includes("popup") && (m.includes("block") || m.includes("closed")))
    return "Popup bloqueado pelo navegador. Libere popups e tente de novo.";

  // Rede
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("networkerror"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  if (m.includes("aborted") || m.includes("timeout"))
    return "A operação demorou demais e foi cancelada. Tente novamente.";

  // Facebook SDK
  if (m.includes("fb") && (m.includes("not loaded") || m.includes("undefined")))
    return "O sistema de login do Facebook ainda está carregando. Aguarde 2 segundos e tente novamente.";

  // Nunca deixa uma mensagem técnica em inglês aparecer para o cliente.
  if (/\b(the|with|does|cannot|please|failed|error|request|permission|invalid|unsupported|unknown|missing|read the)\b/i.test(msg)) {
    return "Não foi possível concluir esta ação. Confira os dados e tente novamente; se continuar, fale com o suporte.";
  }

  // Fallback — mostra a mensagem original (truncada se for muito longa)
  if (msg.length > 200) msg = msg.slice(0, 200) + "...";
  return msg || "Ocorreu um erro inesperado. Tente novamente.";
}
