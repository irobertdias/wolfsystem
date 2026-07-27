"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useModulos } from "../../hooks/useModulos";
import { CAMPOS_FIXOS, montarCamposUnificados, type ConfigCampoPadrao, type CampoCustom, type CampoUnificado } from "../../lib/campos_proposta_definicao";
import ExtensoesFluxoIA from "./ExtensoesFluxoIA";

type TipoNo =
  | "texto" | "imagem" | "video" | "audio" | "embed"
  | "input_texto" | "input_numero" | "input_email" | "input_website"
  | "input_data" | "input_hora" | "input_telefone" | "input_botao"
  | "input_selecao_imagem" | "input_pagamento" | "input_avaliacao"
  | "input_arquivo" | "input_cards"
  | "condicao" | "variavel" | "redirecionar" | "script" | "espera"
  | "teste_ab" | "webhook" | "pular" | "retornar"
  | "google_sheets" | "http_request" | "openai" | "fluxo_ia" | "claude_ai" | "gmail"
  | "meta_capi"  // ðŸ†• v20: dispara evento de conversÃ£o pra Meta (Pixel + Conversions API)
  | "inicio" | "comando" | "reply" | "invalido" | "transferir" | "finalizar"
  | "gatilho_crm" | "atualizar_venda"
  | "enviar_venda"  // ðŸ†• v18: cria proposta no CRM com as variÃ¡veis salvas + aplica etiqueta
  | "etiqueta";    // ðŸ†• v19: aplica/remove etiqueta no atendimento ativo

type No = { id: string; tipo: TipoNo; x: number; y: number; dados: Record<string,any>; saidas: string[]; };
type Aresta = { id: string; de: string; saidaIndex: number; para: string; };
type Fluxo = { id?: number; nome: string; descricao: string; ativo: boolean; trigger_tipo: string; trigger_valor: string; nos: No[]; conexoes: Aresta[]; workspace_id: string; };
type BC = { label: string; icone: string; cor: string; saidas: string[]; grupo: string; };
type FilaItem = { id: number; nome: string; conexao?: string; }; // ðŸ†• filas do CRM
type AtendenteItem = { email: string; nome: string; }; // ðŸ†• atendentes do workspace
function booleanoConfiguracao(valor: any, padrao = false): boolean {
  if (valor === undefined || valor === null || valor === "") return padrao;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;
  const texto = String(valor).trim().toLowerCase();
  if (["true", "1", "on", "sim", "yes"].includes(texto)) return true;
  if (["false", "0", "off", "nao", "nÃ£o", "no"].includes(texto)) return false;
  return padrao;
}

function normalizarConfiguracaoFluxoIA(no: No): No {
  if (no.tipo !== "fluxo_ia") return no;
  return {
    ...no,
    dados: {
      ...(no.dados || {}),
      extensoes_ia_ativas: booleanoConfiguracao(no.dados?.extensoes_ia_ativas, false),
      ext_normalizadores_ativa: booleanoConfiguracao(no.dados?.ext_normalizadores_ativa, false),
      ext_crm_ativa: booleanoConfiguracao(no.dados?.ext_crm_ativa, false),
      ext_retomada_ativa: booleanoConfiguracao(no.dados?.ext_retomada_ativa, false),
      ext_followups_ativa: booleanoConfiguracao(
        no.dados?.followups_extensao_ativa,
        booleanoConfiguracao(no.dados?.ext_followups_ativa, false)
      ),
      ext_consulta_negativa_ativa: booleanoConfiguracao(no.dados?.ext_consulta_negativa_ativa, false),
      ext_fila_ativa: booleanoConfiguracao(no.dados?.ext_fila_ativa, false),
      ext_multimidia_ativa: booleanoConfiguracao(
        no.dados?.midia_ia_extensao_ativa,
        booleanoConfiguracao(no.dados?.ext_multimidia_ativa, false)
      ),
      followups_extensao_ativa: booleanoConfiguracao(
        no.dados?.followups_extensao_ativa,
        booleanoConfiguracao(no.dados?.ext_followups_ativa, false)
      ),
      midia_ia_extensao_ativa: booleanoConfiguracao(
        no.dados?.midia_ia_extensao_ativa,
        booleanoConfiguracao(no.dados?.ext_multimidia_ativa, false)
      ),
      midia_ia_imagens_ativa: booleanoConfiguracao(no.dados?.midia_ia_imagens_ativa, true),
      midia_ia_arquivos_ativa: booleanoConfiguracao(no.dados?.midia_ia_arquivos_ativa, true),
    },
  };
}

const B: Record<TipoNo, BC> = {
  texto:                {label:"Texto",           icone:"ðŸ’¬", cor:"#3b82f6", saidas:["PrÃ³ximo"],                     grupo:"Bubbles"},
  imagem:               {label:"Imagem",          icone:"ðŸ–¼ï¸", cor:"#06b6d4", saidas:["PrÃ³ximo"],                     grupo:"Bubbles"},
  video:                {label:"VÃ­deo",           icone:"ðŸŽ¥", cor:"#8b5cf6", saidas:["PrÃ³ximo"],                     grupo:"Bubbles"},
  audio:                {label:"Ãudio",           icone:"ðŸŽµ", cor:"#ec4899", saidas:["PrÃ³ximo"],                     grupo:"Bubbles"},
  embed:                {label:"Incorporar",      icone:"ðŸ”—", cor:"#f97316", saidas:["PrÃ³ximo"],                     grupo:"Bubbles"},
  input_texto:          {label:"Texto",           icone:"âœï¸", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_numero:         {label:"NÃºmero",          icone:"ðŸ”¢", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_email:          {label:"Email",           icone:"ðŸ“§", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_website:        {label:"Website",         icone:"ðŸŒ", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_data:           {label:"Data",            icone:"ðŸ“…", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_hora:           {label:"Hora",            icone:"ðŸ•", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_telefone:       {label:"Telefone",        icone:"ðŸ“±", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_botao:          {label:"BotÃ£o",           icone:"ðŸ”˜", cor:"#22c55e", saidas:["BotÃ£o 1","BotÃ£o 2","BotÃ£o 3"], grupo:"Inputs"},
  input_selecao_imagem: {label:"SeleÃ§Ã£o Imagem", icone:"ðŸ–¼ï¸", cor:"#22c55e", saidas:["Selecionado"],                 grupo:"Inputs"},
  input_pagamento:      {label:"Pagamento",       icone:"ðŸ’³", cor:"#22c55e", saidas:["Aprovado","Recusado"],         grupo:"Inputs"},
  input_avaliacao:      {label:"AvaliaÃ§Ã£o",       icone:"â­", cor:"#22c55e", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_arquivo:        {label:"Arquivo",         icone:"ðŸ“Ž", cor:"#22c55e", saidas:["Arquivo recebido"],            grupo:"Inputs"},
  input_cards:          {label:"Cards",           icone:"ðŸƒ", cor:"#22c55e", saidas:["Selecionado"],                 grupo:"Inputs"},
  condicao:             {label:"CondiÃ§Ã£o",        icone:"ðŸ”€", cor:"#f59e0b", saidas:["Verdadeiro","Falso"],          grupo:"LÃ³gica"},
  variavel:             {label:"VariÃ¡vel",        icone:"ðŸ“¦", cor:"#f59e0b", saidas:["PrÃ³ximo"],                     grupo:"LÃ³gica"},
  redirecionar:         {label:"Redirecionar",    icone:"â†©ï¸", cor:"#f59e0b", saidas:[],                              grupo:"LÃ³gica"},
  script:               {label:"Script",          icone:"âŒ¨ï¸", cor:"#f59e0b", saidas:["PrÃ³ximo"],                     grupo:"LÃ³gica"},
  espera:               {label:"Espera",          icone:"â³", cor:"#f59e0b", saidas:["Continuar"],                   grupo:"LÃ³gica"},
  teste_ab:             {label:"Teste A/B",       icone:"ðŸ§ª", cor:"#f59e0b", saidas:["A","B"],                       grupo:"LÃ³gica"},
  webhook:              {label:"Webhook",         icone:"ðŸ””", cor:"#f59e0b", saidas:["PrÃ³ximo"],                     grupo:"LÃ³gica"},
  pular:                {label:"Pular",           icone:"â­ï¸", cor:"#f59e0b", saidas:[],                              grupo:"LÃ³gica"},
  retornar:             {label:"Retornar",        icone:"ðŸ”", cor:"#f59e0b", saidas:[],                              grupo:"LÃ³gica"},
  google_sheets:        {label:"Google Sheets",   icone:"ðŸ“Š", cor:"#10b981", saidas:["Sucesso","Erro"],              grupo:"IntegraÃ§Ãµes"},
  http_request:         {label:"HTTP Request",    icone:"ðŸŒ", cor:"#10b981", saidas:["Sucesso","Erro"],              grupo:"IntegraÃ§Ãµes"},
  openai:               {label:"OpenAI",          icone:"ðŸ¤–", cor:"#10b981", saidas:["PrÃ³ximo"],                     grupo:"IntegraÃ§Ãµes"},
  fluxo_ia:             {label:"Fluxo por IA",    icone:"âœ¨", cor:"#7c3aed", saidas:["Dados confirmados","Erro","Limite de recusas atingido","Limite de lembretes atingido"], grupo:"IntegraÃ§Ãµes"},
  claude_ai:            {label:"Claude AI",       icone:"ðŸ§ ", cor:"#10b981", saidas:["PrÃ³ximo"],                     grupo:"IntegraÃ§Ãµes"},
  gmail:                {label:"Gmail",           icone:"ðŸ“¨", cor:"#10b981", saidas:["Enviado","Erro"],              grupo:"IntegraÃ§Ãµes"},
  // ðŸ†• v20: Meta Pixel / Conversions API â€” manda evento de conversÃ£o pra Meta (Lead, Purchase, etc)
  meta_capi:            {label:"Meta Pixel/CAPI", icone:"ðŸ“ˆ", cor:"#10b981", saidas:["Sucesso","Erro"],              grupo:"IntegraÃ§Ãµes"},
  inicio:               {label:"InÃ­cio",          icone:"ðŸš€", cor:"#22c55e", saidas:["PrÃ³ximo"],                     grupo:"Eventos"},
  comando:              {label:"Comando",         icone:"âš¡", cor:"#ef4444", saidas:["PrÃ³ximo"],                     grupo:"Eventos"},
  reply:                {label:"Reply",           icone:"â†©ï¸", cor:"#ef4444", saidas:["PrÃ³ximo"],                     grupo:"Eventos"},
  invalido:             {label:"InvÃ¡lido",        icone:"âŒ", cor:"#ef4444", saidas:["PrÃ³ximo"],                     grupo:"Eventos"},
  transferir:           {label:"Transferir",      icone:"ðŸ‘¤", cor:"#ef4444", saidas:["PrÃ³ximo"],                     grupo:"Eventos"},
  finalizar:            {label:"Finalizar",       icone:"ðŸ", cor:"#ef4444", saidas:[],                              grupo:"Eventos"},
  // ðŸ†• v18: bloco que cria proposta no /crm/vendas usando variÃ¡veis salvas + aplica etiqueta
  gatilho_crm:         {label:"AlteraÃ§Ã£o no CRM", icone:"âš¡", cor:"#f97316", saidas:["Disparar"], grupo:"CRM"},
  atualizar_venda:     {label:"Atualizar Venda",  icone:"ðŸ“", cor:"#0ea5e9", saidas:["Sucesso","Erro"], grupo:"CRM"},
  enviar_venda:         {label:"Enviar Venda",    icone:"ðŸ’°", cor:"#22c55e", saidas:["Sucesso","Erro"],              grupo:"CRM"},
  // ðŸ†• v19: aplica/remove etiqueta no atendimento ativo (use no meio do fluxo, nÃ£o sÃ³ no final)
  etiqueta:             {label:"Aplicar Etiqueta",icone:"ðŸ·ï¸", cor:"#22c55e", saidas:["PrÃ³ximo"],                     grupo:"CRM"},
};

// ðŸ†• v18: novo grupo "CRM" no sidebar pro bloco "Enviar Venda"
const GRUPOS = ["Bubbles","Inputs","LÃ³gica","IntegraÃ§Ãµes","Eventos","CRM"];
const uid = () => Math.random().toString(36).slice(2,10);

const IS: React.CSSProperties = {width:"100%",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:6,padding:"8px 10px",color:"#1f2937",fontSize:12,boxSizing:"border-box"};
const LS: React.CSSProperties = {color:"#9ca3af",fontSize:10,textTransform:"uppercase",display:"block",marginBottom:4,letterSpacing:1};

// âœ… ATUALIZADO â€” pega username do workspace (nunca o id numÃ©rico)
// ðŸ†• v18: padronizado com o useWorkspace.ts pra funcionar igual pra sub-usuÃ¡rio.
// Antes, dois bugs faziam Admin sub-usuÃ¡rio receber null:
//   1) .maybeSingle() sem .order().limit(1) quebra com erro 406 se houver duplicata
//   2) .or(username.eq.X, id.eq.X) com X=texto faz Postgres rejeitar com erro 400
//      porque a coluna `id` Ã© INT â€” qualquer comparaÃ§Ã£o `id.eq.abccompany` falha.
async function getWsUsername(): Promise<string|null> {
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return null;
  // 1. Dono do workspace
  const {data: wsDono} = await supabase.from("workspaces").select("username").eq("owner_id", user.id).maybeSingle();
  if (wsDono?.username) return wsDono.username;
  // 2. Sub-usuÃ¡rio â€” busca a linha mais recente (limit 1) pra evitar erro 406 em duplicatas
  const {data: uw} = await supabase.from("usuarios_workspace")
    .select("workspace_id")
    .eq("email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (uw?.workspace_id) {
    // 2a. Tenta como username (caso novo â€” workspace_id Ã© string tipo "abccompany")
    const {data: wsSub} = await supabase.from("workspaces")
      .select("username")
      .eq("username", uw.workspace_id)
      .maybeSingle();
    if (wsSub?.username) return wsSub.username;
    // 2b. Fallback legacy â€” sÃ³ tenta como id numÃ©rico SE workspace_id for sÃ³ dÃ­gitos
    //     (proteÃ§Ã£o contra erro 400 "invalid input syntax for integer")
    if (/^\d+$/.test(uw.workspace_id)) {
      const {data: wsLegado} = await supabase.from("workspaces")
        .select("username")
        .eq("id", parseInt(uw.workspace_id))
        .maybeSingle();
      if (wsLegado?.username) return wsLegado.username;
    }
  }
  return null;
}

function defaultD(tipo: TipoNo): Record<string,any> {
  const m: Partial<Record<TipoNo,Record<string,any>>> = {
    texto:{texto:"Digite sua mensagem aqui..."},
    imagem:{url:"",legenda:""},video:{url:"",legenda:""},audio:{url:""},embed:{url:""},
    input_texto:{pergunta:"Qual Ã© o seu nome?",variavel:"nome"},
    input_numero:{pergunta:"Qual nÃºmero?",variavel:"numero"},
    input_email:{pergunta:"Qual seu email?",variavel:"email"},
    input_website:{pergunta:"Qual website?",variavel:"website"},
    input_data:{pergunta:"Qual a data?",variavel:"data"},
    input_hora:{pergunta:"Qual a hora?",variavel:"hora"},
    input_telefone:{pergunta:"Qual telefone?",variavel:"telefone"},
    input_botao:{texto:"Escolha:",botoes:["OpÃ§Ã£o 1","OpÃ§Ã£o 2"],modo_envio:"interativo"},
    input_selecao_imagem:{texto:"Selecione:",itens:[]},
    input_pagamento:{valor:0,descricao:"Pagamento"},
    input_avaliacao:{pergunta:"Como avalia?",max:5,variavel:"avaliacao"},
    input_arquivo:{pergunta:"Envie arquivo:",variavel:"arquivo"},
    input_cards:{cards:[{titulo:"Card 1",descricao:""}]},
    condicao:{variavel:"resposta",operador:"igual",valor:""},
    variavel:{nome:"minhaVar",valor:"",tipo:"texto"},
    redirecionar:{url:""},script:{codigo:"// cÃ³digo\nreturn true;"},
    espera:{segundos:3},teste_ab:{percentual_a:50},
    webhook:{url:"",metodo:"POST",headers:"",body:""},
    pular:{alvo:""},retornar:{alvo:""},
    google_sheets:{webhook_url:"",acao:"append",dados:"",variavel_resposta:""},
    http_request:{url:"",metodo:"GET",headers:"",body:"",variavel:""},
    openai:{apiKey:"",modelo:"gpt-4o-mini",prompt:"",variavel:"resposta_ia"},
    fluxo_ia:{extensoes_ia_ativas:false,ext_normalizadores_ativa:false,ext_crm_ativa:false,ext_retomada_ativa:false,ext_followups_ativa:false,ext_consulta_negativa_ativa:false,ext_fila_ativa:false,ext_multimidia_ativa:false,apiKey:"",modelo:"gpt-4o-mini",prompt:"VocÃª Ã© um assistente comercial. Colete os dados com naturalidade.",mensagem_inicial:"OlÃ¡! Vou confirmar alguns dados com vocÃª.",mensagem_inicial_literal:true,agrupamento_ms:3500,limite_recusas:3,followups_extensao_ativa:false,reengajamento_ativo:false,reengajamento_lembretes:[{minutos:10,mensagem:"Oi, {{nome}}! Ainda estÃ¡ por aÃ­? Posso continuar seu atendimento? ðŸ˜Š"}],reengajamento_finalizar_automatico:true,reengajamento_finalizar_apos_minutos:120,reengajamento_inteligente_ativo:true,reengajamento_inteligente_antecedencia_minutos:10,reengajamento_inteligente_maximo_dias:30,midia_ia_extensao_ativa:false,midia_ia_imagens_ativa:true,midia_ia_arquivos_ativa:true,midia_ia_tamanho_max_mb:15,midia_ia_mensagem_falha:"Recebi a foto ou o arquivo, mas nÃ£o consegui ler com seguranÃ§a. Pode enviar novamente ou digitar as informaÃ§Ãµes, por favor?",variaveis:[{nome:"nome",label:"Nome completo",tipo:"nome",obrigatoria:true}],consultas:[]},
    claude_ai:{apiKey:"",modelo:"claude-sonnet-4-20250514",prompt:"",variavel:"resposta_ia"},
    gmail:{smtp_host:"smtp.gmail.com",smtp_port:587,smtp_secure:false,smtp_user:"",smtp_pass:"",from_name:"",para:"",assunto:"",corpo:""},
    // ðŸ†• v20: Meta Pixel / Conversions API
    meta_capi:{
      pixel_id:"",            // ID do Pixel / Dataset (Events Manager da Meta)
      access_token:"",        // token da Conversions API (gerado no Events Manager)
      evento:"Lead",          // evento padrÃ£o da Meta (Lead, Contact, Purchase...) ou "custom"
      evento_custom:"",       // nome do evento custom (usado se evento === "custom")
      valor:"",               // valor da conversÃ£o (opcional, pra Purchase) â€” aceita {{variavel}}
      moeda:"BRL",            // moeda do valor
      test_event_code:"",     // opcional: cÃ³digo de teste do Events Manager â†’ Testar Eventos
      api_version:"v21.0",    // versÃ£o da Graph API
    },
    inicio:{mensagem:"OlÃ¡! Como posso te ajudar?"},
    comando:{comando:"/start"},reply:{palavras:""},
    invalido:{mensagem:"NÃ£o entendi."},
    // ðŸ†• Transferir agora tem 2 modos: equipe (fila) ou humano (atendente especÃ­fico)
    transferir:{modo:"equipe", fila:"", atendente_email:"", atendente_nome:"", mensagem:"Transferindo..."},
    finalizar:{mensagem:"Atendimento finalizado. Obrigado!"},
    // ðŸ†• v18: bloco enviar_venda â€” defaults
    gatilho_crm:{ativo:true,campo:"status_venda",operador:"mudou_para",valor:"",modo_primeiro_envio:"texto",template_nome:"",template_idioma:"pt_BR"},
    atualizar_venda:{atualizacoes:[{campo:"status_venda",origem:"valor",valor:""}],mensagem_sucesso:"",mensagem_erro:""},
    enviar_venda:{
      modo_mapeamento: "automatico",          // "automatico" (por nome) ou "manual" (define cada campo)
      mapeamento: {},                         // so usado se modo_mapeamento === "manual": { campo_proposta: "nome_variavel" }
      roleta_vendas_ativa: true,              // ativa a roleta propria deste bloco quando o atendimento ainda nao tem vendedor
      roleta_vendedores: [],                  // emails dos vendedores marcados no modal do bloco
      roleta_vendas_index: 0,                 // ponteiro round-robin salvo no proprio fluxo pelo backend
      usar_vendedor_atendimento: true,        // se o atendimento ja tiver vendedor real, a proposta usa esse mesmo vendedor
      etiqueta: "proposta_finalizada",        // tag aplicada ao atendimento ao criar a proposta
      aplicar_etiqueta: true,                 // se false, so cria proposta sem aplicar tag
      status_inicial: "aguardando",           // status da proposta criada
      mensagem_sucesso: "âœ… Sua proposta foi registrada! Em breve nossa equipe entra em contato.",
      mensagem_erro: "âš ï¸ NÃ£o consegui registrar agora, mas seu atendente vai te ajudar.",
    },
    // ðŸ†• v19: bloco etiqueta â€” aplica/remove etiqueta no atendimento ativo
    etiqueta:{
      acao: "aplicar",        // "aplicar" ou "remover"
      nome: "",               // nome da etiqueta (cria se nÃ£o existir)
      cor: "#3b82f6",         // cor da etiqueta (se for criada nova)
      icone: "ðŸ·ï¸",            // Ã­cone da etiqueta (se for criada nova)
    },
  };
  return m[tipo]||{};
}

function getPreview(no: No): string {
  const d=no.dados;
  switch(no.tipo){
    case "texto": return d.texto||"Vazio";
    case "imagem":case"video":case"audio":case"embed": return d.url||d.legenda||"Sem URL";
    case "input_texto":case"input_numero":case"input_email":case"input_website":
    case"input_data":case"input_hora":case"input_telefone":case"input_arquivo":case"input_avaliacao":
      return `${d.pergunta||"?"} â†’ {{${d.variavel||"var"}}}`;
    case "input_botao": {
      const modo = d.modo_envio === "numerado" ? "numerado" : "interativo";
      return `${modo === "numerado" ? "1ï¸âƒ£" : "ðŸ”˜"} ${d.botoes?.length||0} botÃµes`;
    }
    case "input_selecao_imagem": return `${d.itens?.length||0} imgs`;
    case "input_pagamento": return `R$ ${d.valor||0}`;
    case "input_cards": return `${d.cards?.length||0} cards`;
    case "condicao": {
      // ðŸ†• Suporta mÃºltiplas condiÃ§Ãµes com OR/AND
      if (Array.isArray(d.condicoes) && d.condicoes.length > 0) {
        const juncao = d.juncao === "OR" ? " OU " : " E ";
        return d.condicoes.slice(0, 2).map((c: any) => `{{${c.variavel||"?"}}} ${c.operador||"="} "${c.valor||""}"`).join(juncao) + (d.condicoes.length > 2 ? ` ${juncao} +${d.condicoes.length - 2}` : "");
      }
      return `SE {{${d.variavel}}} ${d.operador} "${d.valor}"`;
    }
    case "variavel": {
      // ðŸ†• Mostra modo no canvas
      const modo = d.modo_valor || "texto";
      const icone = modo === "codigo" ? "ðŸ’»" : modo === "expressao" ? "ðŸ”—" : "ðŸ“";
      const valor = String(d.valor || "").slice(0, 30);
      return `${icone} {{${d.nome||"?"}}} = ${valor}${String(d.valor||"").length > 30 ? "..." : ""}`;
    }
    case "redirecionar": return d.url||"Sem URL";
    case "script": return "Script JS";
    case "espera": return `â³ ${d.segundos}s`;
    case "teste_ab": return `A:${d.percentual_a}% B:${100-(d.percentual_a||50)}%`;
    case "webhook": return `${d.metodo} ${d.url||""}`;
    case "pular":case"retornar": return `â†’ ${d.alvo||"?"}`;
    case "google_sheets": return d.webhook_url ? `Sheets ${d.acao}` : "âš ï¸ Webhook nÃ£o configurado";
    case "http_request": return `${d.metodo} ${d.url||""}`;
    case "openai": return `GPT: ${d.modelo}`;
    case "fluxo_ia": return "IA coleta " + (Array.isArray(d.variaveis) ? d.variaveis.length : 0) + " variÃ¡vel(is)" + (d.followups_extensao_ativa === true ? " â€¢ Agenda e lembretes ativos" : "");
    case "claude_ai": return `Claude: ${d.modelo}`;
    case "gmail": return d.smtp_user ? `ðŸ“¨ ${d.para||"?"}` : "âš ï¸ SMTP nÃ£o configurado";
    // ðŸ†• v20: preview do bloco Meta Pixel/CAPI
    case "meta_capi": {
      const ev = d.evento === "custom" ? (d.evento_custom || "custom") : (d.evento || "Lead");
      return d.pixel_id ? `ðŸ“ˆ ${ev} â†’ Pixel ${String(d.pixel_id).slice(0,8)}â€¦` : "âš ï¸ Pixel nÃ£o configurado";
    }
    case "inicio": return d.mensagem||"InÃ­cio";
    case "comando": return d.comando||"/start";
    case "reply": return d.palavras||"Palavras-chave";
    case "invalido": return d.mensagem||"InvÃ¡lido";
    // ðŸ†• Transferir: mostra equipe/fila OU atendente humano conforme modo
    case "transferir": {
      if (d.modo === "humano") {
        return d.atendente_email ? `ðŸ‘¤ ${d.atendente_nome || d.atendente_email}` : "âš ï¸ Atendente nÃ£o selecionado";
      }
      return d.fila ? `ðŸ“‹ ${d.fila}` : "âš ï¸ Fila nÃ£o selecionada";
    }
    case "finalizar": return d.mensagem||"Finalizar";
    // ðŸ†• v18: preview do bloco "Enviar Venda"
    case "gatilho_crm": return `Quando ${d.campo || "status_venda"} ${d.operador || "mudar"} ${d.valor || ""}`;
    case "atualizar_venda": return `${Array.isArray(d.atualizacoes) ? d.atualizacoes.length : 0} campo(s) da mesma venda`;
    case "enviar_venda": {
      const modo = d.modo_mapeamento === "manual" ? "manual" : "auto";
      const qtdVend = Array.isArray(d.roleta_vendedores) ? d.roleta_vendedores.length : 0;
      const roleta = d.roleta_vendas_ativa !== false ? ` ðŸŽ¯ ${qtdVend} vendedor(es)` : "";
      const tag = d.aplicar_etiqueta !== false ? ` ðŸ·ï¸ ${d.etiqueta||"proposta_finalizada"}` : "";
      return `ðŸ’° Cria proposta (${modo})${roleta}${tag}`;
    }
    // ðŸ†• v19: preview do bloco "Aplicar Etiqueta"
    case "etiqueta": {
      const acao = d.acao === "remover" ? "Remove" : "Aplica";
      const ico = d.icone || "ðŸ·ï¸";
      return `${ico} ${acao}: ${d.nome || "(sem nome)"}`;
    }
    default: return "";
  }
}

// ðŸ†• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TVarComponent â€” Textarea com botÃ£o "+ VariÃ¡vel" igual Typebot.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CRITICAL FIX: dropdown usa position:fixed (nÃ£o absolute) com posiÃ§Ã£o calculada
// via useRef + useState, pra escapar do clip do modal scrollÃ¡vel (overflow:auto).
// Antes ficava clipado quando o popup tentava ir pra cima do textarea.
function TVarComponent({
  label, valor, onChange, placeholder, altura, variaveis, idSuffix
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  altura: number;
  variaveis: string[];
  idSuffix: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [filtro, setFiltro] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Calcula posiÃ§Ã£o do dropdown baseado no botÃ£o (em coords da viewport)
  function abrir() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const dropdownWidth = 260;
    const dropdownHeight = 240;
    // Tenta abrir ACIMA do botÃ£o (preferÃªncia); se nÃ£o couber, abre abaixo
    let top = r.top - dropdownHeight - 8;
    if (top < 10) top = r.bottom + 8; // sem espaÃ§o acima â†’ abre abaixo
    // Alinha pela direita do botÃ£o (cresce pra esquerda)
    let left = r.right - dropdownWidth;
    if (left < 10) left = 10; // nÃ£o deixa ir pra fora da tela
    setPos({ left, top });
    setAberto(true);
    setFiltro("");
  }

  // Fecha quando clica fora
  useEffect(() => {
    if (!aberto) return;
    function clickFora(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (dropRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, [aberto]);

  // Insere {{nome}} no cursor do textarea
  function inserir(nome: string) {
    if (!nome.trim()) return;
    const ta = taRef.current;
    const valorAtual = valor || "";
    let novoValor: string;
    let novaPos: number;
    if (ta) {
      const start = ta.selectionStart ?? valorAtual.length;
      const end = ta.selectionEnd ?? valorAtual.length;
      const insercao = `{{${nome.trim()}}}`;
      novoValor = valorAtual.slice(0, start) + insercao + valorAtual.slice(end);
      novaPos = start + insercao.length;
    } else {
      novoValor = valorAtual + `{{${nome.trim()}}}`;
      novaPos = novoValor.length;
    }
    onChange(novoValor);
    setAberto(false);
    setTimeout(() => {
      const t = taRef.current;
      if (t) { t.focus(); t.setSelectionRange(novaPos, novaPos); }
    }, 50);
  }

  // Filtra variÃ¡veis pelo texto digitado
  const variaveisFiltradas = filtro.trim()
    ? variaveis.filter(v => v.toLowerCase().includes(filtro.toLowerCase()))
    : variaveis;

  return (
    <div key={`tvar-${idSuffix}`}>
      <label style={LS}>{label}</label>
      <div style={{ position: "relative" }}>
        <textarea
          ref={taRef}
          value={valor}
          onChange={e => onChange(e.target.value)}
          style={{ ...IS, height: altura, resize: "vertical", paddingRight: 12 }}
          placeholder={placeholder}
        />
        <button
          ref={btnRef}
          type="button"
          onClick={() => aberto ? setAberto(false) : abrir()}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: aberto ? "#8b5cf644" : "#8b5cf622",
            color: "#a78bfa",
            border: "1px solid #8b5cf633",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: "bold",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            outline: "none",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>ï¼‹</span> VariÃ¡vel
        </button>
      </div>
      {variaveis.length > 0 && (
        <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", lineHeight: 1.3 }}>
          ðŸ’¡ Clique em <b style={{ color: "#a78bfa" }}>ï¼‹ VariÃ¡vel</b> pra inserir uma variÃ¡vel do fluxo na posiÃ§Ã£o do cursor.
        </p>
      )}

      {/* Dropdown com position:fixed â€” escapa do clip do modal */}
      {aberto && pos && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 10,
            width: 260,
            maxHeight: 240,
            display: "flex",
            flexDirection: "column",
            zIndex: 3000,
          }}
        >
          <input
            type="text"
            placeholder={variaveis.length > 0 ? "Buscar ou criar variÃ¡vel..." : "Digite o nome da nova variÃ¡vel..."}
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                inserir(filtro);
              }
              if (e.key === "Escape") setAberto(false);
            }}
            autoFocus
            style={{
              width: "100%",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "6px 10px",
              color: "#1f2937",
              fontSize: 12,
              marginBottom: 8,
              outline: "none",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          />
          {/* Lista scrollÃ¡vel */}
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {variaveisFiltradas.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                {filtro
                  ? <>Nenhuma variÃ¡vel corresponde.<br/>Pressione <b>Enter</b> pra criar <span style={{color:"#a78bfa"}}>{`{{${filtro}}}`}</span></>
                  : <>Nenhuma variÃ¡vel no fluxo ainda.<br/>Digite acima pra criar a primeira.</>
                }
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {variaveisFiltradas.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => inserir(v)}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      background: "#8b5cf622",
                      color: "#a78bfa",
                      padding: "3px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: "bold",
                    }}>{`{{${v}}}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PainelProps({ noSel, updateNo, excluirNo, setNos, filasBanco, atendentesBanco, nos, statusVendaOpcoes, camposPropostaUnif, vendedorIALiberado, salvarConfiguracaoMidia, salvandoMidiaId }: {
  noSel: No;
  updateNo: (id: string, d: Record<string,any>) => void;
  excluirNo: (id: string) => void;
  setNos: React.Dispatch<React.SetStateAction<No[]>>;
  filasBanco: FilaItem[]; // ðŸ†•
  atendentesBanco: AtendenteItem[]; // ðŸ†• lista de atendentes do workspace
  nos: No[]; // ðŸ†• lista completa de nÃ³s pra detectar variÃ¡veis criadas
  statusVendaOpcoes: {value:string;label:string}[]; // ðŸ“‹ status disponÃ­veis no workspace
  camposPropostaUnif: CampoUnificado[]; // ðŸ“‹ campos da proposta (fixos + customs) do workspace
  vendedorIALiberado: boolean;
  salvarConfiguracaoMidia: (id: string, dados: Record<string, boolean>) => Promise<void>;
  salvandoMidiaId: string | null;
}) {
  const d = noSel.dados;
  const id = noSel.id;
  const u = (o: Record<string,any>) => updateNo(id, o);

  if (noSel.tipo === "fluxo_ia" && !vendedorIALiberado) {
    return (
      <div style={{border:"1px solid #ddd6fe",background:"linear-gradient(145deg,#faf5ff,#fff)",borderRadius:14,padding:22,textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:10}}>ðŸ¤–</div>
        <h3 style={{margin:"0 0 8px",color:"#5b21b6"}}>Vendedor IA bloqueado</h3>
        <p style={{fontSize:12,lineHeight:1.6,color:"#6b7280",margin:"0 0 14px"}}>Este Ã© um mÃ³dulo premium avulso e nÃ£o faz parte dos planos padrÃ£o da Wolf.</p>
        <div style={{display:"inline-block",padding:"8px 14px",borderRadius:999,background:"#7c3aed",color:"#fff",fontWeight:800,fontSize:12}}>ContrataÃ§Ã£o: R$ 2.500,00</div>
        <p style={{fontSize:11,color:"#9ca3af",margin:"14px 0 0"}}>Solicite a liberaÃ§Ã£o ao administrador da Wolf System.</p>
      </div>
    );
  }

  // ðŸ†• Coleta TODAS as variÃ¡veis criadas no fluxo (em qualquer bloco que seta variÃ¡vel).
  // Usado pro autocomplete/dropdown nos blocos que usam variÃ¡veis.
  const variaveisDoFluxo = (() => {
    const set = new Set<string>();
    nos.forEach(n => {
      const dn = n.dados || {};
      // Blocos que CAPTURAM variÃ¡veis
      if (dn.variavel) set.add(dn.variavel);
      if (dn.variavel_resposta) set.add(dn.variavel_resposta);
      if (dn.variavel_status) set.add(dn.variavel_status);
      // Fluxo por IA guarda vÃ¡rias variÃ¡veis dentro de dados.variaveis.
      if (Array.isArray(dn.variaveis)) {
        dn.variaveis.forEach((campo: any) => {
          const nome = String(campo?.nome || "").trim();
          if (nome) set.add(nome);
        });
      }
      // Resultados das consultas automÃ¡ticas tambÃ©m ficam disponÃ­veis.
      if (Array.isArray(dn.consultas)) {
        dn.consultas.forEach((consulta: any) => {
          const resultado = String(consulta?.variavel_resultado || "").trim();
          const status = String(consulta?.variavel_status || "").trim();
          if (resultado) set.add(resultado);
          if (status) set.add(status);
        });
      }
      // Bloco "variavel" (set manual)
      if (n.tipo === "variavel" && dn.nome) set.add(dn.nome);
      // CondiÃ§Ãµes â€” referenciam mas tambÃ©m incluo pra autocompletar
      if (Array.isArray(dn.condicoes)) {
        dn.condicoes.forEach((c: any) => { if (c.variavel) set.add(c.variavel); });
      }
    });
    return Array.from(set).sort();
  })();

  const F = (lbl: string, key: string, type = "text", ph = "") => (
    <div key={`${id}-${key}`}>
      <label style={LS}>{lbl}</label>
      <input type={type} value={d[key]||""} onChange={e => u({[key]: e.target.value})} style={IS} placeholder={ph} />
    </div>
  );

  const T = (lbl: string, key: string, ph = "", h = 80) => (
    <div key={`${id}-${key}`}>
      <label style={LS}>{lbl}</label>
      <textarea value={d[key]||""} onChange={e => u({[key]: e.target.value})} style={{...IS, height:h, resize:"vertical"}} placeholder={ph} />
    </div>
  );

  // ðŸ†• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TVar â€” Textarea COM botÃ£o "+ VariÃ¡vel" estilo Typebot.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Permite inserir {{nome_variavel}} na posiÃ§Ã£o do cursor com 1 clique.
  // Mostra lista de variÃ¡veis existentes no fluxo + opÃ§Ã£o de criar nova.
  // Use em blocos onde a mensagem contÃ©m texto + variÃ¡veis (texto, legenda, etc).
  const TVar = (lbl: string, key: string, ph = "", h = 100) => {
    return (
      <TVarComponent
        label={lbl}
        valor={d[key] || ""}
        onChange={(v) => u({ [key]: v })}
        placeholder={ph}
        altura={h}
        variaveis={variaveisDoFluxo}
        idSuffix={`${id}-${key}`}
      />
    );
  };

  const S = (lbl: string, key: string, opts: {value:string;label:string}[]) => (
    <div key={`${id}-${key}`}>
      <label style={LS}>{lbl}</label>
      <select value={d[key]||opts[0]?.value} onChange={e => u({[key]: e.target.value})} style={IS}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  // ðŸ†• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // VarPill â€” Componente visual estilo Typebot pra escolher variÃ¡vel.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Exibe a variÃ¡vel atual como uma "pÃ­lula" roxa (igual Typebot). Click abre
  // dropdown com lista das variÃ¡veis existentes + opÃ§Ã£o de criar nova.
  const VarPill = (label: string | null, key: string, placeholder = "Selecionar variÃ¡vel") => {
    const valor = d[key] || "";
    return (
      <div key={`${id}-${key}-varpill`}>
        {label && <label style={LS}>{label}</label>}
        <details className="var-pill-dropdown" style={{ position: "relative" }}>
          <summary style={{
            listStyle: "none",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            outline: "none",
          }}>
            {valor ? (
              <span style={{
                background: "#ede9fe",
                color: "#6d28d9",
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: "bold",
              }}>{`{{${valor}}}`}</span>
            ) : (
              <span style={{ color: "#6b7280", fontSize: 12 }}>{placeholder}</span>
            )}
            <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>â–¼</span>
          </summary>
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8,
            zIndex: 100, maxHeight: 280, overflowY: "auto", padding: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}>
            {/* Input pra digitar nova variÃ¡vel */}
            <input
              type="text"
              placeholder="Digite ou crie uma variÃ¡vel..."
              defaultValue={valor}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) u({ [key]: v });
                  (e.target as HTMLInputElement).closest("details")?.removeAttribute("open");
                }
              }}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== valor) u({ [key]: v });
              }}
              style={{
                width: "100%", background: "#f8fafc", border: "1px solid #e5e7eb",
                borderRadius: 6, padding: "6px 10px", color: "#1f2937", fontSize: 12,
                marginBottom: 8, outline: "none",
              }}
            />
            {/* Lista de variÃ¡veis existentes */}
            {variaveisDoFluxo.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                Nenhuma variÃ¡vel no fluxo ainda.<br/>Digite acima pra criar a primeira.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {variaveisDoFluxo.map(v => (
                  <button
                    key={v}
                    onClick={(e) => {
                      u({ [key]: v });
                      // ðŸ†• Fix: usa closest do elemento clicado (antes buscava por ID que nÃ£o existia)
                      (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
                    }}
                    style={{
                      background: v === valor ? "#ddd6fe" : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#6d28d9",
                      fontSize: 12,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{
                      background: "#ede9fe",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      color: "#6d28d9",
                    }}>{`{{${v}}}`}</span>
                  </button>
                ))}
              </div>
            )}
            {/* BotÃ£o limpar */}
            {valor && (
              <button
                onClick={(e) => {
                  u({ [key]: "" });
                  (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
                }}
                style={{
                  width: "100%", marginTop: 6, padding: 6, background: "transparent",
                  border: "1px dashed #e5e7eb", borderRadius: 6, color: "#6b7280",
                  fontSize: 11, cursor: "pointer",
                }}
              >âœ• Limpar</button>
            )}
          </div>
        </details>
      </div>
    );
  };

  // ðŸ†• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // OpSelect â€” Select de operador estilo Typebot (visual customizado, nÃ£o nativo).
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const OpSelect = (key: string, valor: string, onChange: (v: string) => void) => {
    const opcoes = [
      { value: "igual", label: "Igual a", icone: "=" },
      { value: "diferente", label: "Diferente de", icone: "â‰ " },
      { value: "contem", label: "ContÃ©m", icone: "âŠ‡" },
      { value: "nao_contem", label: "NÃ£o contÃ©m", icone: "âŠ‰" },
      { value: "comeca_com", label: "ComeÃ§a com", icone: "â–¶" },
      { value: "termina_com", label: "Termina com", icone: "â—€" },
      { value: ">", label: "Maior que", icone: ">" },
      { value: "<", label: "Menor que", icone: "<" },
      { value: ">=", label: "Maior ou igual", icone: "â‰¥" },
      { value: "<=", label: "Menor ou igual", icone: "â‰¤" },
      { value: "match_regex", label: "Match Regex", icone: ".*" },
      { value: "nao_match_regex", label: "NÃ£o match Regex", icone: "!.*" },
      { value: "preenchido", label: "Preenchido", icone: "âœ“" },
      { value: "vazio", label: "Vazio", icone: "âˆ…" },
    ];
    const atual = opcoes.find(o => o.value === valor) || opcoes[0];
    return (
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          color: "#a78bfa",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: "bold",
          cursor: "pointer",
          outline: "none",
          minWidth: 140,
        }}
      >
        {opcoes.map(o => (
          <option key={o.value} value={o.value}>{o.icone} {o.label}</option>
        ))}
      </select>
    );
  };

  // ðŸ†• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // VarSelect â€” versÃ£o LEGACY (autocomplete simples). Mantenho pra blocos pequenos
  // tipo http_request "Salvar status em" que nÃ£o precisam de UI tÃ£o rica.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const VarSelect = (label: string, key: string, placeholder = "nome_da_variavel") => (
    <div key={`${id}-${key}-varsel`}>
      <label style={LS}>{label}</label>
      <input
        list={`vars-${id}-${key}`}
        value={d[key] || ""}
        onChange={e => u({ [key]: e.target.value })}
        style={IS}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={`vars-${id}-${key}`}>
        {variaveisDoFluxo.filter(v => v !== d[key]).map(v => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {variaveisDoFluxo.length > 0 && (
        <p style={{color:"#6b7280", fontSize:10, margin:"3px 0 0", lineHeight:1.3}}>
          ðŸ’¡ VariÃ¡veis no fluxo: {variaveisDoFluxo.slice(0, 5).join(", ")}{variaveisDoFluxo.length > 5 ? "..." : ""}
        </p>
      )}
    </div>
  );

  switch (noSel.tipo) {
    case "texto": return <>{TVar("Mensagem","texto","Digite sua mensagem aqui...",120)}</>;
    case "imagem": return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
    case "video":  return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
    case "audio":  return <>{F("URL do Ãudio","url","url","https://...")}</>;
    case "embed":  return <>{F("URL","url","url","https://...")}</>;
    case "input_texto": case "input_email": case "input_website": case "input_numero":
    case "input_telefone": case "input_arquivo": case "input_data": case "input_hora":
      return <>
        {TVar("Pergunta","pergunta","Qual...?",80)}
        {VarPill("Salvar resposta em", "variavel", "ex: nome")}
      </>;
    case "input_avaliacao":
      return <>
        {TVar("Pergunta","pergunta","Como avalia?",80)}
        {F("MÃ¡ximo","max","number","5")}
        {VarPill("Salvar resposta em", "variavel", "ex: avaliacao")}
      </>;
    case "input_pagamento":
      // ðŸ†• v18: aviso de feature parcial â€” backend ainda nÃ£o tem integraÃ§Ã£o com gateway
      return <>
        <p style={{color:"#f59e0b",fontSize:11,margin:"0 0 6px",lineHeight:1.4}}>
          âš ï¸ <b>Em desenvolvimento</b> â€” sem integraÃ§Ã£o com gateway de pagamento (Pix/Stripe/Mercado Pago).
          As saÃ­das "Aprovado/Recusado" nÃ£o disparam ainda. Use com cautela.
        </p>
        {F("Valor (R$)","valor","number","0")}
        {F("DescriÃ§Ã£o","descricao")}
      </>;
    case "input_selecao_imagem":
      // ðŸ†• v18: case implementado â€” antes caÃ­a no default ("Sem propriedades.") e o bloco ficava inÃºtil.
      return <div>
        {TVar("Pergunta","texto","Selecione uma opÃ§Ã£o:",60)}
        <label style={LS}>Imagens (URL|TÃ­tulo, uma por linha)</label>
        <textarea
          value={(d.itens||[]).map((it:any) => `${it.url||""}|${it.titulo||""}`).join("\n")}
          onChange={e => {
            const itens = e.target.value.split("\n").filter(Boolean).map((l:string) => {
              const [url,titulo] = l.split("|");
              return {url: url?.trim()||"", titulo: titulo?.trim()||""};
            });
            u({itens});
          }}
          style={{...IS, height:100, resize:"vertical", fontFamily:"monospace", fontSize:11}}
          placeholder={"https://exemplo.com/produto1.jpg|Produto 1\nhttps://exemplo.com/produto2.jpg|Produto 2"}
        />
        <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0", lineHeight:1.3}}>
          ðŸ’¡ Cliente recebe as imagens e escolhe uma. O tÃ­tulo da opÃ§Ã£o escolhida Ã© salvo na variÃ¡vel abaixo.
        </p>
        {VarPill("Salvar opÃ§Ã£o escolhida em", "variavel", "ex: produto_escolhido")}
      </div>;
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ†• v20 â€” BOTÃƒO reformulado
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // FIX do bug "apaguei um botÃ£o e nÃ£o consigo adicionar outro": a versÃ£o antiga usava
    // um <textarea> com .split("\n").filter(Boolean). O filter(Boolean) apagava a linha em
    // branco no exato momento que vocÃª dava Enter pra criar o prÃ³ximo botÃ£o â€” a nova linha
    // sumia e o cursor voltava. Agora cada botÃ£o Ã© um <input> prÃ³prio, com âœ• pra remover e
    // "+ Adicionar botÃ£o". Sem parsing de linha = sem bug.
    //
    // NOVO: toggle modo_envio:
    //   - "interativo" â†’ backend manda botÃµes clicÃ¡veis nativos do WhatsApp (interactive/button)
    //   - "numerado"   â†’ backend manda texto numerado (1, 2, 3) e casa a resposta pelo nÃºmero
    // âš ï¸ BACKEND (executor do fluxo na VPS) precisa ler dados.modo_envio:
    //   â€¢ interativo + canal WABA/Cloud â†’ POST interactive type:"button" (atÃ© 3 reply buttons)
    //   â€¢ interativo + WhatsApp Web (webjs) â†’ nÃ£o tem botÃ£o nativo â†’ cai pra numerado
    //   â€¢ numerado â†’ monta "texto\n\n1. botao1\n2. botao2..." e mapeia a resposta pelo nÃºmero
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    case "input_botao": {
      const botoes: string[] = Array.isArray(d.botoes) ? d.botoes : [];
      const modoEnvio = d.modo_envio === "numerado" ? "numerado" : "interativo";
      // Atualiza botÃµes E mantÃ©m as saÃ­das do nÃ³ em sincronia (pras conexÃµes do canvas baterem)
      const setBotoes = (novos: string[]) => {
        const limpos = novos.slice(0, 3);
        u({ botoes: limpos });
        setNos(p => p.map(n => n.id === id
          ? { ...n, saidas: limpos.length ? limpos.map((b, i) => (b.trim() || `BotÃ£o ${i + 1}`)) : ["BotÃ£o 1"] }
          : n));
      };
      const updateBotao = (i: number, val: string) => {
        const novos = botoes.slice();
        novos[i] = val;
        setBotoes(novos);
      };
      const addBotao = () => { if (botoes.length < 3) setBotoes([...botoes, ""]); };
      const removeBotao = (i: number) => { setBotoes(botoes.filter((_, idx) => idx !== i)); };
      return <>
        {TVar("Texto","texto","Escolha:",60)}

        {/* Toggle: botÃµes interativos da API vs lista numerada */}
        <div>
          <label style={LS}>Como enviar</label>
          <div style={{display:"flex",gap:6}}>
            {[
              {key:"interativo", label:"ðŸ”˜ BotÃµes interativos", hint:"BotÃµes clicÃ¡veis nativos do WhatsApp (Cloud/WABA). O cliente toca no botÃ£o."},
              {key:"numerado",   label:"1ï¸âƒ£ Lista numerada",     hint:"Manda como texto numerado. O cliente responde com o nÃºmero. Funciona em qualquer canal."},
            ].map(opt => (
              <button key={opt.key} type="button" onClick={() => u({modo_envio: opt.key})}
                style={{
                  flex:1,
                  background: modoEnvio===opt.key ? "#22c55e22" : "#ffffff",
                  border: `1px solid ${modoEnvio===opt.key ? "#22c55e" : "#e5e7eb"}`,
                  color: modoEnvio===opt.key ? "#16a34a" : "#6b7280",
                  borderRadius:8, padding:"8px 10px", fontSize:11, cursor:"pointer", fontWeight:"bold",
                }}
                title={opt.hint}>{opt.label}</button>
            ))}
          </div>
          <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0",lineHeight:1.3}}>
            {modoEnvio==="interativo"
              ? "ðŸ’¡ BotÃµes nativos do WhatsApp (mÃ¡x 3, atÃ© 20 caracteres cada). Precisa de canal WABA/Cloud API. No WhatsApp Web (webjs) o sistema cai pra lista numerada automaticamente."
              : "ðŸ’¡ Envia como texto numerado (1, 2, 3...). Funciona em qualquer canal (Web/WABA/Meta)."}
          </p>
        </div>

        {/* Lista de botÃµes â€” cada um Ã© um input prÃ³prio (resolve o bug de re-adicionar) */}
        <div>
          <label style={LS}>BotÃµes (mÃ¡x 3)</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {botoes.length === 0 && (
              <p style={{color:"#9ca3af",fontSize:11,margin:"2px 0",fontStyle:"italic"}}>
                Nenhum botÃ£o. Clique em "+ Adicionar botÃ£o".
              </p>
            )}
            {botoes.map((b, i) => (
              <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{background:"#22c55e22",color:"#16a34a",fontSize:11,fontWeight:"bold",borderRadius:6,padding:"6px 9px",flexShrink:0}}>{i+1}</span>
                <input
                  value={b}
                  onChange={e => updateBotao(i, e.target.value)}
                  maxLength={modoEnvio==="interativo" ? 20 : undefined}
                  placeholder={`BotÃ£o ${i+1}`}
                  style={{...IS, flex:1}}
                />
                <button type="button" onClick={() => removeBotao(i)} title="Remover botÃ£o"
                  style={{background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:6,padding:"7px 11px",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:"bold"}}>âœ•</button>
              </div>
            ))}
          </div>
          {botoes.length < 3 && (
            <button type="button" onClick={addBotao}
              style={{width:"100%",marginTop:6,background:"#22c55e11",color:"#16a34a",border:"1px dashed #22c55e",borderRadius:8,padding:"9px",fontSize:12,cursor:"pointer",fontWeight:"bold"}}>
              + Adicionar botÃ£o
            </button>
          )}
          {modoEnvio==="interativo" && botoes.some(b => (b||"").length > 20) && (
            <p style={{color:"#f59e0b",fontSize:10,margin:"4px 0 0"}}>
              âš ï¸ BotÃµes interativos do WhatsApp aceitam no mÃ¡ximo 20 caracteres por botÃ£o.
            </p>
          )}
        </div>

        {VarPill("Salvar resposta em (opcional)", "variavel", "ex: opcao_escolhida")}
      </>;
    }
    case "input_cards":
      return <div>
        <label style={LS}>Cards (TÃ­tulo|DescriÃ§Ã£o, um por linha)</label>
        <textarea
          value={(d.cards||[]).map((c:any) => `${c.titulo}|${c.descricao}`).join("\n")}
          onChange={e => {
            const cards = e.target.value.split("\n").filter(Boolean).map((l:string) => {
              const [t,ds] = l.split("|");
              return {titulo: t?.trim()||"", descricao: ds?.trim()||""};
            });
            u({cards});
          }}
          style={{...IS, height:100, resize:"vertical"}}
          placeholder={"Produto 1|DescriÃ§Ã£o\nProduto 2|Outra"}
        />
      </div>;
    case "condicao":
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 10px",lineHeight:1.4}}>
          ðŸ”€ SE (todas/alguma) das condiÃ§Ãµes forem verdadeiras â†’ saÃ­da <b style={{color:"#22c55e"}}>Verdadeiro</b>, senÃ£o â†’ <b style={{color:"#ef4444"}}>Falso</b>
        </p>
        {/* LÃ³gica AND/OR â€” botÃµes grandes */}
        <label style={LS}>LÃ³gica entre condiÃ§Ãµes</label>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {[
            {key:"AND", label:"E (todas)", desc:"Todas precisam ser verdadeiras"},
            {key:"OR", label:"OU (alguma)", desc:"Pelo menos uma"},
          ].map(opt => {
            const ativo = (d.juncao || "AND") === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => u({ juncao: opt.key })}
                style={{
                  flex:1,
                  background: ativo ? "#8b5cf622" : "#ffffff",
                  border: `1px solid ${ativo ? "#8b5cf6" : "#e5e7eb"}`,
                  color: ativo ? "#a78bfa" : "white",
                  borderRadius:8, padding:"8px 10px", fontSize:11, cursor:"pointer", fontWeight:"bold",
                  textAlign:"center",
                }}
                title={opt.desc}
              >{opt.label}</button>
            );
          })}
        </div>

        {/* Lista de condiÃ§Ãµes â€” cada uma com VarPill + OpSelect + valor */}
        <label style={LS}>CondiÃ§Ãµes</label>
        {(() => {
          const lista = (d.condicoes && Array.isArray(d.condicoes) && d.condicoes.length > 0)
            ? d.condicoes
            : [{ variavel: d.variavel || "", operador: d.operador || "igual", valor: d.valor || "" }];

          const updateCond = (idx: number, patch: any) => {
            const nova = lista.slice();
            nova[idx] = { ...nova[idx], ...patch };
            u({ condicoes: nova });
          };
          const removerCond = (idx: number) => {
            const nova = lista.filter((_: any, i: number) => i !== idx);
            u({ condicoes: nova });
          };
          const addCond = () => {
            u({ condicoes: [...lista, { variavel: "", operador: "igual", valor: "" }] });
          };

          return <>
            {lista.map((cond: any, idx: number) => {
              const semValor = ["vazio", "preenchido"].includes(cond.operador);
              const dropdownVarId = `cond-${id}-${idx}`;
              return (
                <div key={idx} style={{
                  background: "#ffffff",
                  border: "1px solid #ffffff",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 8,
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      background: "#3b82f622", color: "#3b82f6",
                      padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
                    }}>#{idx+1}</span>
                    {lista.length > 1 && (
                      <button
                        onClick={() => removerCond(idx)}
                        style={{
                          marginLeft: "auto", background: "#ef444422", color: "#ef4444",
                          border: "none", borderRadius: 6, padding: "3px 8px",
                          fontSize: 11, cursor: "pointer", fontWeight: "bold",
                        }}
                      >âœ•</button>
                    )}
                  </div>
                  {/* VariÃ¡vel (pill) */}
                  <details style={{ position: "relative" }} id={dropdownVarId}>
                    <summary style={{
                      listStyle: "none",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, outline: "none",
                    }}>
                      {cond.variavel ? (
                        <span style={{
                          background: "#8b5cf622", color: "#a78bfa",
                          padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: "bold",
                        }}>{`{{${cond.variavel}}}`}</span>
                      ) : (
                        <span style={{ color: "#6b7280", fontSize: 12 }}>Selecionar variÃ¡vel...</span>
                      )}
                      <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>â–¼</span>
                    </summary>
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                      background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8,
                      zIndex: 100, maxHeight: 240, overflowY: "auto", padding: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}>
                      <input
                        type="text"
                        placeholder="Digite ou crie variÃ¡vel..."
                        defaultValue={cond.variavel || ""}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            updateCond(idx, { variavel: (e.target as HTMLInputElement).value.trim() });
                            (e.target as HTMLInputElement).closest("details")?.removeAttribute("open");
                          }
                        }}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          if (v && v !== cond.variavel) updateCond(idx, { variavel: v });
                        }}
                        style={{
                          width: "100%", background: "#f8fafc", border: "1px solid #e5e7eb",
                          borderRadius: 6, padding: "6px 10px", color: "#1f2937", fontSize: 12,
                          marginBottom: 8, outline: "none",
                        }}
                      />
                      {variaveisDoFluxo.length === 0 ? (
                        <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                          Sem variÃ¡veis ainda
                        </p>
                      ) : variaveisDoFluxo.map(v => (
                        <button
                          key={v}
                          onClick={() => {
                            updateCond(idx, { variavel: v });
                            document.getElementById(dropdownVarId)?.removeAttribute("open");
                          }}
                          style={{
                            width: "100%", textAlign: "left", padding: "6px 10px",
                            background: v === cond.variavel ? "#8b5cf633" : "transparent",
                            border: "none", borderRadius: 6, cursor: "pointer", marginBottom: 2,
                          }}
                        >
                          <span style={{
                            background: "#8b5cf622", color: "#a78bfa",
                            padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
                          }}>{`{{${v}}}`}</span>
                        </button>
                      ))}
                    </div>
                  </details>

                  {/* Operador + Valor */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {OpSelect(`op-${idx}`, cond.operador || "igual", v => updateCond(idx, { operador: v }))}
                    {!semValor && (
                      <input
                        value={cond.valor || ""}
                        onChange={e => updateCond(idx, { valor: e.target.value })}
                        placeholder="Valor pra comparar"
                        style={{
                          flex: 1, background: "#ffffff", border: "1px solid #e5e7eb",
                          borderRadius: 8, padding: "8px 12px", color: "#1f2937", fontSize: 12, outline: "none",
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={addCond}
              style={{
                width: "100%",
                background: "#3b82f611", color: "#3b82f6",
                border: "1px dashed #3b82f6", borderRadius: 8,
                padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold",
              }}
            >
              + Adicionar condiÃ§Ã£o
            </button>
          </>;
        })()}
      </>;
    case "variavel": {
      // ðŸ†• Modo do valor: "texto" (literal), "codigo" (JS), "expressao" (substituiÃ§Ã£o {{var}})
      const modo = d.modo_valor || "texto";
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 10px",lineHeight:1.4}}>
          ðŸ“ Cria ou atualiza uma variÃ¡vel. O valor Ã© salvo no banco e fica disponÃ­vel em todos os blocos seguintes.
        </p>
        {VarPill("Nome da variÃ¡vel", "nome", "Selecionar ou criar variÃ¡vel...")}
        {/* Toggle Text / Code / ExpressÃ£o */}
        <div>
          <label style={LS}>Tipo do valor</label>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {[
              {key:"texto",label:"ðŸ“ Texto",hint:"Valor literal"},
              {key:"expressao",label:"ðŸ”— ExpressÃ£o",hint:"Usa {{var}}"},
              {key:"codigo",label:"ðŸ’» CÃ³digo",hint:"JavaScript"},
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => u({ modo_valor: opt.key })}
                style={{
                  flex:1,
                  background: modo === opt.key ? "#3b82f622" : "#ffffff",
                  border: `1px solid ${modo === opt.key ? "#3b82f6" : "#e5e7eb"}`,
                  color: modo === opt.key ? "#3b82f6" : "white",
                  borderRadius:6, padding:"6px 8px", fontSize:11, cursor:"pointer", fontWeight:"bold"
                }}
                title={opt.hint}
              >{opt.label}</button>
            ))}
          </div>
        </div>
        {/* Campo de valor varia conforme modo */}
        {modo === "texto" && (
          <div>
            <label style={LS}>Valor (texto literal)</label>
            <input value={d.valor||""} onChange={e => u({valor: e.target.value})} style={IS} placeholder="Ex: SP" />
          </div>
        )}
        {modo === "expressao" && (
          <div>
            <label style={LS}>ExpressÃ£o</label>
            <input value={d.valor||""} onChange={e => u({valor: e.target.value})} style={IS} placeholder="{{nome}} - {{cpf_limpo}}" />
            <p style={{color:"#6b7280", fontSize:10, margin:"3px 0 0"}}>
              ðŸ’¡ Use <code style={{color:"#3b82f6"}}>{"{{nome_variavel}}"}</code> pra inserir valores de outras variÃ¡veis. Ex: <code>{"OlÃ¡ {{nome}}"}</code>
            </p>
          </div>
        )}
        {modo === "codigo" && (
          <>
            <div>
              <label style={LS}>CÃ³digo JavaScript</label>
              <textarea
                value={d.valor||""}
                onChange={e => u({valor: e.target.value})}
                style={{...IS, height:140, resize:"vertical", fontFamily:"monospace", fontSize:11}}
                placeholder={`// Use 'return' pro valor da variÃ¡vel\n// API: getVariable(nome), setVariable(nome,valor), fetch, sleep, log\nconst cep = getVariable("cep").replace(/\\D/g, "");\nreturn cep;`}
              />
            </div>
            {/* Save error in variable (igual Typebot) */}
            {VarPill("Salvar erro em (opcional)", "salvar_erro_em", "VariÃ¡vel pra erro...")}
            <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 0", lineHeight:1.3}}>
              Se o cÃ³digo der erro, a mensagem fica salva nessa variÃ¡vel. Ãštil pra blocos de condiÃ§Ã£o depois.
            </p>
          </>
        )}
      </>;
    }
    case "redirecionar": return <>{F("URL","url","url","https://...")}</>;
    case "script":
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 6px"}}>ðŸ†• API disponÃ­vel: <code style={{color:"#3b82f6"}}>setVariable(nome, valor)</code>, <code style={{color:"#3b82f6"}}>getVariable(nome)</code>, <code style={{color:"#3b82f6"}}>fetch</code>, <code style={{color:"#3b82f6"}}>sleep(ms)</code>, <code style={{color:"#3b82f6"}}>log(...)</code></p>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 6px"}}>{`{{variaveis}} sÃ£o substituÃ­das no cÃ³digo antes de executar.`}</p>
        {T("CÃ³digo JavaScript","codigo",`// Exemplo:\n// const resp = await fetch("https://api.exemplo.com/cep/" + getVariable("cep"))\n// const data = await resp.json()\n// setVariable("rua", data.logradouro)`,200)}
        <p style={{color:"#9ca3af",fontSize:10,margin:"4px 0 0"}}>SaÃ­das: <span style={{color:"#22c55e"}}>0=sucesso</span> / <span style={{color:"#ef4444"}}>1=erro</span></p>
      </>;
    case "espera":        return <>{F("Aguardar (segundos)","segundos","number","3")}</>;
    case "teste_ab":
      return <div>
        <label style={LS}>Percentual para A (%)</label>
        <input type="number" min={1} max={99} value={d.percentual_a||50} onChange={e => u({percentual_a: Number(e.target.value)})} style={IS} />
        <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0"}}>B recebe {100-(d.percentual_a||50)}%</p>
      </div>;
    case "webhook":
      return <>
        {F("URL","url","url","https://...")}
        {S("MÃ©todo","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
        {T("Headers JSON","headers",'{"Authorization":"Bearer token"}',60)}
        {T("Body JSON","body",'{"chave":"valor"}',60)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_api")}
        {VarPill("Salvar status em", "variavel_status", "ex: status_api")}
      </>;
    case "pular": case "retornar":
      // ðŸ†• v18: dropdown selecionando nÃ³ (antes era input texto livre exigindo conhecer UID aleatÃ³rio).
      // O usuÃ¡rio escolhe pelo label/preview do bloco; o que vai pro banco continua sendo o id (UID).
      return <div>
        <label style={LS}>{noSel.tipo === "pular" ? "Pular PARA o bloco:" : "Retornar PARA o bloco:"}</label>
        <select value={d.alvo||""} onChange={e => u({alvo: e.target.value})} style={IS}>
          <option value="">â€” Selecione um bloco â€”</option>
          {nos
            .filter(n => n.id !== noSel.id)
            .map(n => {
              const cfg = B[n.tipo];
              const preview = getPreview(n).slice(0, 35);
              return (
                <option key={n.id} value={n.id}>
                  {cfg?.icone} {cfg?.label} â€” {preview}
                </option>
              );
            })}
        </select>
        {d.alvo && !nos.find(n => n.id === d.alvo) && (
          <p style={{color:"#ef4444", fontSize:10, margin:"4px 0 0"}}>
            âš ï¸ Bloco alvo nÃ£o existe mais (pode ter sido excluÃ­do). Selecione outro.
          </p>
        )}
        <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0", lineHeight:1.3}}>
          {noSel.tipo === "pular"
            ? "ðŸ’¡ Pula a execuÃ§Ã£o direto pro bloco escolhido (atalho/jump)."
            : "ðŸ’¡ Volta a execuÃ§Ã£o pro bloco escolhido (loop/retry)."}
        </p>
      </div>;
    case "google_sheets":
      return <>
        <div style={{background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:10, marginBottom:10}}>
          <p style={{color:"#14532d", fontSize:11, margin:0, fontWeight:700}}>ðŸ“Š Google Sheets via Apps Script</p>
          <p style={{color:"#16a34a", fontSize:10, margin:"4px 0 6px", lineHeight:1.5}}>
            <b>Como configurar (5 minutos, sem OAuth):</b><br/>
            1. Abra seu Sheets â†’ <b>ExtensÃµes â†’ Apps Script</b><br/>
            2. Cole o cÃ³digo de webhook (veja botÃ£o abaixo)<br/>
            3. <b>Implantar â†’ Nova implantaÃ§Ã£o â†’ Aplicativo da Web</b><br/>
            4. Quem tem acesso: <b>Qualquer pessoa</b> â†’ Implantar<br/>
            5. Copie a URL e cole aqui embaixo ðŸ‘‡
          </p>
          <button
            type="button"
            onClick={() => {
              const codigo = `// Cole isso no Apps Script do seu Google Sheets
// Implante como "Aplicativo da Web" com acesso "Qualquer pessoa"
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = body.aba ? ss.getSheetByName(body.aba) : ss.getSheets()[0];
    if (!aba) return saida({ok:false, erro:"Aba nÃ£o encontrada: " + body.aba});
    const dados = (body.dados || "").toString().split(",").map(s => s.trim());

    if (body.acao === "append") {
      aba.appendRow(dados);
      return saida({ok:true, linha: aba.getLastRow()});
    }
    if (body.acao === "update") {
      // Atualiza a Ãºltima linha (ou faz lookup pela primeira coluna)
      const ultima = aba.getLastRow();
      if (ultima < 1) return saida({ok:false, erro:"Sheet vazia"});
      aba.getRange(ultima, 1, 1, dados.length).setValues([dados]);
      return saida({ok:true, linha: ultima});
    }
    if (body.acao === "get") {
      const vals = aba.getDataRange().getValues();
      return saida({ok:true, dados: vals});
    }
    return saida({ok:false, erro: "AÃ§Ã£o invÃ¡lida: " + body.acao});
  } catch (err) {
    return saida({ok:false, erro: err.toString()});
  }
}
function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;
              navigator.clipboard.writeText(codigo);
              alert("âœ… CÃ³digo copiado!\n\nAgora cole no Apps Script do seu Google Sheets.");
            }}
            style={{background:"#16a34a", color:"#fff", border:"none", borderRadius:6, padding:"6px 12px", fontSize:11, cursor:"pointer", fontWeight:700, marginTop:4}}
          >
            ðŸ“‹ Copiar cÃ³digo do Apps Script
          </button>
        </div>
        {F("URL do Webhook (Apps Script Web App)","webhook_url","url","https://script.google.com/macros/s/AKfy.../exec")}
        {F("Aba (opcional)","aba","text","Sheet1")}
        {S("AÃ§Ã£o","acao",[
          {value:"append", label:"Adicionar nova linha"},
          {value:"update", label:"Atualizar Ãºltima linha"},
          {value:"get",    label:"Buscar dados"}
        ])}
        {T("Dados (separados por vÃ­rgula)","dados","{{nome}}, {{email}}, {{telefone}}",80)}
        {VarPill("Salvar resposta em (opcional)","variavel_resposta","ex: resposta_sheets")}
        <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0"}}>
          ðŸ’¡ Use {`{{variavel}}`} nos campos. SaÃ­das: <b>Sucesso</b> / <b>Erro</b>.
        </p>
      </>;
    case "http_request":
      return <>
        {F("URL","url","url","https://api.exemplo.com")}
        {S("MÃ©todo","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
        {T("Headers JSON","headers",'{"Content-Type":"application/json"}',60)}
        {T("Body JSON","body",'{"chave":"{{variavel}}"}',60)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_api")}
        {VarPill("Salvar status em", "variavel_status", "ex: status_api")}
      </>;
    case "openai":
      return <>
        {F("API Key","apiKey","password","sk-...")}
        {S("Modelo","modelo",[{value:"gpt-4o",label:"GPT-4o"},{value:"gpt-4o-mini",label:"GPT-4o Mini"},{value:"gpt-3.5-turbo",label:"GPT-3.5"}])}
        {T("Prompt do sistema","prompt","VocÃª Ã© um assistente...",100)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_ia")}
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,color:"#1f2937",fontSize:12}}>
          <input type="checkbox" checked={d.enviar_resposta !== false} onChange={e => u({ enviar_resposta: e.target.checked })} />
          Enviar resposta pro cliente automaticamente
        </label>
      </>;
    case "fluxo_ia": {
      const camposIA: Array<{nome:string;label:string;tipo:string;obrigatoria:boolean;diferente_de?:string}> =
        Array.isArray(d.variaveis) ? d.variaveis : [];
      const atualizarCampoIA = (indice: number, patch: Record<string, any>) => {
        const novos = camposIA.map((campo, i) => i === indice ? { ...campo, ...patch } : campo);
        u({ variaveis: novos });
      };
      const removerCampoIA = (indice: number) => u({ variaveis: camposIA.filter((_, i) => i !== indice) });
      type ConsultaIA = {
        id:string; nome:string; descricao:string; tipo:"http"|"script";
        variavel_gatilho:string; variavel_resultado:string; obrigatoria:boolean;
        resultado_disponivel?:string; resultado_indisponivel?:string;
        acao_indisponibilidade?:"aguardar"|"finalizar"; mensagem_indisponibilidade?:string;
        retorno_negativo_aplicar_etiqueta?:boolean; retorno_negativo_nome_etiqueta?:string;
        retorno_negativo_finalizar_atendimento?:boolean; retorno_negativo_mensagem?:string;
        url?:string; metodo?:string; headers?:string|Record<string,string>; body?:string; codigo?:string;
      };
      const consultasIA: ConsultaIA[] = Array.isArray(d.consultas) ? d.consultas : [];
      const serializarHeadersConsulta = (headers: ConsultaIA["headers"]) => {
        if (!headers) return "";
        if (typeof headers === "string") return headers;
        try { return JSON.stringify(headers, null, 2); } catch { return ""; }
      };
      const atualizarConsultaIA = (indice: number, patch: Partial<ConsultaIA>) => {
        u({ consultas: consultasIA.map((consulta, i) => i === indice ? { ...consulta, ...patch } : consulta) });
      };
      const removerConsultaIA = (indice: number) => u({ consultas: consultasIA.filter((_, i) => i !== indice) });
      type LembreteReengajamento = { minutos:number; mensagem:string };
      const lembretesReengajamento: LembreteReengajamento[] =
        Array.isArray(d.reengajamento_lembretes) && d.reengajamento_lembretes.length
          ? d.reengajamento_lembretes
          : [{
              minutos:Math.max(1,Number(d.reengajamento_minutos || 10)),
              mensagem:d.reengajamento_mensagem || "Oi, {{nome}}! Ainda estÃ¡ por aÃ­? Posso continuar seu atendimento? ðŸ˜Š"
            }];
      const atualizarLembrete = (indice:number, patch:Partial<LembreteReengajamento>) =>
        u({reengajamento_lembretes:lembretesReengajamento.map((item,i)=>i===indice?{...item,...patch}:item)});
      const removerLembrete = (indice:number) =>
        u({reengajamento_lembretes:lembretesReengajamento.filter((_,i)=>i!==indice)});
      return <>
        <div style={{background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:8,padding:10,marginBottom:10}}>
          <p style={{color:"#6d28d9",fontSize:12,fontWeight:800,margin:"0 0 4px"}}>âœ¨ Fluxo por IA com variÃ¡veis validadas</p>
          <p style={{color:"#6b7280",fontSize:10,margin:0,lineHeight:1.4}}>
            A IA conversa, salva apenas valores vÃ¡lidos, mostra um resumo e sÃ³ libera a saÃ­da depois da confirmaÃ§Ã£o do cliente.
            Conecte a saÃ­da <b>Dados confirmados</b> ao bloco <b>Enviar Venda</b>.
          </p>
        </div>
        <ExtensoesFluxoIA dados={d} onChange={u}/>
        {F("API Key","apiKey","password","sk-...")}
        {S("Modelo","modelo",[{value:"gpt-4o",label:"GPT-4o"},{value:"gpt-4o-mini",label:"GPT-4o Mini"}])}
        {T("Prompt de comportamento","prompt","Explique como a IA deve conduzir o atendimento...",100)}
        {T("Mensagem para iniciar a coleta","mensagem_inicial","OlÃ¡! Vou confirmar alguns dados com vocÃª.",70)}
        <label style={{display:"flex",alignItems:"flex-start",gap:7,margin:"6px 0 10px",padding:"9px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,color:"#374151",fontSize:10,lineHeight:1.4}}>
          <input type="checkbox" checked={d.mensagem_inicial_literal === true} onChange={e=>u({mensagem_inicial_literal:e.target.checked})} style={{marginTop:2}}/>
          <span><b>Enviar exatamente esta mensagem</b><br/>A IA sÃ³ assume depois que o cliente responder. Desmarque se o texto acima for apenas uma instruÃ§Ã£o para a IA criar a abertura.</span>
        </label>
        {S("Tempo para juntar mensagens","agrupamento_ms",[
          {value:"2000",label:"2 segundos"},{value:"3500",label:"3,5 segundos"},{value:"5000",label:"5 segundos"},{value:"7000",label:"7 segundos"}
        ])}
        <div style={{marginTop:12,background:d.midia_ia_extensao_ativa === true?"linear-gradient(135deg,#f0fdfa,#eff6ff)":"#f8fafc",border:d.midia_ia_extensao_ativa === true?"1px solid #5eead4":"1px solid #cbd5e1",borderRadius:11,padding:11,boxShadow:d.midia_ia_extensao_ativa === true?"0 8px 24px rgba(13,148,136,.10)":"none"}}>
          <label style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,cursor:"pointer"}}>
            <span style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <span style={{display:"grid",placeItems:"center",width:32,height:32,borderRadius:9,background:d.midia_ia_extensao_ativa === true?"#0f766e":"#e2e8f0",color:d.midia_ia_extensao_ativa === true?"#fff":"#475569",fontSize:16,flexShrink:0}}>ðŸ“Ž</span>
              <span><b style={{display:"block",color:"#0f172a",fontSize:12}}>Leitura de fotos e arquivos</b><span style={{display:"block",color:"#64748b",fontSize:10,lineHeight:1.45,marginTop:2}}>ExtensÃ£o isolada do vendedor IA. Ao ligar, a leitura vale em todos os blocos Fluxo por IA deste fluxo.</span></span>
            </span>
            <span style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
              <span style={{fontSize:8,fontWeight:900,color:salvandoMidiaId===id?"#92400e":"#0f766e",background:salvandoMidiaId===id?"#fef3c7":"#ccfbf1",borderRadius:999,padding:"4px 7px"}}>
                {salvandoMidiaId===id ? "SALVANDO..." : d.midia_ia_extensao_ativa === true ? "ATIVA E SALVA" : "DESLIGADA"}
              </span>
              <input
                type="checkbox"
                disabled={salvandoMidiaId===id}
                checked={d.midia_ia_extensao_ativa === true}
                onChange={e=>{
                  const ativa=e.target.checked;
                  void salvarConfiguracaoMidia(id,{
                    midia_ia_extensao_ativa:ativa,
                    ext_multimidia_ativa:ativa
                  });
                }}
              />
            </span>
          </label>
          {d.midia_ia_extensao_ativa === true && <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #99f6e4"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <label style={{display:"flex",alignItems:"flex-start",gap:7,color:"#134e4a",fontSize:10,lineHeight:1.4,cursor:"pointer",background:"#fff",border:"1px solid #ccfbf1",borderRadius:8,padding:8}}><input type="checkbox" disabled={salvandoMidiaId===id} checked={d.midia_ia_imagens_ativa !== false} onChange={e=>void salvarConfiguracaoMidia(id,{midia_ia_imagens_ativa:e.target.checked})}/><span><b>Interpretar fotos</b><br/>LÃª JPG, PNG, WEBP e GIF.</span></label>
              <label style={{display:"flex",alignItems:"flex-start",gap:7,color:"#134e4a",fontSize:10,lineHeight:1.4,cursor:"pointer",background:"#fff",border:"1px solid #ccfbf1",borderRadius:8,padding:8}}><input type="checkbox" disabled={salvandoMidiaId===id} checked={d.midia_ia_arquivos_ativa !== false} onChange={e=>void salvarConfiguracaoMidia(id,{midia_ia_arquivos_ativa:e.target.checked})}/><span><b>Interpretar arquivos</b><br/>LÃª PDF, texto e documentos compatÃ­veis.</span></label>
            </div>
            <div style={{marginTop:8}}><label style={LS}>Tamanho mÃ¡ximo por mÃ­dia (MB)</label><input type="number" min={1} max={25} value={d.midia_ia_tamanho_max_mb ?? 15} onChange={e=>u({midia_ia_tamanho_max_mb:Math.max(1,Math.min(25,Number(e.target.value)||15))})} style={IS}/></div>
            <div style={{marginTop:8}}><label style={LS}>Mensagem se nÃ£o conseguir ler</label><textarea value={d.midia_ia_mensagem_falha || "Recebi a foto ou o arquivo, mas nÃ£o consegui ler com seguranÃ§a. Pode enviar novamente ou digitar as informaÃ§Ãµes, por favor?"} onChange={e=>u({midia_ia_mensagem_falha:e.target.value})} style={{...IS,minHeight:64,resize:"vertical"}}/></div>
            <p style={{fontSize:9,color:"#115e59",margin:"7px 0 0"}}>Usa a mesma API Key e o mesmo modelo deste bloco. O conteÃºdo extraÃ­do vira apenas contexto interno da conversa.</p>
          </div>}
        </div>
        <div><label style={LS}>Limite de recusas antes de desistir</label><input type="number" min={0} max={20} value={d.limite_recusas ?? 3} onChange={e=>u({limite_recusas:Number(e.target.value)})} style={IS}/><p style={{fontSize:9,color:"#6b7280",margin:"4px 0 0"}}>0 = sem limite. Conecte a saÃ­da â€œLimite atingidoâ€ a Atualizar Venda (ex.: CANCELADA/DESISTÃŠNCIA) e depois a Finalizar.</p></div>
        <div style={{marginTop:12,background:d.followups_extensao_ativa === true?"linear-gradient(135deg,#ecfeff,#eff6ff)":"#f8fafc",border:d.followups_extensao_ativa === true?"1px solid #67e8f9":"1px solid #cbd5e1",borderRadius:11,padding:11,boxShadow:d.followups_extensao_ativa === true?"0 8px 24px rgba(8,145,178,.10)":"none"}}>
          <label style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,cursor:"pointer"}}>
            <span style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <span style={{display:"grid",placeItems:"center",width:32,height:32,borderRadius:9,background:d.followups_extensao_ativa === true?"#0891b2":"#e2e8f0",color:d.followups_extensao_ativa === true?"#fff":"#475569",fontSize:16,flexShrink:0}}>â°</span>
              <span>
                <b style={{display:"block",color:"#0f172a",fontSize:12}}>Agenda inteligente e lembretes</b>
                <span style={{display:"block",color:"#64748b",fontSize:10,lineHeight:1.45,marginTop:2}}>ExtensÃ£o isolada do vendedor IA. Desligada, nÃ£o intercepta nenhuma mensagem nem altera o fluxo principal.</span>
              </span>
            </span>
            <span style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
              <span style={{fontSize:9,fontWeight:900,color:d.followups_extensao_ativa === true?"#0e7490":"#64748b",background:d.followups_extensao_ativa === true?"#cffafe":"#e2e8f0",borderRadius:999,padding:"4px 7px"}}>{d.followups_extensao_ativa === true?"ATIVA":"DESLIGADA"}</span>
              <input
                type="checkbox"
                checked={d.followups_extensao_ativa === true}
                onChange={e=>{
                  const ativa=e.target.checked;
                  u({
                    followups_extensao_ativa:ativa,
                    ext_followups_ativa:ativa
                  });
                }}
              />
            </span>
          </label>
        </div>
        {d.followups_extensao_ativa === true && <>
        <div style={{marginTop:12,background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:9,padding:10}}>
          <label style={{display:"flex",alignItems:"flex-start",gap:7,color:"#9a3412",fontSize:11,lineHeight:1.4,cursor:"pointer"}}>
            <input type="checkbox" checked={d.reengajamento_ativo === true} onChange={e=>u({reengajamento_ativo:e.target.checked})} style={{marginTop:2}}/>
            <span><b>Lembrar cliente que parou de responder</b><br/>O sistema retoma esta mesma conversa automaticamente, sem reiniciar o fluxo.</span>
          </label>
          {d.reengajamento_ativo === true && <div style={{marginTop:9}}>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {lembretesReengajamento.map((lembrete,indice)=>(
                <div key={indice} style={{background:"#fff",border:"1px solid #fed7aa",borderRadius:8,padding:9}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}><b style={{fontSize:10,color:"#9a3412"}}>Lembrete {indice+1}</b>{lembretesReengajamento.length>1 && <button type="button" onClick={()=>removerLembrete(indice)} style={{background:"#fee2e2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,padding:"4px 7px",fontSize:9,cursor:"pointer"}}>Remover</button>}</div>
                  <label style={LS}>{indice===0?"Enviar apÃ³s quantos minutos sem resposta":"Aguardar quantos minutos apÃ³s o lembrete anterior"}</label>
                  <input type="number" min={1} max={1440} value={lembrete.minutos ?? 10} onChange={e=>atualizarLembrete(indice,{minutos:Math.max(1,Number(e.target.value)||10)})} style={IS}/>
                  <label style={{...LS,marginTop:7}}>Mensagem deste lembrete</label>
                  <textarea value={lembrete.mensagem || ""} onChange={e=>atualizarLembrete(indice,{mensagem:e.target.value})} placeholder="Mensagem que serÃ¡ enviada ao cliente" style={{...IS,minHeight:70,resize:"vertical"}}/>
                </div>
              ))}
            </div>
            {lembretesReengajamento.length<20 && <button type="button" onClick={()=>u({reengajamento_lembretes:[...lembretesReengajamento,{minutos:10,mensagem:"Oi, {{nome}}! Se ainda quiser continuar, Ã© sÃ³ me responder por aqui. ðŸ˜Š"}]})} style={{display:"block",width:"100%",marginTop:8,background:"#ffedd5",border:"1px dashed #fb923c",color:"#9a3412",borderRadius:7,padding:"9px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>+ Adicionar lembrete</button>}
            <div style={{marginTop:10,padding:9,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8}}>
              <label style={{display:"flex",alignItems:"flex-start",gap:7,color:"#991b1b",fontSize:10,lineHeight:1.4,cursor:"pointer"}}>
                <input type="checkbox" checked={d.reengajamento_finalizar_automatico === true} onChange={e=>u({reengajamento_finalizar_automatico:e.target.checked})} style={{marginTop:2}}/>
                <span><b>Finalizar automaticamente se continuar sem resposta</b><br/>Encerra o atendimento e move de Abertos para Finalizados, sem precisar conectar outro bloco.</span>
              </label>
              {d.reengajamento_finalizar_automatico === true && <div style={{marginTop:7}}><label style={LS}>Finalizar quantos minutos apÃ³s o Ãºltimo lembrete</label><input type="number" min={1} max={10080} value={d.reengajamento_finalizar_apos_minutos ?? 120} onChange={e=>u({reengajamento_finalizar_apos_minutos:Math.max(1,Number(e.target.value)||120)})} style={IS}/><p style={{fontSize:9,color:"#991b1b",margin:"4px 0 0"}}>Exemplo: 120 minutos depois da Ãºltima mensagem da IA.</p></div>}
            </div>
            <p style={{fontSize:9,color:"#9a3412",margin:"6px 0 0"}}>Cada mensagem Ã© enviada apenas uma vez. Aceita variÃ¡veis como {"{{nome}}"}.</p>
          </div>}
        </div>
        <div style={{marginTop:10,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:9,padding:10}}>
          <label style={{display:"flex",alignItems:"flex-start",gap:7,color:"#1d4ed8",fontSize:11,lineHeight:1.4,cursor:"pointer"}}>
            <input type="checkbox" checked={d.reengajamento_inteligente_ativo !== false} onChange={e=>u({reengajamento_inteligente_ativo:e.target.checked})} style={{marginTop:2}}/>
            <span><b>Lembretes inteligentes por data e horario</b><br/>Funcionam junto dos lembretes insistentes. Se o cliente pedir 'fala comigo amanha', a IA pergunta o horario, pausa os lembretes comuns e agenda o retorno automaticamente.</span>
          </label>
          {d.reengajamento_inteligente_ativo !== false && <div style={{marginTop:9,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={LS}>Enviar quantos minutos antes</label><input type="number" min={0} max={1440} value={d.reengajamento_inteligente_antecedencia_minutos ?? 10} onChange={e=>u({reengajamento_inteligente_antecedencia_minutos:Math.max(0,Number(e.target.value)||0)})} style={IS}/><p style={{fontSize:9,color:"#1e40af",margin:"4px 0 0"}}>Ex.: compromisso as 8h e antecedencia 10 = envio as 7h50.</p></div>
            <div><label style={LS}>Agendar no maximo por quantos dias</label><input type="number" min={1} max={365} value={d.reengajamento_inteligente_maximo_dias ?? 30} onChange={e=>u({reengajamento_inteligente_maximo_dias:Math.max(1,Number(e.target.value)||30)})} style={IS}/><p style={{fontSize:9,color:"#1e40af",margin:"4px 0 0"}}>Evita datas muito distantes informadas por engano.</p></div>
          </div>}
          {d.reengajamento_inteligente_ativo !== false && <div style={{marginTop:8}}>
            <label style={LS}>Mensagem do retorno programado</label>
            <textarea value={d.reengajamento_inteligente_mensagem || "Oi, {{nome}}! ðŸ˜Š Estou passando conforme combinamos. Podemos continuar exatamente de onde paramos?"} onChange={e=>u({reengajamento_inteligente_mensagem:e.target.value})} style={{...IS,minHeight:64,resize:"vertical"}}/>
            <p style={{fontSize:9,color:"#1e40af",margin:"4px 0 0"}}>Aceita variÃ¡veis do fluxo, como {"{{nome}}"}. A mensagem Ã© enviada uma Ãºnica vez.</p>
          </div>}
          <p style={{fontSize:9,color:"#1e3a8a",margin:"8px 0 0"}}>Se o cliente responder antes do horario combinado, o retorno agendado e cancelado e a conversa continua normalmente.</p>
        </div>
        </>}
        <div style={{marginTop:10}}>
          <label style={LS}>VariÃ¡veis que a IA precisa salvar</label>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {camposIA.map((campo, indice) => (
              <div key={indice} style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:9}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:6,marginBottom:6}}>
                  <input value={campo.nome || ""} placeholder="variavel: nome" onChange={e=>atualizarCampoIA(indice,{nome:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                  <input value={campo.label || ""} placeholder="Pergunta/campo: Nome completo" onChange={e=>atualizarCampoIA(indice,{label:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <select value={campo.tipo || "texto"} onChange={e=>atualizarCampoIA(indice,{tipo:e.target.value})} style={{...IS,flex:1,fontSize:10,padding:"6px 8px"}}>
                    <option value="nome">Nome</option>
                    <option value="texto">Texto</option>
                    <option value="email">E-mail</option>
                    <option value="cpf">CPF</option>
                    <option value="cep">CEP</option>
                    <option value="telefone">Telefone</option>
                    <option value="numero">NÃºmero</option>
                    <option value="data">Data</option>
                  </select>
                  <label style={{display:"flex",alignItems:"center",gap:5,color:"#374151",fontSize:10}}>
                    <input type="checkbox" checked={campo.obrigatoria !== false} onChange={e=>atualizarCampoIA(indice,{obrigatoria:e.target.checked})}/>
                    ObrigatÃ³ria
                  </label>
                  <button type="button" onClick={()=>removerCampoIA(indice)} style={{background:"#fee2e2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:10}}>Remover</button>
                </div>
                <div style={{marginTop:7}}>
                  <label style={{...LS,fontSize:9}}>Deve ser diferente da variÃ¡vel (opcional)</label>
                  <select value={campo.diferente_de || ""} onChange={e=>atualizarCampoIA(indice,{diferente_de:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px"}}>
                    <option value="">-- nao comparar com outra variavel --</option>
                    {variaveisDoFluxo.filter(nome=>nome !== campo.nome).map(nome=>(
                      <option key={nome} value={nome}>{`{{${nome}}}`}</option>
                    ))}
                  </select>
                  <p style={{fontSize:9,color:"#6b7280",margin:"3px 0 0"}}>ComparaÃ§Ã£o exata feita pelo backend. Para um novo CPF, informe a variÃ¡vel que guarda o CPF anterior.</p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={()=>u({variaveis:[...camposIA,{nome:"",label:"",tipo:"texto",obrigatoria:true}]})}
            style={{marginTop:8,background:"#ede9fe",border:"1px solid #c4b5fd",color:"#6d28d9",borderRadius:7,padding:"7px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
            + Adicionar variÃ¡vel
          </button>
        </div>

        <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:12}}>
          <label style={LS}>Consultas automaticas (link, API ou JavaScript)</label>
          <p style={{color:"#6b7280",fontSize:10,lineHeight:1.45,margin:"4px 0 9px"}}>
            A consulta dispara assim que a IA salvar uma variavel valida. O retorno entra no contexto da conversa,
            mas URL, codigo, cabecalhos e chaves nunca aparecem para o cliente.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {consultasIA.map((consulta, indice) => (
              <div key={consulta.id || indice} style={{background:"#f0fdfa",border:"1px solid #99f6e4",borderRadius:9,padding:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:6,marginBottom:6}}>
                  <input value={consulta.nome || ""} placeholder="Ex: Consultar cobertura do CEP" onChange={e=>atualizarConsultaIA(indice,{nome:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                  <select value={consulta.tipo || "http"} onChange={e=>atualizarConsultaIA(indice,{tipo:e.target.value as "http"|"script"})} style={{...IS,fontSize:10,padding:"6px 8px"}}>
                    <option value="http">Link / API HTTP</option>
                    <option value="script">JavaScript</option>
                  </select>
                </div>
                <textarea value={consulta.descricao || ""} placeholder="Explique para a IA como interpretar o retorno. Ex: Se retornar Temos disponibilidade, continue; caso contrario, peca outro CEP." onChange={e=>atualizarConsultaIA(indice,{descricao:e.target.value})} style={{...IS,minHeight:58,fontSize:10,padding:"7px 8px",resize:"vertical",marginBottom:6}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  <input value={consulta.variavel_gatilho || ""} placeholder="Disparar quando salvar: cep" onChange={e=>atualizarConsultaIA(indice,{variavel_gatilho:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                  <input value={consulta.variavel_resultado || ""} placeholder="Salvar retorno em: resposta_cep" onChange={e=>atualizarConsultaIA(indice,{variavel_resultado:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                </div>
                {consulta.tipo === "script" ? (
                  <textarea value={consulta.codigo || ""} placeholder={"const resposta = await fetch(\"https://.../{{cep}}\")\nsetVariable(\"resposta_cep\", await resposta.text())"} onChange={e=>atualizarConsultaIA(indice,{codigo:e.target.value})} style={{...IS,minHeight:110,fontFamily:"monospace",fontSize:9,padding:"7px 8px",resize:"vertical"}}/>
                ) : (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"82px 1fr",gap:6,marginBottom:6}}>
                      <select value={consulta.metodo || "GET"} onChange={e=>atualizarConsultaIA(indice,{metodo:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px"}}>
                        <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option>
                      </select>
                      <input value={consulta.url || ""} placeholder="https://api.exemplo.com/consulta?cep={{cep}}" onChange={e=>atualizarConsultaIA(indice,{url:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px"}}/>
                    </div>
                    <textarea value={serializarHeadersConsulta(consulta.headers)} placeholder={'Headers JSON opcional: {"Authorization":"Bearer ..."}'} onChange={e=>atualizarConsultaIA(indice,{headers:e.target.value})} style={{...IS,minHeight:48,fontFamily:"monospace",fontSize:9,padding:"7px 8px",resize:"vertical",marginBottom:6}}/>
                    {(consulta.metodo || "GET") !== "GET" && (
                      <textarea value={consulta.body || ""} placeholder={'Body: {"cep":"{{cep}}"}'} onChange={e=>atualizarConsultaIA(indice,{body:e.target.value})} style={{...IS,minHeight:55,fontFamily:"monospace",fontSize:9,padding:"7px 8px",resize:"vertical"}}/>
                    )}
                  </>
                )}
                <div style={{marginTop:8,padding:9,background:"#fff",border:"1px solid #a7f3d0",borderRadius:8}}>
                  <label style={{...LS,fontSize:9,color:"#047857"}}>DecisÃ£o apÃ³s a consulta</label>
                  <p style={{fontSize:9,color:"#6b7280",margin:"3px 0 7px",lineHeight:1.4}}>
                    O backend compara o retorno da consulta. Separe respostas alternativas com ponto e vÃ­rgula.
                  </p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                    <input value={consulta.resultado_disponivel || ""} placeholder="DisponÃ­vel: Temos disponibilidade" onChange={e=>atualizarConsultaIA(indice,{resultado_disponivel:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px",borderColor:"#86efac"}}/>
                    <input value={consulta.resultado_indisponivel || ""} placeholder="IndisponÃ­vel: NÃ£o temos disponibilidade" onChange={e=>atualizarConsultaIA(indice,{resultado_indisponivel:e.target.value})} style={{...IS,fontSize:10,padding:"6px 8px",borderColor:"#fca5a5"}}/>
                  </div>
                  <div style={{marginTop:8,padding:9,background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:7}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:800,color:"#0f172a"}}>AÃ§Ãµes isoladas para retorno negativo</div>
                        <div style={{fontSize:9,color:"#64748b",marginTop:2}}>Com as duas opÃ§Ãµes desligadas, nada muda no atendimento atual.</div>
                      </div>
                      <span style={{fontSize:8,fontWeight:800,color:"#475569",background:"#e2e8f0",borderRadius:999,padding:"3px 6px"}}>ISOLADO</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                      <div style={{border:"1px solid #fecaca",background:"#fff",borderRadius:8,padding:8}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:7}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#7f1d1d"}}>Marcar conversa como inviÃ¡vel</div>
                          <button type="button" onClick={()=>atualizarConsultaIA(indice,{retorno_negativo_aplicar_etiqueta:consulta.retorno_negativo_aplicar_etiqueta !== true})}
                            style={{border:0,borderRadius:999,padding:"4px 9px",cursor:"pointer",fontSize:8,fontWeight:900,color:"#fff",background:consulta.retorno_negativo_aplicar_etiqueta === true ? "#16a34a" : "#94a3b8"}}>
                            {consulta.retorno_negativo_aplicar_etiqueta === true ? "ON" : "OFF"}
                          </button>
                        </div>
                        {consulta.retorno_negativo_aplicar_etiqueta === true && (
                          <input value={consulta.retorno_negativo_nome_etiqueta || "SEM VIABILIDADE"} placeholder="Nome da etiqueta" onChange={e=>atualizarConsultaIA(indice,{retorno_negativo_nome_etiqueta:e.target.value})} style={{...IS,fontSize:9,padding:"6px 7px",marginTop:7}}/>
                        )}
                      </div>
                      <div style={{border:"1px solid #fecaca",background:"#fff",borderRadius:8,padding:8}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:7}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#7f1d1d"}}>Finalizar atendimento</div>
                          <button type="button" onClick={()=>atualizarConsultaIA(indice,{retorno_negativo_finalizar_atendimento:consulta.retorno_negativo_finalizar_atendimento !== true})}
                            style={{border:0,borderRadius:999,padding:"4px 9px",cursor:"pointer",fontSize:8,fontWeight:900,color:"#fff",background:consulta.retorno_negativo_finalizar_atendimento === true ? "#16a34a" : "#94a3b8"}}>
                            {consulta.retorno_negativo_finalizar_atendimento === true ? "ON" : "OFF"}
                          </button>
                        </div>
                        <div style={{fontSize:8,color:"#64748b",marginTop:6}}>Move a conversa para Finalizados depois de enviar a mensagem.</div>
                      </div>
                    </div>
                    {(consulta.retorno_negativo_aplicar_etiqueta === true || consulta.retorno_negativo_finalizar_atendimento === true) && (
                      <textarea value={consulta.retorno_negativo_mensagem || ""} placeholder="Mensagem opcional para o cliente. Vazio usa a mensagem atual de indisponibilidade." onChange={e=>atualizarConsultaIA(indice,{retorno_negativo_mensagem:e.target.value})} style={{...IS,minHeight:62,fontSize:10,padding:"7px 8px",resize:"vertical",marginTop:7}}/>
                    )}
                  </div>                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7}}>
                  <label style={{display:"flex",alignItems:"center",gap:5,color:"#374151",fontSize:10}}>
                    <input type="checkbox" checked={consulta.obrigatoria !== false} onChange={e=>atualizarConsultaIA(indice,{obrigatoria:e.target.checked})}/>
                    A consulta precisa concluir antes de confirmar os dados
                  </label>
                  <button type="button" onClick={()=>removerConsultaIA(indice)} style={{background:"#fee2e2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:10}}>Remover</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={()=>u({consultas:[...consultasIA,{
              id:"consulta_"+Date.now(),nome:"",descricao:"",tipo:"http",variavel_gatilho:"cep",
              variavel_resultado:"resposta_cep",obrigatoria:true,resultado_disponivel:"",resultado_indisponivel:"",
              acao_indisponibilidade:"aguardar",mensagem_indisponibilidade:"",retorno_negativo_aplicar_etiqueta:false,
              retorno_negativo_nome_etiqueta:"SEM VIABILIDADE",retorno_negativo_finalizar_atendimento:false,retorno_negativo_mensagem:"",metodo:"GET",url:"",headers:"",body:"",codigo:""
            }]})}
            style={{marginTop:8,background:"#ccfbf1",border:"1px solid #5eead4",color:"#0f766e",borderRadius:7,padding:"7px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
            + Adicionar consulta automatica
          </button>
        </div>
      </>;
    }

    case "claude_ai":
      return <>
        {F("API Key","apiKey","password","sk-ant-...")}
        {S("Modelo","modelo",[{value:"claude-opus-4-5",label:"Claude Opus 4.5"},{value:"claude-sonnet-4-20250514",label:"Claude Sonnet 4"},{value:"claude-haiku-4-5",label:"Claude Haiku"}])}
        {T("Prompt do sistema","prompt","VocÃª Ã© um assistente...",100)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_ia")}
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,color:"#1f2937",fontSize:12}}>
          <input type="checkbox" checked={d.enviar_resposta !== false} onChange={e => u({ enviar_resposta: e.target.checked })} />
          Enviar resposta pro cliente automaticamente
        </label>
      </>;
    case "gmail":
      return <>
        <div style={{background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:10, marginBottom:10}}>
          <p style={{color:"#1e40af", fontSize:11, margin:0, fontWeight:700}}>ðŸ“¨ Envio de email via SMTP</p>
          <p style={{color:"#3b82f6", fontSize:10, margin:"4px 0 0", lineHeight:1.4}}>
            Use Gmail (com <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{color:"#2563eb",fontWeight:700}}>App Password</a>), SendGrid, Mailgun ou qualquer SMTP.
          </p>
        </div>
        <p style={{color:"#6b7280", fontSize:10, margin:"6px 0 6px", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4}}>Servidor SMTP</p>
        <div style={{display:"grid", gridTemplateColumns:"1fr 80px", gap:8}}>
          {F("Host","smtp_host","text","smtp.gmail.com")}
          {F("Porta","smtp_port","number","587")}
        </div>
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:6,color:"#1f2937",fontSize:12}}>
          <input type="checkbox" checked={!!d.smtp_secure} onChange={e => u({ smtp_secure: e.target.checked })} />
          ConexÃ£o SSL/TLS (porta 465). Desmarcado = STARTTLS (porta 587).
        </label>
        {F("UsuÃ¡rio SMTP","smtp_user","text","seu@gmail.com")}
        {F("Senha SMTP / App Password","smtp_pass","password","â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢")}
        <p style={{color:"#6b7280", fontSize:10, margin:"6px 0 6px", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4}}>Mensagem</p>
        {F("Nome do remetente (opcional)","from_name","text","Minha Empresa")}
        {F("Para","para","text","cliente@email.com  â€¢  aceita {{variavel}}")}
        {F("Assunto","assunto","text","Bem-vindo, {{nome}}!")}
        {T("Corpo do email (texto ou HTML)","corpo","OlÃ¡ {{nome}},\n\nObrigado pelo contato!\n\nAtenciosamente.",140)}
        <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0"}}>
          ðŸ’¡ Use {`{{variavel}}`} no Para/Assunto/Corpo. SaÃ­das: <b>Enviado</b> (ok) / <b>Erro</b> (falha SMTP).
        </p>
      </>;

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ†• v20 â€” META PIXEL / CONVERSIONS API
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Manda um evento de conversÃ£o pra Meta (Lead, Purchase, etc), pro pixel/anÃºncio
    // do cliente "aprender" e otimizar campanhas com base nas conversÃµes do chatbot.
    //
    // âš ï¸ BACKEND (executor do fluxo na VPS) â€” ao processar este bloco:
    //   1. Resolver {{variaveis}} em valor/evento_custom
    //   2. POST https://graph.facebook.com/{api_version}/{pixel_id}/events?access_token={access_token}
    //        body: { data: [{
    //          event_name, event_time: <unix>, action_source: "business_messaging",
    //          user_data: { ph: sha256(telefone_e164_sem_mais) },  // hashear PII com SHA-256
    //          custom_data: { value, currency }   // sÃ³ se houver valor
    //        }], test_event_code? }
    //   3. Sucesso (HTTP 200, sem "error") â†’ saÃ­da 0; falha â†’ saÃ­da 1
    // Doc: https://developers.facebook.com/docs/marketing-api/conversions-api
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    case "meta_capi": {
      const evento = d.evento || "Lead";
      return <>
        <div style={{background:"#10b98111", border:"1px solid #10b98133", borderRadius:8, padding:12, marginBottom:8}}>
          <p style={{color:"#059669", fontSize:12, fontWeight:"bold", margin:"0 0 4px"}}>ðŸ“ˆ Meta Pixel / Conversions API</p>
          <p style={{color:"#6b7280", fontSize:11, margin:0, lineHeight:1.5}}>
            Dispara um evento de conversÃ£o pro Pixel da Meta. Serve pra seus anÃºncios "aprenderem"
            com quem converteu no chatbot (Lead, compra, etc) e otimizarem a entrega. O telefone do
            contato Ã© enviado com hash (SHA-256) pra fazer o match com a Meta.
          </p>
        </div>

        {F("Pixel ID / Dataset ID","pixel_id","text","Ex: 1473534314246940")}
        <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 8px", lineHeight:1.3}}>
          ðŸ’¡ Pega no <b>Gerenciador de Eventos da Meta â†’ ConfiguraÃ§Ãµes do conjunto de dados</b>.
        </p>

        {F("Access Token (Conversions API)","access_token","password","EAAB...")}
        <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 8px", lineHeight:1.3}}>
          ðŸ’¡ Gerado em <b>Gerenciador de Eventos â†’ ConfiguraÃ§Ãµes â†’ Gerar token de acesso</b>.
        </p>

        {S("Evento de conversÃ£o","evento",[
          {value:"Lead",                 label:"ðŸŽ¯ Lead (contato/interesse)"},
          {value:"Contact",              label:"ðŸ“ž Contact"},
          {value:"CompleteRegistration", label:"ðŸ“ CompleteRegistration (cadastro)"},
          {value:"Schedule",             label:"ðŸ“… Schedule (agendamento)"},
          {value:"Purchase",             label:"ðŸ’° Purchase (compra)"},
          {value:"SubmitApplication",    label:"ðŸ“„ SubmitApplication (proposta)"},
          {value:"custom",               label:"âš™ï¸ Evento personalizado..."},
        ])}

        {evento === "custom" && (
          <>
            {F("Nome do evento personalizado","evento_custom","text","Ex: PropostaInternet")}
            <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 8px"}}>
              ðŸ’¡ Crie eventos personalizados no Gerenciador de Eventos antes de usar aqui.
            </p>
          </>
        )}

        {/* Valor + moeda â€” fazem sentido pra Purchase, mas ficam disponÃ­veis sempre (opcional) */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 90px", gap:8}}>
          {F("Valor da conversÃ£o (opcional)","valor","text","Ex: 99.90 ou {{valor_plano}}")}
          {S("Moeda","moeda",[
            {value:"BRL",label:"BRL"},
            {value:"USD",label:"USD"},
            {value:"EUR",label:"EUR"},
          ])}
        </div>
        <p style={{color:"#6b7280", fontSize:10, margin:"-2px 0 8px", lineHeight:1.3}}>
          ðŸ’¡ Aceita {`{{variavel}}`}. Use ponto como separador decimal (99.90). Deixe vazio pra eventos sem valor.
        </p>

        {F("Test Event Code (opcional)","test_event_code","text","Ex: TEST12345")}
        <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 0", lineHeight:1.3}}>
          ðŸ’¡ Use enquanto testa: pega em <b>Gerenciador de Eventos â†’ Testar eventos</b>. Os eventos
          aparecem lÃ¡ em tempo real. <b>Remova quando for pra produÃ§Ã£o.</b>
        </p>

        <p style={{color:"#6b7280", fontSize:10, margin:"10px 0 0", lineHeight:1.4, fontStyle:"italic"}}>
          âš ï¸ SaÃ­das: <span style={{color:"#22c55e"}}>0=Sucesso</span> (Meta recebeu) /{" "}
          <span style={{color:"#ef4444"}}>1=Erro</span> (token invÃ¡lido, pixel errado, etc).
        </p>
      </>;
    }

    case "inicio":    return <>{TVar("Mensagem de boas-vindas","mensagem","OlÃ¡! Como posso ajudar?",100)}</>;
    case "comando":   return <>{F("Comando","comando","text","/start")}</>;
    case "reply":
      return <div>
        <label style={LS}>Palavras-chave (separadas por vÃ­rgula)</label>
        <input value={d.palavras||""} onChange={e => u({palavras: e.target.value})} style={IS} placeholder="oi, olÃ¡, bom dia" />
      </div>;
    case "invalido":  return <>{T("Mensagem para invÃ¡lido","mensagem","NÃ£o entendi...",80)}</>;

    // ðŸ†• Transferir â€” 2 modos: equipe/fila OU atendente humano especÃ­fico
    case "transferir": {
      const modo = d.modo || "equipe";
      const radioStyle = (ativo: boolean): React.CSSProperties => ({
        flex: 1, padding: "10px 12px", borderRadius: 8, border: ativo ? "2px solid #ef4444" : "1px solid #e5e7eb",
        background: ativo ? "#fef2f2" : "#ffffff", color: ativo ? "#dc2626" : "#6b7280",
        fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
        transition: "all 0.15s",
      });
      return <>
        <div>
          <label style={LS}>Tipo de transferÃªncia</label>
          <div style={{display:"flex", gap:6}}>
            <button type="button" onClick={() => u({modo: "equipe"})} style={radioStyle(modo === "equipe")}>
              ðŸ‘¥ Equipe / Fila
            </button>
            <button type="button" onClick={() => u({modo: "humano"})} style={radioStyle(modo === "humano")}>
              ðŸ‘¤ Atendente humano
            </button>
          </div>
          <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0", lineHeight:1.4}}>
            {modo === "humano"
              ? "Atribui o atendimento direto pro atendente escolhido."
              : "Joga o atendimento na fila â€” qualquer atendente da equipe pode pegar."}
          </p>
        </div>

        {modo === "equipe" ? (
          <div style={{marginTop:12}}>
            <label style={LS}>Fila de destino</label>
            {filasBanco.length === 0 ? (
              <div style={{background:"#fef3c7", border:"1px solid #f59e0b44", borderRadius:6, padding:10}}>
                <p style={{color:"#f59e0b", fontSize:11, margin:"0 0 4px", fontWeight:"bold"}}>âš ï¸ Nenhuma fila cadastrada</p>
                <p style={{color:"#9ca3af", fontSize:10, margin:0, lineHeight:1.4}}>
                  VÃ¡ em <b>CRM â†’ ConfiguraÃ§Ãµes â†’ Filas</b> e crie suas filas.<br/>
                  Depois volte aqui e selecione a fila de destino.
                </p>
              </div>
            ) : (
              <select value={d.fila||""} onChange={e => u({fila: e.target.value})} style={IS}>
                <option value="">Selecione uma fila...</option>
                {filasBanco.map(f => (
                  <option key={f.id} value={f.nome}>ðŸ“‹ {f.nome}{f.conexao ? ` (${f.conexao})` : ""}</option>
                ))}
              </select>
            )}
            <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0"}}>
              ðŸ’¡ Filas sÃ£o criadas em <b>ConfiguraÃ§Ãµes â†’ Filas</b> do CRM
            </p>
          </div>
        ) : (
          <div style={{marginTop:12}}>
            <label style={LS}>Atendente humano</label>
            {atendentesBanco.length === 0 ? (
              <div style={{background:"#fef3c7", border:"1px solid #f59e0b44", borderRadius:6, padding:10}}>
                <p style={{color:"#f59e0b", fontSize:11, margin:"0 0 4px", fontWeight:"bold"}}>âš ï¸ Nenhum atendente cadastrado</p>
                <p style={{color:"#9ca3af", fontSize:10, margin:0, lineHeight:1.4}}>
                  Cadastre atendentes em <b>CRM â†’ ConfiguraÃ§Ãµes â†’ UsuÃ¡rios</b>.
                </p>
              </div>
            ) : (
              <select
                value={d.atendente_email||""}
                onChange={e => {
                  const at = atendentesBanco.find(a => a.email === e.target.value);
                  u({atendente_email: e.target.value, atendente_nome: at?.nome || ""});
                }}
                style={IS}
              >
                <option value="">Selecione um atendente...</option>
                {atendentesBanco.map(a => (
                  <option key={a.email} value={a.email}>ðŸ‘¤ {a.nome} ({a.email})</option>
                ))}
              </select>
            )}
            <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0"}}>
              ðŸ’¡ Atendentes sÃ£o cadastrados em <b>ConfiguraÃ§Ãµes â†’ UsuÃ¡rios</b>
            </p>
          </div>
        )}

        <div style={{marginTop:12}}>
          {T("Mensagem ao transferir","mensagem","Transferindo...",80)}
        </div>
      </>;
    }

    case "finalizar": return <>{T("Mensagem de encerramento","mensagem","Obrigado pelo contato!",80)}</>;

    // ðŸ†• v18: bloco "Enviar Venda" â€” cria proposta no /crm/vendas automaticamente
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FRONTEND: configuraÃ§Ã£o do bloco (este case)
    // BACKEND: o executor de fluxo na VPS precisa, ao processar este tipo de bloco:
    //   1. Carregar `variaveis` da fluxo_sessoes do contato atual
    //   2. Resolver o mapeamento (automatico por nome OU manual)
    //   3. Resolver o vendedor da proposta:
    //      - primeiro usa `atendimentos.atendente` se for um e-mail real
    //      - se estiver vazio/BOT/Humano e fallback_roleta_atendimento=true, usa a roleta_config oficial
    //      - se a roleta escolher alguem, atualiza o atendimento com o MESMO e-mail
    //   4. INSERT em `propostas` com `vendedor` igual ao atendente resolvido
    //   5. Se aplicar_etiqueta=true: INSERT em `atendimento_etiquetas` com nome da tag
    //   6. Enviar `mensagem_sucesso` ao cliente (se preenchida) e seguir saida "Sucesso"
    //   7. Em erro: enviar `mensagem_erro` e seguir saida "Erro"
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case "gatilho_crm": {
      const campoAtual = d.campo || "status_venda";
      return <>
        <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:9,padding:10}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:800,color:"#c2410c"}}>âš¡ Entrada automÃ¡tica pelo CRM</p>
          <p style={{margin:0,fontSize:10,lineHeight:1.45,color:"#6b7280"}}>Quando uma venda mudar conforme esta regra, o sistema abre o trecho conectado usando o mesmo cliente, canal e venda. Crie quantos gatilhos precisar.</p>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"#374151"}}>
          <input type="checkbox" checked={d.ativo !== false} onChange={e=>u({ativo:e.target.checked})}/> Regra ativa
        </label>
        <div><label style={LS}>Campo observado</label><select value={campoAtual} onChange={e=>u({campo:e.target.value})} style={IS}>
          {camposPropostaUnif.filter(c=>c.visivel).map(c=><option key={c.origem+":"+c.slug} value={c.origem === "custom" ? "custom."+c.slug : c.slug}>{c.label}{c.origem === "custom" ? " (personalizado)" : ""}</option>)}
        </select></div>
        {S("CondiÃ§Ã£o","operador",[
          {value:"mudou_para",label:"Mudou para"},{value:"mudou_de",label:"Saiu de"},{value:"alterou",label:"Qualquer alteraÃ§Ã£o"},
          {value:"igual",label:"EstÃ¡ igual a"},{value:"contem",label:"ContÃ©m"},{value:"preenchido",label:"Foi preenchido"},{value:"vazio",label:"Ficou vazio"}
        ])}
        {!['alterou','preenchido','vazio'].includes(d.operador || 'mudou_para') && <div>
          <label style={LS}>Valor da regra</label>
          <input value={d.valor || ""} onChange={e=>u({valor:e.target.value})} list={campoAtual === "status_venda" ? "status-crm-opcoes" : undefined} style={IS} placeholder="Ex.: INSTALADA, REPROVADA, 14:30..."/>
          {campoAtual === "status_venda" && <datalist id="status-crm-opcoes">{statusVendaOpcoes.map(o=><option key={o.value} value={o.value}/>)}</datalist>}
        </div>}
        <div style={{borderTop:"1px solid #fed7aa",paddingTop:10}}>
          {S("Primeiro contato na API oficial","modo_primeiro_envio",[{value:"texto",label:"Texto normal (janela aberta)"},{value:"template",label:"Template aprovado pela Meta"}])}
          {d.modo_primeiro_envio === "template" && <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:7,marginTop:7}}>
            <input value={d.template_nome || ""} onChange={e=>u({template_nome:e.target.value})} style={IS} placeholder="nome_do_template"/>
            <input value={d.template_idioma || "pt_BR"} onChange={e=>u({template_idioma:e.target.value})} style={IS} placeholder="pt_BR"/>
          </div>}
          <p style={{fontSize:9,color:"#9a3412",lineHeight:1.4,margin:"6px 0 0"}}>Na Cloud API, use template quando o cliente estiver fora da janela de 24 horas. Depois o fluxo e a IA continuam normalmente.</p>
        </div>
        <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:9,fontSize:10,color:"#475569",lineHeight:1.5}}>
          VariÃ¡veis automÃ¡ticas: <code>{'{{proposta_id}}'}</code>, <code>{'{{crm_campo_alterado}}'}</code>, <code>{'{{crm_valor_anterior}}'}</code>, <code>{'{{crm_valor_novo}}'}</code> e todos os campos da venda.
        </div>
      </>;
    }
    case "atualizar_venda": {
      const itens: Array<{campo:string;origem:string;valor:string}> = Array.isArray(d.atualizacoes) ? d.atualizacoes : [];
      const atualizar = (i:number, patch:Record<string,string>) => u({atualizacoes:itens.map((x,j)=>j===i?{...x,...patch}:x)});
      return <>
        <div style={{background:"#f0f9ff",border:"1px solid #7dd3fc",borderRadius:9,padding:10}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:800,color:"#0369a1"}}>ðŸ“ Atualizar a venda atual</p>
          <p style={{margin:0,fontSize:10,lineHeight:1.45,color:"#6b7280"}}>Edita a mesma ficha que acionou a automaÃ§Ã£o. Pode alterar status, horÃ¡rio, CPF, observaÃ§Ã£o ou qualquer campo personalizado do workspace.</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{itens.map((item,i)=><div key={i} style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:8}}>
          <select value={item.campo || ""} onChange={e=>atualizar(i,{campo:e.target.value})} style={{...IS,marginBottom:6}}>
            <option value="">Selecione o campo...</option>
            {camposPropostaUnif.filter(c=>c.visivel).map(c=><option key={c.origem+":"+c.slug} value={c.origem === "custom" ? "custom."+c.slug : c.slug}>{c.label}{c.origem === "custom" ? " (personalizado)" : ""}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"110px 1fr auto",gap:6}}>
            <select value={item.origem || "valor"} onChange={e=>atualizar(i,{origem:e.target.value})} style={IS}><option value="valor">Valor/texto</option><option value="variavel">VariÃ¡vel</option></select>
            {item.origem === "variavel" ? <select value={item.valor || ""} onChange={e=>atualizar(i,{valor:e.target.value})} style={IS}><option value="">Escolha...</option>{variaveisDoFluxo.map(v=><option key={v} value={v}>{'{{'+v+'}}'}</option>)}</select> : <input value={item.valor || ""} onChange={e=>atualizar(i,{valor:e.target.value})} style={IS} placeholder="Valor ou {{variavel}}"/>}
            <button type="button" onClick={()=>u({atualizacoes:itens.filter((_,j)=>j!==i)})} style={{border:"1px solid #fecaca",background:"#fee2e2",color:"#dc2626",borderRadius:6,cursor:"pointer"}}>Ã—</button>
          </div>
        </div>)}</div>
        <button type="button" onClick={()=>u({atualizacoes:[...itens,{campo:"",origem:"valor",valor:""}]})} style={{background:"#e0f2fe",border:"1px solid #7dd3fc",color:"#0369a1",borderRadius:7,padding:"7px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>+ Campo para atualizar</button>
        {TVar("Mensagem apÃ³s atualizar (opcional)","mensagem_sucesso","Ex.: Dados atualizados. Vou reenviar para anÃ¡lise.",65)}
        {TVar("Mensagem se der erro (opcional)","mensagem_erro","NÃ£o consegui atualizar agora.",55)}
      </>;
    }

    case "enviar_venda": {
      const modoMap = d.modo_mapeamento || "automatico";
      // ðŸ“‹ Campos disponÃ­veis = lista UNIFICADA carregada do workspace:
      //   - Campos FIXOS (nome, cpf, telefone, etc) respeitando configs do Editor de Vendas
      //     (oculta os marcados como invisÃ­vel, usa label customizado)
      //   - Campos CUSTOMIZADOS criados pelo cliente no Editor de Vendas
      // Vem via prop `camposPropostaUnif` (carregada uma vez no componente raiz).
      // Mostra sÃ³ os visÃ­veis e ativos. Filtra o "vendedor" porque Ã© setado automÃ¡tico pelo backend.
      const camposVisiveis = camposPropostaUnif.filter(c =>
        c.visivel !== false && c.slug !== "vendedor"
      );
      // Separa em fixos / customs pra mostrar em seÃ§Ãµes diferentes
      const camposFixos = camposVisiveis.filter(c => c.origem === "fixo");
      const camposCustoms = camposVisiveis.filter(c => c.origem === "custom");
      const mapeamento: Record<string,string> = d.mapeamento || {};
      const updateMap = (campo: string, varName: string) => {
        const novo = { ...mapeamento };
        if (!varName) delete novo[campo]; else novo[campo] = varName;
        u({ mapeamento: novo });
      };
      const vendedoresRoleta: string[] = Array.isArray(d.roleta_vendedores) ? d.roleta_vendedores : [];
      const toggleVendedorRoleta = (email: string) => {
        const atual = new Set(vendedoresRoleta.map(e => String(e).toLowerCase()));
        const key = String(email || "").toLowerCase();
        if (!key) return;
        if (atual.has(key)) atual.delete(key); else atual.add(key);
        u({ roleta_vendedores: Array.from(atual), roleta_vendas_ativa: true });
      };
      const marcarTodosVendedores = () => u({
        roleta_vendedores: atendentesBanco.map(a => String(a.email || "").toLowerCase()).filter(Boolean),
        roleta_vendas_ativa: true,
      });
      const limparVendedores = () => u({ roleta_vendedores: [] });
      return <>
        <div style={{background:"#22c55e11",border:"1px solid #22c55e33",borderRadius:8,padding:12,marginBottom:8}}>
          <p style={{color:"#22c55e",fontSize:12,fontWeight:"bold",margin:"0 0 4px"}}>ðŸ’° Enviar Venda pro CRM</p>
          <p style={{color:"#9ca3af",fontSize:11,margin:0,lineHeight:1.4}}>
            Quando o fluxo chegar nesse bloco, o sistema cria <b>automaticamente uma proposta</b> no
            <b> /crm/vendas</b> com as variÃ¡veis que vocÃª capturou no fluxo + aplica uma etiqueta
            no atendimento. O vendedor jÃ¡ abre o chat com a venda pronta.
          </p>
        </div>

        {/* Roleta de vendas por vendedores selecionados */}
        <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
            <div>
              <p style={{color:"#c2410c",fontSize:12,fontWeight:"bold",margin:"0 0 3px"}}>ðŸŽ¯ Roleta de vendas</p>
              <p style={{color:"#9a3412",fontSize:10,margin:0,lineHeight:1.35}}>
                Marque quais vendedores podem receber vendas criadas pelo BOT neste fluxo.
              </p>
            </div>
            <span style={{background:"#ffedd5",border:"1px solid #fdba74",borderRadius:999,padding:"4px 8px",color:"#c2410c",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
              {vendedoresRoleta.length} selecionado(s)
            </span>
          </div>

          <label style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",background:"#ffffff",border:"1px solid #fed7aa",borderRadius:7,padding:"8px 9px",marginBottom:8}}>
            <input
              type="checkbox"
              checked={d.roleta_vendas_ativa !== false}
              onChange={e => u({roleta_vendas_ativa: e.target.checked})}
              style={{accentColor:"#f97316",marginTop:2}}
            />
            <span style={{color:"#1f2937",fontSize:11,lineHeight:1.35}}>
              <b>Ativar roleta de vendas deste bloco</b>
              <br/>
              Se o atendimento jÃ¡ tiver vendedor real, usa ele. Se nÃ£o tiver, sorteia um vendedor marcado abaixo e transfere o atendimento para ele.
            </span>
          </label>

          {d.roleta_vendas_ativa !== false && (
            <>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <button type="button" onClick={marcarTodosVendedores}
                  style={{background:"#fff",border:"1px solid #fdba74",color:"#c2410c",borderRadius:7,padding:"6px 9px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                  Marcar todos
                </button>
                <button type="button" onClick={limparVendedores}
                  style={{background:"#fff",border:"1px solid #e5e7eb",color:"#6b7280",borderRadius:7,padding:"6px 9px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                  Limpar
                </button>
              </div>

              {atendentesBanco.length === 0 ? (
                <p style={{color:"#9a3412",fontSize:10,margin:0,lineHeight:1.35}}>
                  Nenhum usuÃ¡rio encontrado neste workspace ainda. Cadastre usuÃ¡rios para aparecerem aqui.
                </p>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,maxHeight:130,overflowY:"auto",paddingRight:2}}>
                  {atendentesBanco.map(a => {
                    const email = String(a.email || "").toLowerCase();
                    const marcado = vendedoresRoleta.map(v => String(v).toLowerCase()).includes(email);
                    return (
                      <label key={email} style={{
                        display:"flex",alignItems:"center",gap:7,cursor:"pointer",
                        background: marcado ? "#ffedd5" : "#ffffff",
                        border:`1px solid ${marcado ? "#fb923c" : "#fed7aa"}`,
                        borderRadius:7,padding:"7px 8px",minWidth:0
                      }}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleVendedorRoleta(email)}
                          style={{accentColor:"#f97316"}}
                        />
                        <span style={{minWidth:0}}>
                          <span style={{display:"block",color:"#1f2937",fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {a.nome || a.email}
                          </span>
                          <span style={{display:"block",color:"#9ca3af",fontSize:9,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {a.email}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {vendedoresRoleta.length === 0 && (
                <p style={{color:"#dc2626",fontSize:10,margin:"8px 0 0",lineHeight:1.35,fontWeight:600}}>
                  âš ï¸ Marque pelo menos um vendedor para a roleta funcionar quando o lead ainda nÃ£o tiver atendente.
                </p>
              )}
            </>
          )}
        </div>


        {/* Toggle modo automÃ¡tico / manual */}
        <div>
          <label style={LS}>Mapeamento das variÃ¡veis</label>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {[
              {key:"automatico",label:"ðŸ”® AutomÃ¡tico",hint:"VariÃ¡vel com mesmo nome do campo jÃ¡ mapeia. Ex: variÃ¡vel 'nome' â†’ campo 'nome' da proposta."},
              {key:"manual",label:"ðŸŽ¯ Manual",hint:"VocÃª define qual variÃ¡vel vai pra cada campo."},
            ].map(opt => (
              <button key={opt.key} onClick={() => u({modo_mapeamento: opt.key})}
                style={{
                  flex:1,
                  background: modoMap === opt.key ? "#22c55e22" : "#ffffff",
                  border: `1px solid ${modoMap === opt.key ? "#22c55e" : "#e5e7eb"}`,
                  color: modoMap === opt.key ? "#22c55e" : "white",
                  borderRadius:8, padding:"8px 10px", fontSize:11, cursor:"pointer", fontWeight:"bold"
                }}
                title={opt.hint}
              >{opt.label}</button>
            ))}
          </div>
          {modoMap === "automatico" && (
            <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0",lineHeight:1.3}}>
              ðŸ’¡ O sistema vai pegar todas as variÃ¡veis salvas no fluxo e tentar mapear pelo nome.
              <br/>Ex: variÃ¡vel <code style={{color:"#22c55e"}}>nome</code> â†’ campo "Nome do cliente";
              variÃ¡vel <code style={{color:"#22c55e"}}>cpf_limpo</code> â†’ campo "CPF" (usa nome similar).
            </p>
          )}
        </div>

        {/* Mapeamento manual â€” sÃ³ aparece quando o modo Ã© manual */}
        {modoMap === "manual" && (
          <div>
            <label style={LS}>Defina qual variÃ¡vel preenche cada campo</label>
            <p style={{color:"#6b7280",fontSize:10,margin:"-2px 0 8px",lineHeight:1.3}}>
              Deixe em branco os campos que nÃ£o quer preencher. O sistema sÃ³ cria os que vocÃª mapear.
              <br/>ðŸ“… Datas devem vir no formato <code style={{color:"#22c55e"}}>YYYY-MM-DD</code> ou <code style={{color:"#22c55e"}}>DD/MM/YYYY</code>.
              ðŸ’° Valores monetÃ¡rios: ponto como separador decimal (ex: <code style={{color:"#22c55e"}}>99.90</code>).
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10,background:"#f8fafc",border:"1px solid #ffffff",borderRadius:8,padding:10,maxHeight:380,overflowY:"auto"}}>

              {/* â”€â”€â”€â”€ SeÃ§Ã£o 1: Campos fixos da proposta â”€â”€â”€â”€ */}
              {camposFixos.length > 0 && (
                <>
                  <p style={{color:"#6b7280",fontSize:10,margin:"0 0 2px",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>
                    ðŸ“‹ Campos da Proposta
                  </p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {camposFixos.map(c => (
                      <div key={c.slug} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:"#9ca3af",fontSize:11,flex:"0 0 140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                          title={`${c.label} (${c.tipo})`}>
                          {c.label}
                          {c.obrigatorio && <span style={{color:"#ef4444"}}> *</span>}
                          {(c.tipo === "data") && " ðŸ“…"}
                          {(c.tipo === "moeda") && " ðŸ’°"}
                        </span>
                        <span style={{color:"#e5e7eb",fontSize:11}}>â†</span>
                        <select value={mapeamento[c.slug] || ""} onChange={e => updateMap(c.slug, e.target.value)}
                          style={{...IS,flex:1,fontSize:11,padding:"5px 8px"}}>
                          <option value="">â€” sem mapeamento â€”</option>
                          {variaveisDoFluxo.map(v => (
                            <option key={v} value={v}>{`{{${v}}}`}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* â”€â”€â”€â”€ SeÃ§Ã£o 2: Campos customizados do workspace â”€â”€â”€â”€ */}
              {camposCustoms.length > 0 && (
                <>
                  <p style={{color:"#8b5cf6",fontSize:10,margin:"8px 0 2px",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,borderTop:"1px dashed #d1d5db",paddingTop:8}}>
                    âœ¨ Campos Customizados ({camposCustoms.length})
                  </p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {camposCustoms.map(c => (
                      <div key={c.slug} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:"#8b5cf6",fontSize:11,flex:"0 0 140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                          title={`${c.label} (${c.tipo})`}>
                          {c.label}
                          {c.obrigatorio && <span style={{color:"#ef4444"}}> *</span>}
                          {(c.tipo === "data") && " ðŸ“…"}
                          {(c.tipo === "moeda") && " ðŸ’°"}
                        </span>
                        <span style={{color:"#e5e7eb",fontSize:11}}>â†</span>
                        <select value={mapeamento[c.slug] || ""} onChange={e => updateMap(c.slug, e.target.value)}
                          style={{...IS,flex:1,fontSize:11,padding:"5px 8px"}}>
                          <option value="">â€” sem mapeamento â€”</option>
                          {variaveisDoFluxo.map(v => (
                            <option key={v} value={v}>{`{{${v}}}`}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {camposFixos.length === 0 && camposCustoms.length === 0 && (
                <p style={{color:"#9ca3af",fontSize:11,fontStyle:"italic",margin:0,padding:12,textAlign:"center"}}>
                  Carregando campos da proposta...
                </p>
              )}
            </div>
            {Object.keys(mapeamento).length > 0 && (
              <p style={{color:"#22c55e",fontSize:10,margin:"6px 0 0"}}>
                âœ… {Object.keys(mapeamento).length} campo(s) mapeado(s)
              </p>
            )}
          </div>
        )}

        {/* Etiqueta a aplicar */}
        <div style={{borderTop:"1px solid #ffffff",paddingTop:12,marginTop:6}}>
          <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer"}}>
            <input type="checkbox" checked={d.aplicar_etiqueta !== false}
              onChange={e => u({aplicar_etiqueta: e.target.checked})}
              style={{accentColor:"#22c55e"}}/>
            <span style={{color:"#1f2937",fontSize:12,fontWeight:"bold"}}>ðŸ·ï¸ Aplicar etiqueta ao atendimento</span>
          </label>
          {d.aplicar_etiqueta !== false && (
            <>
              {F("Nome da etiqueta","etiqueta","text","proposta_finalizada")}
              <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0",lineHeight:1.3}}>
                ðŸ’¡ A etiqueta Ã© criada automaticamente se ainda nÃ£o existir.
                Ãštil pra filtrar atendimentos com proposta criada no chatbot.
              </p>
            </>
          )}
        </div>

        {/* Status inicial da proposta â€” dinÃ¢mico por workspace */}
        <div style={{borderTop:"1px solid #ffffff",paddingTop:12,marginTop:6}}>
          {S("Status inicial da proposta","status_inicial", statusVendaOpcoes)}
          <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0",lineHeight:1.3}}>
            ðŸ’¡ As opÃ§Ãµes mostradas sÃ£o os status ativos configurados no <b>Editor de Vendas</b> deste workspace.
          </p>
        </div>

        {/* Mensagens enviadas ao cliente */}
        <div style={{borderTop:"1px solid #ffffff",paddingTop:12,marginTop:6}}>
          {TVar("Mensagem ao cliente (sucesso)","mensagem_sucesso","âœ… Sua proposta foi registrada!",70)}
          {TVar("Mensagem ao cliente (erro)","mensagem_erro","âš ï¸ NÃ£o consegui registrar, atendente vai te ajudar.",70)}
        </div>

        <p style={{color:"#6b7280",fontSize:10,margin:"8px 0 0",lineHeight:1.4,fontStyle:"italic"}}>
          âš ï¸ SaÃ­das: <span style={{color:"#22c55e"}}>0=Sucesso</span> (proposta criada) /{" "}
          <span style={{color:"#ef4444"}}>1=Erro</span> (falha ao salvar â€” conecte aqui um bloco "Transferir" como fallback).
        </p>
      </>;
    }

    // ðŸ†• v19: editor do bloco "Aplicar Etiqueta"
    case "etiqueta": {
      const iconesComuns = ["ðŸ·ï¸","â­","ðŸ”¥","ðŸ’Ž","âœ…","âŒ","âš ï¸","ðŸ’°","ðŸ“Œ","ðŸŽ¯","ðŸš€","ðŸ’¼","ðŸ“‹","ðŸ””"];
      const coresComuns = [
        { hex: "#3b82f6", nome: "Azul" },
        { hex: "#22c55e", nome: "Verde" },
        { hex: "#ef4444", nome: "Vermelho" },
        { hex: "#f59e0b", nome: "Laranja" },
        { hex: "#8b5cf6", nome: "Roxo" },
        { hex: "#ec4899", nome: "Rosa" },
        { hex: "#06b6d4", nome: "Ciano" },
        { hex: "#6b7280", nome: "Cinza" },
      ];
      return <>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* AÃ§Ã£o: aplicar ou remover */}
          <div>
            <label style={{display:"block",color:"#9ca3af",fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>
              AÃ§Ã£o
            </label>
            <div style={{display:"flex",gap:6}}>
              {[
                { v: "aplicar", label: "âœ… Aplicar etiqueta" },
                { v: "remover", label: "ðŸ—‘ï¸ Remover etiqueta" },
              ].map(o => (
                <button key={o.v} type="button" onClick={()=>u({acao:o.v})}
                  style={{flex:1,padding:"8px 10px",background:d.acao===o.v?"#3b82f6":"#ffffff",
                    color:d.acao===o.v?"#fff":"#9ca3af",border:"1px solid #e5e7eb",borderRadius:8,
                    fontSize:12,cursor:"pointer",fontWeight:d.acao===o.v?"bold":"normal"}}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nome da etiqueta */}
          {T("Nome da etiqueta","nome","Ex.: Cliente VIP, Aguardando documento, Interessado")}

          {/* Cor e Ã­cone (sÃ³ importam se for criar etiqueta nova) */}
          {d.acao !== "remover" && (
            <>
              <div>
                <label style={{display:"block",color:"#9ca3af",fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>
                  Cor da etiqueta
                </label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {coresComuns.map(c => (
                    <button key={c.hex} type="button" onClick={()=>u({cor:c.hex})}
                      title={c.nome}
                      style={{width:32,height:32,background:c.hex,border:d.cor===c.hex?"3px solid #fff":"1px solid #e5e7eb",
                        borderRadius:6,cursor:"pointer"}} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{display:"block",color:"#9ca3af",fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>
                  Ãcone
                </label>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {iconesComuns.map(ic => (
                    <button key={ic} type="button" onClick={()=>u({icone:ic})}
                      style={{width:34,height:34,background:d.icone===ic?"#3b82f6":"#ffffff",
                        border:"1px solid #e5e7eb",borderRadius:6,fontSize:18,cursor:"pointer"}}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Preview */}
          {d.nome && (
            <div>
              <label style={{display:"block",color:"#9ca3af",fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>
                Preview
              </label>
              <span style={{
                display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",
                background:`${d.cor||"#3b82f6"}22`,color:d.cor||"#3b82f6",border:`1px solid ${d.cor||"#3b82f6"}55`,
                borderRadius:20,fontSize:12,fontWeight:"bold"
              }}>
                {d.icone||"ðŸ·ï¸"} {d.nome}
              </span>
            </div>
          )}
        </div>

        <p style={{color:"#6b7280",fontSize:10,margin:"12px 0 0",lineHeight:1.4,fontStyle:"italic"}}>
          ðŸ’¡ Use este bloco em qualquer ponto do fluxo pra marcar atendimentos.
          Se a etiqueta nÃ£o existir no workspace, serÃ¡ criada automaticamente.
        </p>
      </>;
    }

    default: return <p style={{color:"#6b7280",fontSize:12}}>Sem propriedades.</p>;
  }
}

function NoCard({ no, sel, scale, onSelect, onOpen, onDelete, onConectarSaida, onConectarEntrada }: {
  no: No; sel: boolean; scale: number;
  onSelect: (id:string) => void;
  onOpen: (id:string) => void; // ðŸ†• abre modal (separado de selecionar)
  onDelete: (id:string) => void;
  onConectarSaida: (noId:string, idx:number) => void;
  onConectarEntrada: (noId:string) => void;
  onMove: (id:string, x:number, y:number) => void;
}) {
  const cfg = B[no.tipo];
  const divRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const moveu = useRef(false); // ðŸ†• detecta se houve movimento real (drag) ou sÃ³ click
  const startPtr = useRef({px:0, py:0, nx:0, ny:0, t:0});

  function onPointerDown(e: React.PointerEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName==="BUTTON"||t.tagName==="INPUT"||t.tagName==="SELECT"||t.tagName==="TEXTAREA") return;
    if (t.closest("button")||t.closest("input")||t.closest("select")||t.closest("textarea")) return;
    e.stopPropagation();
    // ðŸ†• NÃƒO seleciona aqui â€” sÃ³ prepara o drag. SeleÃ§Ã£o/abertura acontece no PointerUp.
    dragging.current = true;
    moveu.current = false;
    startPtr.current = {px:e.clientX, py:e.clientY, nx:no.x, ny:no.y, t:Date.now()};
    divRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = (e.clientX - startPtr.current.px) / scale;
    const dy = (e.clientY - startPtr.current.py) / scale;
    // ðŸ†• Considera "movimento real" se passou de 5px em qualquer direÃ§Ã£o (tolerÃ¢ncia anti-click trÃªmulo)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      moveu.current = true;
    }
    const el = divRef.current;
    if (el) {
      el.style.left = `${startPtr.current.nx + dx}px`;
      el.style.top  = `${startPtr.current.ny + dy}px`;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    divRef.current?.releasePointerCapture(e.pointerId);
    const dx = (e.clientX - startPtr.current.px) / scale;
    const dy = (e.clientY - startPtr.current.py) / scale;
    if (moveu.current) {
      // ðŸ†• Foi DRAG â€” sÃ³ atualiza posiÃ§Ã£o, NÃƒO seleciona/abre modal
      (window as any).__wolfMoveNo?.(no.id, startPtr.current.nx+dx, startPtr.current.ny+dy);
    } else {
      // ðŸ†• Foi CLICK â€” sÃ³ seleciona (destaca, mas NÃƒO abre modal)
      onSelect(no.id);
    }
  }

  // ðŸ†• Double click pra abrir o modal de ediÃ§Ã£o
  function onDoubleClickHandler(e: React.MouseEvent) {
    e.stopPropagation();
    onOpen(no.id);
  }

  return (
    <div
      ref={divRef}
      style={{position:"absolute", left:no.x, top:no.y, width:230,
        background:"#ffffff", borderRadius:14,
        border:`1px solid ${sel ? cfg.cor : "#e5e7eb"}`,
        boxShadow: sel
          ? `0 0 0 3px ${cfg.cor}33, 0 12px 24px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06)`
          : "0 4px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04)",
        userSelect:"none", zIndex:sel?10:1, touchAction:"none", cursor: "grab",
        transition: "box-shadow .15s ease, transform .15s ease",
        transform: sel ? "translateY(-2px)" : "none",
        overflow: "hidden"}}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClickHandler}
      onMouseUp={e => {e.stopPropagation(); onConectarEntrada(no.id);}}
    >
      <div style={{background:`linear-gradient(135deg, ${cfg.cor} 0%, ${cfg.cor}dd 100%)`, padding:"9px 12px",
        display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"grab",
        boxShadow:"inset 0 -1px 0 rgba(0,0,0,.08)"}}>
        <div style={{display:"flex", alignItems:"center", gap:7, pointerEvents:"none"}}>
          <span style={{
            fontSize:13,
            display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:22,height:22,
            background:"rgba(255,255,255,.25)",
            borderRadius:6
          }}>{cfg.icone}</span>
          <span style={{color:"#ffffff", fontSize:12, fontWeight:"700", textShadow:"0 1px 2px rgba(0,0,0,.15)"}}>{cfg.label}</span>
          <span style={{background:"rgba(255,255,255,.22)", color:"#ffffff", fontSize:9, padding:"2px 7px", borderRadius:10, fontWeight:"600", letterSpacing:.3}}>{cfg.grupo}</span>
        </div>
        {no.tipo!=="inicio" && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {e.stopPropagation(); onDelete(no.id);}}
            style={{background:"none", border:"none", color:"rgba(255,255,255,.7)", cursor:"pointer", fontSize:13, padding:0, lineHeight:1}}>âœ•</button>
        )}
      </div>
      <div style={{padding:"7px 10px", borderBottom:cfg.saidas.length?"1px solid #ffffff":"none", pointerEvents:"none"}}>
        <p style={{color:"#9ca3af", fontSize:10, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{getPreview(no)}</p>
      </div>
      {no.tipo!=="inicio" && (
        <div
          style={{position:"absolute", left:-7, top:48+18-7, width:14, height:14, borderRadius:"50%",
            background:"#ffffff", border:`2px solid ${cfg.cor}`, cursor:"crosshair", zIndex:5}}
          onPointerDown={e => e.stopPropagation()}
          onMouseUp={e => {e.stopPropagation(); onConectarEntrada(no.id);}}
        />
      )}
      {no.saidas.map((saida,idx) => (
        <div key={idx} style={{display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 10px", height:36, borderTop:idx>0?"1px solid #ffffff":"none"}}>
          <span style={{color:"#6b7280", fontSize:10, pointerEvents:"none"}}>{saida}</span>
          <div
            style={{width:14, height:14, borderRadius:"50%", background:cfg.cor, cursor:"crosshair",
              flexShrink:0, position:"relative", right:-18, border:"2px solid #e5e7eb"}}
            onPointerDown={e => {e.stopPropagation(); onConectarSaida(no.id,idx);}}
          />
        </div>
      ))}
    </div>
  );
}

export default function FluxosPage() {
  const router = useRouter();
  const { modulos, carregado: modulosCarregados } = useModulos();
  const vendedorIALiberado = modulosCarregados && modulos.vendedor_ia;
  const canvasRef = useRef<HTMLDivElement>(null);

  // âœ… Agora Ã© username (string como "wolf_admin"), nunca id numÃ©rico
  const [wsId,setWsId]             = useState<string|null>(null);
  // ðŸ“‹ Status disponÃ­veis pro bloco "Enviar Venda".
  //    A lista vem exclusivamente do campo Status da Venda configurado no workspace.
  const [statusVendaOpcoes, setStatusVendaOpcoes] = useState<{value:string;label:string}[]>([]);
  // ðŸ“‹ Campos da proposta â€” fixos + customizados do workspace.
  //    Carrega de `proposta_campos_padrao_config` (configs de campos fixos: oculto/label custom)
  //    e `proposta_campos_customizados` (campos extras criados pelo cliente no Editor de Vendas).
  //    Fallback: se as tabelas nÃ£o existirem ou estiverem vazias, usa sÃ³ os CAMPOS_FIXOS default.
  const [camposPropostaUnif, setCamposPropostaUnif] = useState<CampoUnificado[]>(
    montarCamposUnificados([], [])  // sÃ³ os fixos default
  );
  const [fluxos,setFluxos]         = useState<Fluxo[]>([]);
  const [filasBanco,setFilasBanco] = useState<FilaItem[]>([]); // ðŸ†•
  const [atendentesBanco,setAtendentesBanco] = useState<AtendenteItem[]>([]); // ðŸ†• atendentes do workspace
  const [view,setView]             = useState<"lista"|"editor">("lista");
  const [fluxoAtivo,setFluxoAtivo] = useState<Fluxo|null>(null);
  const [nos,setNos]               = useState<No[]>([]);
  const [arestas,setArestas]       = useState<Aresta[]>([]);
  const [noSel,setNoSel]           = useState<No|null>(null);
  // ðŸ†• noEditando = qual nÃ³ tÃ¡ com modal aberto. Separado de noSel pra permitir
  //    drag/seleÃ§Ã£o sem abrir modal automaticamente. Modal sÃ³ abre em DOUBLE click.
  const [noEditando, setNoEditando] = useState<No|null>(null);
  const [salvando,setSalvando]     = useState(false);
  const [salvandoMidiaId,setSalvandoMidiaId] = useState<string|null>(null);
  const [grupoAberto,setGrupoAberto] = useState("Bubbles");
  const [conectando,setConectando]   = useState<{noId:string;saidaIndex:number}|null>(null);
  const [mousePos,setMousePos]       = useState({x:0,y:0});
  const [showNovo,setShowNovo]     = useState(false);
  const [criando,setCriando]       = useState(false);
  const [form,setForm]             = useState({nome:"",descricao:"",trigger_tipo:"qualquer_mensagem",trigger_valor:""});
  const [scale,setScale]           = useState(1);
  const [offset,setOffset]         = useState({x:80,y:80});
  const scaleRef  = useRef(1);
  const offsetRef = useRef({x:80,y:80});
  const panning   = useRef(false);
  const panStart  = useRef({x:0,y:0,ox:0,oy:0});

  useEffect(() => {
    (window as any).__wolfMoveNo = (id:string, x:number, y:number) => {
      setNos(p => p.map(n => n.id===id ? {...n,x,y} : n));
    };
    return () => { delete (window as any).__wolfMoveNo; };
  }, []);

  // ðŸ“‹ Carrega campos da proposta do workspace â€” multi-tenant:
  //    Fixos (CAMPOS_FIXOS default) + configs (visibilidade/labels) + customizados.
  //    Igual ao que o CRM usa, garantindo paridade: o que tÃ¡ no Editor de Vendas
  //    aparece aqui no bloco de fluxo automaticamente.
  useEffect(() => {
    if (!wsId) return;
    let cancelado = false;
    (async () => {
      try {
        const [{ data: cfgs }, { data: customs }] = await Promise.all([
          supabase.from("proposta_campos_padrao_config")
            .select("id, campo_slug, label_custom, obrigatorio, visivel, ordem, opcoes, placeholder_custom")
            .eq("workspace_id", wsId),
          supabase.from("proposta_campos_customizados")
            .select("id, slug, label, tipo, obrigatorio, ordem, opcoes, placeholder, ativo")
            .eq("workspace_id", wsId)
            .order("ordem", { ascending: true }),
        ]);

        if (cancelado) return;

        // Monta a lista unificada (fixos + customs, respeitando configs do workspace)
        const unif = montarCamposUnificados(
          (cfgs as ConfigCampoPadrao[]) || [],
          (customs as CampoCustom[]) || []
        );
        setCamposPropostaUnif(unif);

        const campoStatus = unif.find(campo => campo.slug === "status_venda" && campo.visivel !== false);
        const statusAtivos = Array.from(new Set(
          (campoStatus?.opcoes || [])
            .map(status => String(status || "").trim())
            .filter(Boolean)
        ));
        setStatusVendaOpcoes(statusAtivos.map(status => ({ value: status, label: status })));
      } catch (e) {
        // Se as tabelas nÃ£o existem ou deu erro, mantÃ©m os defaults jÃ¡ carregados no state inicial
        console.warn("[fluxos] nÃ£o consegui carregar campos customizados, usando padrÃ£o:", e);
      }
    })();
    return () => { cancelado = true; };
  }, [wsId]);

  // âœ… Carrega username + fluxos iniciais + Realtime + polling 5s
  useEffect(() => {
    let cancelled = false;
    getWsUsername().then(username => {
      if (cancelled || !username) return;
      setWsId(username);
      load(username);
      fetchFilas(username); // ðŸ†•
      fetchAtendentes(username); // ðŸ†• atendentes pro bloco Transferir modo humano

      // ðŸ”’ MULTI-TENANT: Realtime AGORA filtra por workspace_id no servidor.
      // Antes recebia eventos de fluxos/filas de TODOS workspaces â€” vazamento de
      // metadados (nomes de fluxos, IDs, status ativo/inativo) entre contas.
      // O filter precisa ser registrado depois que sabemos o username, por isso
      // movido pra dentro do .then() do getWsUsername.
      const ch = supabase.channel("fluxos_editor_rt_" + username)
        .on("postgres_changes", { event: "*", schema: "public", table: "fluxos", filter: `workspace_id=eq.${username}` }, () => {
          if (!cancelled) load(username);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${username}` }, () => { // ðŸ†•
          if (!cancelled) fetchFilas(username);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${username}` }, () => { // ðŸ†•
          if (!cancelled) fetchAtendentes(username);
        })
        .subscribe();

      // Guarda a referÃªncia do channel pra cleanup
      (window as any).__wolfFluxosCh = ch;
    });

    // Polling 5s fallback
    const interval = setInterval(() => {
      if (cancelled) return;
      getWsUsername().then(u => { if (u && !cancelled) { load(u); fetchFilas(u); } });
    }, 5000);

    return () => {
      cancelled = true;
      const ch = (window as any).__wolfFluxosCh;
      if (ch) { supabase.removeChannel(ch); delete (window as any).__wolfFluxosCh; }
      clearInterval(interval);
    };
  }, []);

  // âœ… Busca fluxos filtrando por username
  async function load(username?: string) {
    const u = username || wsId;
    if (!u) return;
    const {data} = await supabase.from("fluxos").select("*").eq("workspace_id", u).order("created_at",{ascending:false});
    setFluxos((data||[]).map(f=>({...f,nos:(f.nos||[]).map(normalizarConfiguracaoFluxoIA),conexoes:f.conexoes||[]})));
  }

  // ðŸ†• Busca filas cadastradas em ConfiguraÃ§Ãµes â†’ Filas do CRM
  async function fetchFilas(username?: string) {
    const u = username || wsId;
    if (!u) return;
    try {
      const {data} = await supabase.from("filas").select("id, nome, conexao").eq("workspace_id", u).order("nome",{ascending:true});
      setFilasBanco(data || []);
    } catch (e) {
      console.error("Erro ao buscar filas:", e);
      setFilasBanco([]);
    }
  }

  // ðŸ†• Busca atendentes do workspace (usuarios_workspace + dono) â€” usado no bloco Transferir modo "humano"
  async function fetchAtendentes(username?: string) {
    const u = username || wsId;
    if (!u) return;
    try {
      const lista: AtendenteItem[] = [];
      // Sub-usuÃ¡rios do workspace
      const { data: subs } = await supabase.from("usuarios_workspace")
        .select("email, nome")
        .eq("workspace_id", u);
      for (const s of (subs || [])) {
        if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
          lista.push({ email: s.email, nome: s.nome || s.email });
        }
      }
      // Dono do workspace
      const { data: ws } = await supabase.from("workspaces")
        .select("owner_email, nome")
        .or(`username.eq.${u},id.eq.${u}`)
        .maybeSingle();
      if (ws?.owner_email && !lista.find(x => x.email?.toLowerCase() === ws.owner_email.toLowerCase())) {
        lista.unshift({ email: ws.owner_email, nome: ws.nome || ws.owner_email });
      }
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      setAtendentesBanco(lista);
    } catch (e) {
      console.error("Erro ao buscar atendentes:", e);
      setAtendentesBanco([]);
    }
  }

  async function criarFluxo() {
    if(!form.nome.trim()){alert("Digite o nome!");return;}
    setCriando(true);
    try {
      const username = wsId || await getWsUsername();
      if(!username){alert("Workspace nÃ£o encontrado! FaÃ§a login novamente.");return;}
      const ini:No = {id:uid(),tipo:"inicio",x:200,y:200,dados:defaultD("inicio"),saidas:[...B.inicio.saidas]};
      const payload = {nome:form.nome.trim(),descricao:form.descricao,ativo:false,
        trigger_tipo:form.trigger_tipo,trigger_valor:form.trigger_valor,
        nos:[ini],conexoes:[],workspace_id:username};
      const {data,error} = await supabase.from("fluxos").insert([payload]).select().single();
      if(error){alert("Erro: "+error.message);return;}
      setWsId(username); await load(username); await fetchFilas(username); await fetchAtendentes(username);
      abrirEditor({...payload, id:data.id} as Fluxo);
      setShowNovo(false);
      setForm({nome:"",descricao:"",trigger_tipo:"qualquer_mensagem",trigger_valor:""});
    } finally { setCriando(false); }
  }

  function abrirEditor(f:Fluxo) {
    const nosNormalizados = (f.nos||[]).map(normalizarConfiguracaoFluxoIA).map(n=>n.tipo==="fluxo_ia"?{...n,saidas:[...B.fluxo_ia.saidas]}:n);
    setFluxoAtivo({...f, nos:nosNormalizados}); setNos(nosNormalizados); setArestas(f.conexoes||[]); setNoSel(null); setNoEditando(null); setView("editor");
    fetchFilas(); // ðŸ†• recarrega filas ao abrir o editor
    fetchAtendentes(); // ðŸ†• recarrega atendentes ao abrir o editor
  }

  async function salvar(opcoes?: { fecharEditor?: boolean; avisarSucesso?: boolean }): Promise<boolean> {
    if(!fluxoAtivo?.id) return false;
    if (nos.some(n => n.tipo === "fluxo_ia") && !vendedorIALiberado) {
      alert("ðŸ”’ Este workspace nÃ£o possui o mÃ³dulo Vendedor IA. ContrataÃ§Ã£o avulsa: R$ 2.500,00.");
      return false;
    }
    if(!wsId) { alert("Workspace nÃ£o carregado. Recarregue a pÃ¡gina."); return false; }

    // ðŸ†• ValidaÃ§Ãµes por bloco â€” avisa antes de salvar bloco mal configurado
    const problemas: string[] = [];
    for (const n of nos) {
      if (n.tipo === "transferir") {
        const modo = n.dados?.modo || "equipe";
        if (modo === "equipe" && !n.dados?.fila) {
          problemas.push("ðŸ“¤ Transferir â†’ modo Equipe sem fila selecionada");
        }
        if (modo === "humano" && !n.dados?.atendente_email) {
          problemas.push("ðŸ“¤ Transferir â†’ modo Atendente humano sem atendente selecionado");
        }
      }
      if (n.tipo === "gatilho_crm" && !n.dados?.campo) problemas.push("âš¡ AlteraÃ§Ã£o no CRM â†’ selecione o campo observado");
      if (n.tipo === "atualizar_venda" && (!Array.isArray(n.dados?.atualizacoes) || !n.dados.atualizacoes.some((x:any)=>x.campo))) problemas.push("ðŸ“ Atualizar Venda â†’ adicione pelo menos um campo");
      if (n.tipo === "gmail") {
        const faltam: string[] = [];
        if (!n.dados?.smtp_user) faltam.push("usuÃ¡rio SMTP");
        if (!n.dados?.smtp_pass) faltam.push("senha SMTP");
        if (!n.dados?.para) faltam.push("destinatÃ¡rio (Para)");
        if (faltam.length > 0) problemas.push(`ðŸ“¨ Gmail â†’ falta: ${faltam.join(", ")}`);
      }
      if (n.tipo === "google_sheets") {
        if (!n.dados?.webhook_url) problemas.push("ðŸ“Š Google Sheets â†’ URL do webhook nÃ£o preenchida");
      }
      // ðŸ†• v20: validaÃ§Ã£o do bloco Meta CAPI
      if (n.tipo === "meta_capi") {
        const faltam: string[] = [];
        if (!n.dados?.pixel_id) faltam.push("Pixel ID");
        if (!n.dados?.access_token) faltam.push("Access Token");
        if (n.dados?.evento === "custom" && !n.dados?.evento_custom) faltam.push("nome do evento personalizado");
        if (faltam.length > 0) problemas.push(`ðŸ“ˆ Meta Pixel/CAPI â†’ falta: ${faltam.join(", ")}`);
      }
    }
    if (problemas.length > 0) {
      if (!confirm(`âš ï¸ Encontrei ${problemas.length} bloco(s) com configuraÃ§Ã£o incompleta:\n\n${problemas.join("\n")}\n\nEles vÃ£o FALHAR quando o fluxo rodar. Salvar mesmo assim?`)) return false;
    }

    setSalvando(true);
    try {
      const nosParaSalvar = nos.map(normalizarConfiguracaoFluxoIA);
      const { data, error } = await supabase.from("fluxos").update({nos:nosParaSalvar,conexoes:arestas,nome:fluxoAtivo.nome,
        descricao:fluxoAtivo.descricao,ativo:fluxoAtivo.ativo,
        trigger_tipo:fluxoAtivo.trigger_tipo,trigger_valor:fluxoAtivo.trigger_valor})
        .eq("id",fluxoAtivo.id)
        .eq("workspace_id", wsId)
        .select("id,nos")
        .single();
      if (error) throw error;

      const nosPersistidos: No[] = Array.isArray(data?.nos)
        ? data.nos.map(normalizarConfiguracaoFluxoIA)
        : [];
      for (const noLocal of nosParaSalvar.filter(n => n.tipo === "fluxo_ia")) {
        const noBanco = nosPersistidos.find(n => n.id === noLocal.id);
        if (!noBanco || noBanco.dados?.midia_ia_extensao_ativa !== noLocal.dados?.midia_ia_extensao_ativa) {
          throw new Error("O banco nÃ£o confirmou a configuraÃ§Ã£o de multimÃ­dia do bloco " + noLocal.id + ".");
        }
      }

      setNos(nosPersistidos);
      setFluxoAtivo(atual => atual ? {...atual, nos:nosPersistidos} : atual);
      setNoSel(atual => atual ? nosPersistidos.find(n => n.id === atual.id) || atual : atual);
      setNoEditando(atual => atual ? nosPersistidos.find(n => n.id === atual.id) || atual : atual);
      await load();
      if (opcoes?.fecharEditor) setNoEditando(null);
      if (opcoes?.avisarSucesso !== false) alert("âœ… Fluxo salvo e configuraÃ§Ã£o confirmada!");
      return true;
    } catch (erro: any) {
      console.error("Erro ao salvar fluxo:", erro);
      alert("âŒ NÃ£o foi possÃ­vel salvar o fluxo. Nada foi confirmado no servidor.\n\n" + (erro?.message || erro));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo() {
    if(!fluxoAtivo?.id) return;
    if (!fluxoAtivo.ativo && nos.some(n => n.tipo === "fluxo_ia") && !vendedorIALiberado) {
      alert("ðŸ”’ NÃ£o Ã© possÃ­vel ativar este fluxo sem o mÃ³dulo Vendedor IA.");
      return;
    }
    if(!wsId) { alert("Workspace nÃ£o carregado. Recarregue a pÃ¡gina."); return; }
    const v = !fluxoAtivo.ativo;
    // ðŸ”’ MULTI-TENANT: defesa em profundidade â€” sÃ³ togglea se fluxo for deste workspace
    await supabase.from("fluxos").update({ativo:v})
      .eq("id",fluxoAtivo.id)
      .eq("workspace_id", wsId);
    setFluxoAtivo(p => p?{...p,ativo:v}:null); await load();
  }

  // âœ… ExclusÃ£o real â€” verifica se deu certo e limpa sessÃ£o se estava aberta
  async function excluirFluxo(id:number, nome:string) {
    if(!confirm(`Excluir o fluxo "${nome}" permanentemente?\nIsso nÃ£o pode ser desfeito.`)) return;
    if(!wsId) { alert("Workspace nÃ£o carregado. Recarregue a pÃ¡gina."); return; }

    // ðŸ”’ MULTI-TENANT: confere que o fluxo realmente pertence a este workspace ANTES de mexer.
    // Antes, qualquer user com o id do fluxo (descoberto via DevTools, console, etc) podia
    // deletar fluxos de outros workspaces.
    const fluxo = fluxos.find(f => f.id === id);
    if (!fluxo || fluxo.workspace_id !== wsId) {
      alert("Erro: fluxo nÃ£o pertence a este workspace.");
      return;
    }

    // TambÃ©m apaga as sessÃµes em execuÃ§Ã£o desse fluxo (pra nÃ£o ficar lixo).
    // NÃ£o precisa filtrar por workspace_id aqui: como jÃ¡ confirmamos acima que `fluxo` pertence
    // a este workspace, `id` Ã© uma chave globalmente Ãºnica e podemos confiar nele.
    await supabase.from("fluxo_sessoes").delete().eq("fluxo_id", id);

    // ðŸ”’ MULTI-TENANT CRÃTICO: delete do fluxo agora exige id E workspace_id baterem
    const { error } = await supabase.from("fluxos").delete()
      .eq("id",id)
      .eq("workspace_id", wsId);
    if (error) { alert("Erro ao excluir: " + error.message); return; }

    // Se era o fluxo aberto, volta pra lista
    if (fluxoAtivo?.id === id) {
      setFluxoAtivo(null); setNos([]); setArestas([]); setView("lista");
    }
    await load();
  }

  function adicionarNo(tipo:TipoNo) {
    if (tipo === "fluxo_ia" && !vendedorIALiberado) {
      alert("ðŸ”’ Vendedor IA Ã© um mÃ³dulo avulso de R$ 2.500,00. Solicite a liberaÃ§Ã£o ao administrador da Wolf System.");
      return;
    }
    const cfg = B[tipo];
    const rect = canvasRef.current?.getBoundingClientRect();
    const cw = rect?.width||800, ch = rect?.height||600;
    const s = scaleRef.current, o = offsetRef.current;
    const cx = (cw/2-o.x)/s-110, cy = (ch/2-o.y)/s-40;
    const sp = (nos.length%8)*28;
    const n:No = {id:uid(),tipo,x:cx+sp,y:cy+sp,dados:defaultD(tipo),saidas:[...cfg.saidas]};
    setNos(p => [...p,n]); setNoSel(n);
  }

  function excluirNo(id:string) {
    if(nos.find(n=>n.id===id)?.tipo==="inicio"){alert("NÃ£o pode excluir o inÃ­cio!");return;}
    setNos(p => p.filter(n=>n.id!==id));
    setArestas(p => p.filter(a=>a.de!==id&&a.para!==id));
    if(noSel?.id===id) setNoSel(null);
    if(noEditando?.id===id) setNoEditando(null);
  }

  function duplicarNo(id:string) {
    const origem = nos.find(n => n.id === id);
    if (origem?.tipo === "fluxo_ia" && !vendedorIALiberado) {
      alert("ðŸ”’ Este workspace nÃ£o possui o mÃ³dulo Vendedor IA.");
      return;
    }
    if (!origem || origem.tipo === "inicio") return;
    const copia: No = {
      ...origem,
      id: uid(),
      x: origem.x + 36,
      y: origem.y + 36,
      dados: JSON.parse(JSON.stringify(origem.dados || {})),
      saidas: [...origem.saidas],
    };
    setNos(p => [...p, copia]);
    setNoSel(copia);
    setNoEditando(copia);
  }

  function updateNo(id:string, d:Record<string,any>) {
    setNos(p => p.map(n => n.id===id ? {...n,dados:{...n.dados,...d}} : n));
    setNoSel(p => p?.id===id ? {...p,dados:{...p.dados,...d}} : p);
    setNoEditando(p => p?.id===id ? {...p,dados:{...p.dados,...d}} : p);
  }

  async function salvarConfiguracaoMidia(id:string, patch:Record<string,boolean>): Promise<void> {
    if (!fluxoAtivo?.id || !wsId || salvandoMidiaId) return;
    setSalvandoMidiaId(id);

    try {
      const { data: fluxoBanco, error: erroLeitura } = await supabase
        .from("fluxos")
        .select("id,nos")
        .eq("id", fluxoAtivo.id)
        .eq("workspace_id", wsId)
        .single();
      if (erroLeitura) throw erroLeitura;

      const nosBanco: No[] = Array.isArray(fluxoBanco?.nos)
        ? fluxoBanco.nos.map(normalizarConfiguracaoFluxoIA)
        : [];
      const idsBlocosIa = nosBanco.filter(n => n.tipo === "fluxo_ia").map(n => n.id);
      if (!idsBlocosIa.includes(id)) {
        throw new Error("O bloco de IA aberto nÃ£o existe mais no fluxo salvo.");
      }

      // A leitura de mÃ­dia Ã© uma extensÃ£o do fluxo, nÃ£o de uma Ãºnica etapa.
      // Assim, uma conversa que avanÃ§ar para outro bloco fluxo_ia mantÃ©m a
      // mesma configuraÃ§Ã£o sem alterar qualquer outra lÃ³gica do vendedor.
      const nosAtualizados = nosBanco.map(n => n.tipo === "fluxo_ia"
        ? normalizarConfiguracaoFluxoIA({...n, dados:{...(n.dados || {}), ...patch}})
        : n
      );

      const { data: confirmado, error: erroGravacao } = await supabase
        .from("fluxos")
        .update({nos:nosAtualizados})
        .eq("id", fluxoAtivo.id)
        .eq("workspace_id", wsId)
        .select("id,nos")
        .single();
      if (erroGravacao) throw erroGravacao;

      const nosConfirmados: No[] = Array.isArray(confirmado?.nos)
        ? confirmado.nos.map(normalizarConfiguracaoFluxoIA)
        : [];
      for (const idBloco of idsBlocosIa) {
        const bloco = nosConfirmados.find(n => n.id === idBloco);
        if (!bloco) throw new Error("O banco nÃ£o devolveu todos os blocos de IA atualizados.");
        for (const [chave, valor] of Object.entries(patch)) {
          if (booleanoConfiguracao(bloco.dados?.[chave], false) !== valor) {
            throw new Error(`O banco nÃ£o confirmou a opÃ§Ã£o ${chave} no bloco ${idBloco}.`);
          }
        }
      }

      const aplicarConfirmacao = (lista:No[]) => lista.map(n => {
        if (n.tipo !== "fluxo_ia" || !idsBlocosIa.includes(n.id)) return n;
        const confirmadoDoBloco = nosConfirmados.find(item => item.id === n.id);
        const valores = Object.fromEntries(
          Object.keys(patch).map(chave => [chave, confirmadoDoBloco?.dados?.[chave]])
        );
        return normalizarConfiguracaoFluxoIA({...n, dados:{...(n.dados || {}), ...valores}});
      });

      setNos(atual => aplicarConfirmacao(atual));
      setFluxoAtivo(atual => atual ? {...atual, nos:aplicarConfirmacao(atual.nos || [])} : atual);
      setNoSel(atual => atual ? aplicarConfirmacao([atual])[0] : atual);
      setNoEditando(atual => atual ? aplicarConfirmacao([atual])[0] : atual);
    } catch (erro:any) {
      console.error("Erro ao salvar configuraÃ§Ã£o de mÃ­dia:", erro);
      alert("NÃ£o foi possÃ­vel salvar a leitura de fotos e arquivos. Nada foi alterado.\n\n" + (erro?.message || erro));
    } finally {
      setSalvandoMidiaId(null);
    }
  }

  function onCanvasPointerDown(e:React.PointerEvent) {
    const t = e.target as HTMLElement;
    if(t.closest("button")||t.closest("input")||t.closest("select")||t.closest("textarea")) return;
    if(conectando){setConectando(null);return;}
    panning.current = true;
    panStart.current = {x:e.clientX,y:e.clientY,ox:offsetRef.current.x,oy:offsetRef.current.y};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e:React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if(rect) setMousePos({x:e.clientX-rect.left, y:e.clientY-rect.top});
    if(!panning.current) return;
    const nx = panStart.current.ox+(e.clientX-panStart.current.x);
    const ny = panStart.current.oy+(e.clientY-panStart.current.y);
    offsetRef.current = {x:nx,y:ny}; setOffset({x:nx,y:ny});
  }

  function onCanvasPointerUp(e:React.PointerEvent) {
    panning.current = false;
    try{(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);}catch{}
  }

  function onWheel(e:React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect(); if(!rect) return;
    const f = e.deltaY>0?0.9:1.1;
    const ns = Math.min(Math.max(scaleRef.current*f,0.2),2.5);
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    const no = {x:mx-(mx-offsetRef.current.x)*(ns/scaleRef.current), y:my-(my-offsetRef.current.y)*(ns/scaleRef.current)};
    scaleRef.current=ns; offsetRef.current=no; setScale(ns); setOffset({...no});
  }

  function iniciarConexao(noId:string, saidaIndex:number) { setConectando({noId,saidaIndex}); }

  function finalizarConexao(noId:string) {
    if(!conectando||conectando.noId===noId){setConectando(null);return;}
    setArestas(p => {
      const f = p.filter(a=>!(a.de===conectando.noId&&a.saidaIndex===conectando.saidaIndex));
      return [...f,{id:uid(),de:conectando.noId,saidaIndex:conectando.saidaIndex,para:noId}];
    });
    setConectando(null);
  }

  function posC(no:No, idx:number) { return {x:no.x+220, y:no.y+48+36*idx+18}; }
  function posE(no:No)              { return {x:no.x,     y:no.y+48+18};        }

  if(view==="lista") return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#f8fafc",color:"#1f2937"}}>
      <div style={{width:230,background:"#ffffff",borderRight:"1px solid #e5e7eb",display:"flex",flexDirection:"column",padding:14,gap:6,boxShadow:"2px 0 8px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"4px 8px"}}>
          <img src="/logo1.png" alt="Wolf" style={{width:32}}/>
          <span style={{color:"#1f2937",fontWeight:"700",fontSize:14}}>Wolf Chatbot</span>
        </div>
        <button onClick={()=>router.push("/chatbot")}
          style={{
            display:"flex",alignItems:"center",gap:10,
            background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,
            padding:"10px 12px",color:"#374151",fontSize:13,fontWeight:"600",cursor:"pointer",
            textAlign:"left",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
            transition:"transform .12s, box-shadow .12s, border-color .12s",
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.transform="translateY(-1px)";
            e.currentTarget.style.boxShadow="0 4px 12px rgba(59,130,246,0.15)";
            e.currentTarget.style.borderColor="#93c5fd";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.transform="translateY(0)";
            e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.04)";
            e.currentTarget.style.borderColor="#e5e7eb";
          }}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,background:"#3b82f615",borderRadius:8,fontSize:14}}>ðŸ’¬</span>
          Conversas
        </button>
        <button
          style={{
            display:"flex",alignItems:"center",gap:10,
            background:"#8b5cf615",border:"1px solid #8b5cf6",borderRadius:10,
            padding:"10px 12px",color:"#8b5cf6",fontSize:13,fontWeight:"700",cursor:"pointer",
            textAlign:"left",
            boxShadow:"0 2px 6px rgba(139,92,246,0.15)",
          }}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,background:"#8b5cf6",borderRadius:8,fontSize:14,filter:"saturate(0) brightness(2)",boxShadow:"0 2px 6px rgba(139,92,246,0.4)"}}>ðŸ¤–</span>
          Fluxos
        </button>
        <div style={{flex:1}}/>
        <button onClick={()=>router.push("/crm")}
          style={{
            display:"flex",alignItems:"center",gap:8,
            background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,
            padding:"10px 12px",color:"#6b7280",fontSize:12,fontWeight:"600",cursor:"pointer",
            textAlign:"left",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
            transition:"transform .12s, box-shadow .12s, border-color .12s",
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.transform="translateY(-1px)";
            e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.06)";
            e.currentTarget.style.borderColor="#d1d5db";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.transform="translateY(0)";
            e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.04)";
            e.currentTarget.style.borderColor="#e5e7eb";
          }}>â† Voltar ao CRM</button>
      </div>
      <div style={{flex:1,padding:32,overflowY:"auto"}}>
        {showNovo && (
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.4)",backdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#ffffff",borderRadius:16,padding:28,width:500,border:"1px solid #e5e7eb",display:"flex",flexDirection:"column",gap:16,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{
                    width:40,height:40,borderRadius:10,
                    background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
                    boxShadow:"0 4px 12px rgba(139,92,246,0.3)"
                  }}>âž•</div>
                  <h2 style={{color:"#1f2937",fontSize:18,fontWeight:"700",margin:0}}>Novo Fluxo</h2>
                </div>
                <button onClick={()=>setShowNovo(false)} style={{background:"#f3f4f6",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>âœ•</button>
              </div>
              <div><label style={{...LS,fontSize:11}}>Nome *</label>
                <input autoFocus placeholder="Ex: Fluxo de Vendas" value={form.nome}
                  onChange={e=>setForm({...form,nome:e.target.value})}
                  onKeyDown={e=>e.key==="Enter"&&criarFluxo()}
                  style={{...IS,fontSize:14,padding:"10px 14px"}}/>
              </div>
              <div><label style={{...LS,fontSize:11}}>DescriÃ§Ã£o</label>
                <input placeholder="Objetivo" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} style={IS}/>
              </div>
              <div><label style={{...LS,fontSize:11}}>Quando Ativar</label>
                <select value={form.trigger_tipo} onChange={e=>setForm({...form,trigger_tipo:e.target.value})} style={IS}>
                  <option value="qualquer_mensagem">Qualquer mensagem</option>
                  <option value="palavra_chave">Palavra-chave</option>
                  <option value="primeiro_contato">Primeiro contato</option>
                  <option value="fora_horario">Fora do horÃ¡rio</option>
                </select>
              </div>
              {form.trigger_tipo==="palavra_chave" && (
                <div><label style={{...LS,fontSize:11}}>Palavra-chave</label>
                  <input placeholder="oi, olÃ¡" value={form.trigger_valor} onChange={e=>setForm({...form,trigger_valor:e.target.value})} style={IS}/>
                </div>
              )}
              {form.trigger_tipo==="fora_horario" && (() => {
                let cfg = {hora_inicio:"08:00", hora_fim:"18:00"};
                try { if (form.trigger_valor) cfg = {...cfg, ...JSON.parse(form.trigger_valor)}; } catch {}
                const setCfg = (patch: any) => {
                  const novo = {...cfg, ...patch};
                  setForm({...form, trigger_valor: JSON.stringify(novo)});
                };
                return (
                  <div>
                    <label style={{...LS,fontSize:11}}>HorÃ¡rio de funcionamento (dispara FORA dessa faixa)</label>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <input type="time" value={cfg.hora_inicio}
                        onChange={e=>setCfg({hora_inicio:e.target.value})}
                        style={{...IS,flex:1}}/>
                      <span style={{color:"#6b7280",fontSize:12}}>atÃ©</span>
                      <input type="time" value={cfg.hora_fim}
                        onChange={e=>setCfg({hora_fim:e.target.value})}
                        style={{...IS,flex:1}}/>
                    </div>
                    <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0",lineHeight:1.3}}>
                      ðŸ’¡ O fluxo dispara quando o cliente manda mensagem FORA do horÃ¡rio {cfg.hora_inicio}â€“{cfg.hora_fim}.
                    </p>
                  </div>
                );
              })()}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
                <button onClick={()=>setShowNovo(false)} style={{background:"#ffffff",color:"#6b7280",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 20px",fontSize:13,cursor:"pointer",fontWeight:"600"}}>Cancelar</button>
                <button onClick={criarFluxo} disabled={criando} style={{
                  background:criando?"linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)":"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                  color:"#ffffff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,
                  cursor:criando?"wait":"pointer",fontWeight:"700",
                  boxShadow:criando?"none":"0 4px 12px rgba(139,92,246,0.35)"
                }}>
                  {criando?"â³ Criando...":"ðŸ¤– Criar Fluxo"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{
              width:48,height:48,borderRadius:12,
              background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
              boxShadow:"0 8px 16px rgba(139,92,246,0.25)"
            }}>ðŸ¤–</div>
            <div>
              <h1 style={{color:"#1f2937",fontSize:22,fontWeight:"700",margin:0}}>Meus Fluxos</h1>
              <p style={{color:"#6b7280",fontSize:13,margin:"2px 0 0"}}>{fluxos.length} fluxo(s) cadastrado(s)</p>
            </div>
          </div>
          <button onClick={()=>setShowNovo(true)} style={{
            background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color:"#ffffff",border:"none",borderRadius:10,
            padding:"11px 22px",fontSize:13,cursor:"pointer",fontWeight:"700",
            boxShadow:"0 4px 12px rgba(139,92,246,0.35), 0 1px 3px rgba(139,92,246,0.2)",
            transition:"transform .12s, box-shadow .12s",
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.transform="translateY(-1px)";
            e.currentTarget.style.boxShadow="0 6px 16px rgba(139,92,246,0.45)";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.transform="translateY(0)";
            e.currentTarget.style.boxShadow="0 4px 12px rgba(139,92,246,0.35), 0 1px 3px rgba(139,92,246,0.2)";
          }}>+ Novo Fluxo</button>
        </div>
        {fluxos.length===0 ? (
          <div style={{background:"#ffffff",borderRadius:16,padding:64,textAlign:"center",border:"1px solid #e5e7eb",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              width:96,height:96,borderRadius:24,
              background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              fontSize:48,margin:"0 auto 20px",
              boxShadow:"0 12px 24px rgba(139,92,246,0.25)"
            }}>ðŸ¤–</div>
            <h3 style={{color:"#1f2937",fontSize:18,fontWeight:"700",margin:"0 0 8px"}}>Nenhum fluxo criado</h3>
            <p style={{color:"#6b7280",fontSize:14,margin:"0 0 24px"}}>Crie fluxos de atendimento automÃ¡tico pra seu chatbot</p>
            <button onClick={()=>setShowNovo(true)} style={{
              background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              color:"#ffffff",border:"none",borderRadius:12,
              padding:"14px 32px",fontSize:14,cursor:"pointer",fontWeight:"700",
              boxShadow:"0 4px 12px rgba(139,92,246,0.35)"
            }}>+ Criar Primeiro Fluxo</button>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:18}}>
            {fluxos.map(f => (
              <div key={f.id} style={{
                background:"#ffffff",borderRadius:14,padding:20,
                border:`1px solid ${f.ativo?"#22c55e44":"#e5e7eb"}`,
                boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
                transition:"transform .15s, box-shadow .15s, border-color .15s",
                cursor:"default",
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.transform="translateY(-2px)";
                e.currentTarget.style.boxShadow="0 8px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)";
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.transform="translateY(0)";
                e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)";
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                    <div style={{
                      width:38,height:38,borderRadius:10,
                      background:f.ativo?"linear-gradient(135deg, #22c55e 0%, #16a34a 100%)":"#f3f4f6",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                      boxShadow:f.ativo?"0 4px 8px rgba(34,197,94,0.25)":"none",
                      flexShrink:0
                    }}>{f.ativo?"ðŸš€":"â¸ï¸"}</div>
                    <div style={{minWidth:0,flex:1}}>
                      <h3 style={{color:"#1f2937",fontSize:15,fontWeight:"700",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nome}</h3>
                      {f.descricao && <p style={{color:"#6b7280",fontSize:11,margin:"3px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.descricao}</p>}
                    </div>
                  </div>
                  <span style={{
                    display:"inline-flex",alignItems:"center",gap:4,
                    background:f.ativo?"#dcfce7":"#f3f4f6",
                    color:f.ativo?"#16a34a":"#6b7280",
                    fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:"700",whiteSpace:"nowrap",
                    border:f.ativo?"1px solid #86efac":"1px solid #e5e7eb",
                    flexShrink:0
                  }}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:f.ativo?"#22c55e":"#9ca3af",boxShadow:f.ativo?"0 0 0 2px #22c55e33":"none"}}/>
                    {f.ativo?"Ativo":"Inativo"}
                  </span>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f3f4f6",color:"#4b5563",fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:"500"}}>
                    ðŸ§© {f.nos?.length||0} blocos
                  </span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f3f4f6",color:"#4b5563",fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:"500"}}>
                    {f.trigger_tipo==="qualquer_mensagem"?"ðŸ“¨ Qualquer":f.trigger_tipo==="palavra_chave"?`ðŸ”‘ "${f.trigger_valor}"`:f.trigger_tipo==="primeiro_contato"?"ðŸ‘‹ 1Âº contato":"ðŸ• Fora horÃ¡rio"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>abrirEditor(f)} style={{
                    flex:1,
                    background:"linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    color:"#ffffff",border:"none",borderRadius:10,
                    padding:"9px",fontSize:12,cursor:"pointer",fontWeight:"700",
                    boxShadow:"0 2px 6px rgba(139,92,246,0.25)",
                    transition:"transform .12s, box-shadow .12s",
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.transform="translateY(-1px)";
                    e.currentTarget.style.boxShadow="0 4px 12px rgba(139,92,246,0.4)";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.transform="translateY(0)";
                    e.currentTarget.style.boxShadow="0 2px 6px rgba(139,92,246,0.25)";
                  }}>âœï¸ Editar</button>
                  <button onClick={()=>excluirFluxo(f.id!, f.nome)} style={{
                    background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",
                    borderRadius:10,padding:"9px 14px",fontSize:13,cursor:"pointer",
                    transition:"background .12s, border-color .12s",
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.background="#fee2e2";
                    e.currentTarget.style.borderColor="#fca5a5";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.background="#fef2f2";
                    e.currentTarget.style.borderColor="#fecaca";
                  }}>ðŸ—‘ï¸</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#f8fafc",color:"#1f2937",overflow:"hidden"}}>

      <div style={{width:220,background:"#ffffff",borderRight:"1px solid #e5e7eb",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"2px 0 8px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setView("lista")} style={{
            background:"#f3f4f6",border:"none",color:"#6b7280",fontSize:14,
            cursor:"pointer",padding:"4px 8px",borderRadius:6,
            transition:"background .15s"
          }}
          onMouseEnter={e=>(e.currentTarget.style.background="#e5e7eb")}
          onMouseLeave={e=>(e.currentTarget.style.background="#f3f4f6")}>â†</button>
          <h3 style={{color:"#1f2937",fontSize:13,fontWeight:"bold",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{fluxoAtivo?.nome}</h3>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
          {GRUPOS.map(grupo => {
            const tipos = (Object.entries(B) as [TipoNo,BC][]).filter(([tipo,c])=>c.grupo===grupo && (tipo!=="fluxo_ia" || vendedorIALiberado));
            const ab = grupoAberto===grupo;
            return (
              <div key={grupo} style={{marginBottom:6}}>
                <button onClick={()=>setGrupoAberto(ab?"":grupo)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 16px",background:"none",border:"none",cursor:"pointer",color:ab?"#1f2937":"#6b7280",fontSize:10,fontWeight:"800",textTransform:"uppercase",letterSpacing:1.2}}>
                  <span>{grupo}</span>
                  <span style={{fontSize:8,color:ab?"#8b5cf6":"#9ca3af",transition:"transform .2s",transform:ab?"rotate(0deg)":"rotate(-90deg)"}}>â–¼</span>
                </button>
                {ab && (
                  <div style={{padding:"4px 10px 6px",display:"flex",flexDirection:"column",gap:4}}>
                    {tipos.map(([tipo,cfg]) => {
                      return (
                      <button key={tipo} onClick={()=>adicionarNo(tipo)}
                        style={{
                          display:"flex",alignItems:"center",gap:10,width:"100%",
                          background:"#ffffff", border:"1px solid #e5e7eb", borderRadius:8,
                          padding:"7px 10px", color:"#1f2937", fontSize:12, fontWeight:"500",
                          cursor:"pointer",
                          textAlign:"left", boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
                          transition:"transform .12s ease, box-shadow .12s ease, border-color .12s ease",
                        }}
                        onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=`0 4px 12px ${cfg.cor}22, 0 1px 3px rgba(0,0,0,0.06)`; e.currentTarget.style.borderColor=`${cfg.cor}55`; }}
                        onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor="#e5e7eb"; }}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,background:`${cfg.cor}15`,borderRadius:7,fontSize:14,flexShrink:0}}>{cfg.icone}</span>
                        <span style={{flex:1}}>{cfg.label}</span>
                      </button>
                    );})}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{padding:12,borderTop:"1px solid #e5e7eb",background:"#fafbfc"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,padding:"9px 12px",marginBottom:10,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
            <span style={{color:fluxoAtivo?.ativo?"#16a34a":"#6b7280",fontSize:12,fontWeight:"600",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:fluxoAtivo?.ativo?"#22c55e":"#9ca3af",boxShadow:fluxoAtivo?.ativo?"0 0 0 3px #22c55e22":"none"}}/>
              {fluxoAtivo?.ativo?"Ativo":"Inativo"}
            </span>
            <button onClick={toggleAtivo} style={{width:38,height:22,background:fluxoAtivo?.ativo?"#22c55e":"#d1d5db",borderRadius:11,cursor:"pointer",border:"none",position:"relative",transition:"background .2s",boxShadow:"inset 0 1px 2px rgba(0,0,0,0.1)"}}>
              <div style={{width:16,height:16,background:"white",borderRadius:"50%",position:"absolute",top:3,left:fluxoAtivo?.ativo?19:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </button>
          </div>
          <button onClick={()=>void salvar()} disabled={salvando} style={{
            width:"100%",
            background: salvando
              ? "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
              : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color:"#ffffff",
            border:"none",
            borderRadius:10,
            padding:"11px",
            fontSize:13,
            cursor:salvando?"not-allowed":"pointer",
            fontWeight:"700",
            boxShadow: salvando ? "none" : "0 4px 12px rgba(139, 92, 246, 0.35), 0 1px 3px rgba(139, 92, 246, 0.2)",
            transition:"transform .12s ease, box-shadow .12s ease",
          }}
          onMouseEnter={e=>{
            if (!salvando) {
              e.currentTarget.style.transform="translateY(-1px)";
              e.currentTarget.style.boxShadow="0 6px 16px rgba(139, 92, 246, 0.45), 0 2px 4px rgba(139, 92, 246, 0.25)";
            }
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.transform="translateY(0)";
            if (!salvando) e.currentTarget.style.boxShadow="0 4px 12px rgba(139, 92, 246, 0.35), 0 1px 3px rgba(139, 92, 246, 0.2)";
          }}>
            {salvando?"Salvando...":"ðŸ’¾ Salvar Fluxo"}
          </button>
        </div>
      </div>

      <div ref={canvasRef}
        style={{flex:1,position:"relative",overflow:"hidden",cursor:panning.current?"grabbing":conectando?"crosshair":"default",touchAction:"none",
          background:"#f8fafc"}}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onWheel={onWheel}
        onClick={()=>setNoSel(null)}
      >
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          <defs>
            <pattern id="dots" width={24*scale} height={24*scale} patternUnits="userSpaceOnUse" x={offset.x%(24*scale)} y={offset.y%(24*scale)}>
              <circle cx={1} cy={1} r={0.8} fill="#cbd5e1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>

        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible"}}>
          {arestas.map(a => {
            const nO=nos.find(n=>n.id===a.de), nD=nos.find(n=>n.id===a.para);
            if(!nO||!nD) return null;
            const o=posC(nO,a.saidaIndex), d2=posE(nD);
            const ox=o.x*scale+offset.x, oy=o.y*scale+offset.y;
            const dx=d2.x*scale+offset.x, dy=d2.y*scale+offset.y;
            const cor=B[nO.tipo]?.cor||"#4b5563";
            return (
              <g key={a.id} style={{pointerEvents:"all",cursor:"pointer"}} onClick={()=>setArestas(p=>p.filter(x=>x.id!==a.id))}>
                <path d={`M${ox} ${oy} C${ox+80*scale} ${oy} ${dx-80*scale} ${dy} ${dx} ${dy}`} stroke={cor} strokeWidth={2} fill="none" opacity={0.7}/>
                <path d={`M${ox} ${oy} C${ox+80*scale} ${oy} ${dx-80*scale} ${dy} ${dx} ${dy}`} stroke="transparent" strokeWidth={14} fill="none"/>
                <circle cx={dx} cy={dy} r={5} fill={cor}/>
              </g>
            );
          })}
          {conectando && (() => {
            const no=nos.find(n=>n.id===conectando.noId); if(!no) return null;
            const o=posC(no,conectando.saidaIndex);
            const ox=o.x*scale+offset.x, oy=o.y*scale+offset.y;
            const cor=B[no.tipo]?.cor||"#8b5cf6";
            return <path d={`M${ox} ${oy} C${ox+80} ${oy} ${mousePos.x-80} ${mousePos.y} ${mousePos.x} ${mousePos.y}`} stroke={cor} strokeWidth={2} strokeDasharray="6 3" fill="none"/>;
          })()}
        </svg>

        <div style={{position:"absolute",inset:0,transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`,transformOrigin:"0 0"}}>
          {nos.map(no => (
            <NoCard key={no.id} no={no} sel={noSel?.id===no.id}
              scale={scale}
              onSelect={id => setNoSel(nos.find(n=>n.id===id)||null)}
              onOpen={id => {
                const n = nos.find(n => n.id === id);
                if (n) {
                  setNoSel(n);
                  setNoEditando(n);
                }
              }}
              onDelete={excluirNo}
              onConectarSaida={iniciarConexao}
              onConectarEntrada={finalizarConexao}
              onMove={(id,x,y) => setNos(p=>p.map(n=>n.id===id?{...n,x,y}:n))}
            />
          ))}
        </div>

        <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:8}}>
          <div style={{background:"#f8fafc",border:"1px solid #ffffff",borderRadius:8,padding:"6px 12px"}}>
            <p style={{color:"#6b7280",fontSize:10,margin:0}}>ðŸ–±ï¸ Arraste blocos â€¢ Scroll zoom â€¢ â— conectar â€¢ Clique na linha para excluir</p>
          </div>
          <div style={{background:"#f8fafc",border:"1px solid #ffffff",borderRadius:8,padding:"6px 10px",display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{const s=Math.min(scaleRef.current*1.2,2.5);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>+</button>
            <span style={{color:"#6b7280",fontSize:10}}>{Math.round(scale*100)}%</span>
            <button onClick={()=>{const s=Math.max(scaleRef.current*0.8,0.2);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>âˆ’</button>
            <button onClick={()=>{scaleRef.current=1;offsetRef.current={x:80,y:80};setScale(1);setOffset({x:80,y:80});}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10}}>Reset</button>
          </div>
        </div>
        <div style={{position:"absolute",top:16,right:noSel?285:16,background:"#f8fafc",border:"1px solid #ffffff",borderRadius:8,padding:"6px 12px"}}>
          <p style={{color:"#6b7280",fontSize:10,margin:0}}>{nos.length} blocos â€¢ {arestas.length} conexÃµes</p>
        </div>
      </div>

      {/* ðŸ†• MODAL CENTRALIZADO de ediÃ§Ã£o (em vez de sidebar lateral).
          Vantagens: muito mais espaÃ§o pros campos, nÃ£o some informaÃ§Ã£o, foco total no bloco.
          Desvantagem: canvas fica escurecido atrÃ¡s (mas dÃ¡ pra fechar e voltar rÃ¡pido). */}
      {noEditando && (
        <div
          onClick={() => setNoEditando(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #ffffff",
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px #000c",
            }}
          >
            {/* Header do modal */}
            <div style={{
              padding: "14px 18px",
              borderBottom: "1px solid #ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: B[noEditando.tipo]?.cor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}>
                  {B[noEditando.tipo]?.icone}
                </div>
                <div>
                  <h3 style={{ color: "#1f2937", fontSize: 15, fontWeight: "bold", margin: 0 }}>{B[noEditando.tipo]?.label}</h3>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{B[noEditando.tipo]?.grupo}</p>
                </div>
              </div>
              <button
                onClick={() => setNoEditando(null)}
                style={{
                  background: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  color: "#9ca3af",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >âœ•</button>
            </div>

            {/* ConteÃºdo (scrollÃ¡vel). overflowX visible permite que o dropdown ï¼‹VariÃ¡vel
                possa expandir lateralmente sem ser cortado. */}
            <div style={{
              padding: 18,
              overflowY: "auto",
              overflowX: "visible",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              <PainelProps
                noSel={noEditando}
                updateNo={updateNo}
                excluirNo={(id) => { excluirNo(id); setNoEditando(null); }}
                setNos={setNos}
                filasBanco={filasBanco}
                atendentesBanco={atendentesBanco}
                nos={nos}
                statusVendaOpcoes={statusVendaOpcoes}
                camposPropostaUnif={camposPropostaUnif}
                vendedorIALiberado={vendedorIALiberado}
                salvarConfiguracaoMidia={salvarConfiguracaoMidia}
                salvandoMidiaId={salvandoMidiaId}
              />
            </div>

            {/* Footer com aÃ§Ãµes */}
            {noEditando.tipo !== "inicio" && (
              <div style={{
                padding: "12px 18px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: 8,
                flexShrink: 0,
              }}>
                <button
                  onClick={() => duplicarNo(noEditando.id)}
                  style={{
                    background: "#f5f3ff",
                    color: "#7c3aed",
                    border: "1px solid #c4b5fd",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >ðŸ“‹ Duplicar bloco</button>
                <button
                  onClick={() => { excluirNo(noEditando.id); setNoEditando(null); }}
                  style={{
                    background: "#fef2f2",
                    color: "#ef4444",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >ðŸ—‘ï¸ Excluir bloco</button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => void salvar({fecharEditor:true, avisarSucesso:true})}
                  disabled={salvando}
                  style={{
                    background: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >{salvando?"Salvando...":"âœ“ Salvar bloco"}</button>
              </div>
            )}
            {/* Pro nÃ³ "inicio" sÃ³ botÃ£o de concluir */}
            {noEditando.tipo === "inicio" && (
              <div style={{
                padding: "12px 18px",
                borderTop: "1px solid #ffffff",
                display: "flex",
                justifyContent: "flex-end",
                flexShrink: 0,
              }}>
                <button
                  onClick={() => void salvar({fecharEditor:true, avisarSucesso:true})}
                  disabled={salvando}
                  style={{
                    background: "#3b82f6",
                    color: "#1f2937",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >{salvando?"Salvando...":"âœ“ Salvar bloco"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
