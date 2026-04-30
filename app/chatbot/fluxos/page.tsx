"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type TipoNo =
  | "texto" | "imagem" | "video" | "audio" | "embed"
  | "input_texto" | "input_numero" | "input_email" | "input_website"
  | "input_data" | "input_hora" | "input_telefone" | "input_botao"
  | "input_selecao_imagem" | "input_pagamento" | "input_avaliacao"
  | "input_arquivo" | "input_cards"
  | "condicao" | "variavel" | "redirecionar" | "script" | "espera"
  | "teste_ab" | "webhook" | "pular" | "retornar"
  | "google_sheets" | "http_request" | "openai" | "claude_ai" | "gmail"
  | "inicio" | "comando" | "reply" | "invalido" | "transferir" | "finalizar";

type No = { id: string; tipo: TipoNo; x: number; y: number; dados: Record<string,any>; saidas: string[]; };
type Aresta = { id: string; de: string; saidaIndex: number; para: string; };
type Fluxo = { id?: number; nome: string; descricao: string; ativo: boolean; trigger_tipo: string; trigger_valor: string; nos: No[]; conexoes: Aresta[]; workspace_id: string; };
type BC = { label: string; icone: string; cor: string; saidas: string[]; grupo: string; };
type FilaItem = { id: number; nome: string; conexao?: string; }; // 🆕 filas do CRM

const B: Record<TipoNo, BC> = {
  texto:                {label:"Texto",           icone:"💬", cor:"#3b82f6", saidas:["Próximo"],                     grupo:"Bubbles"},
  imagem:               {label:"Imagem",          icone:"🖼️", cor:"#06b6d4", saidas:["Próximo"],                     grupo:"Bubbles"},
  video:                {label:"Vídeo",           icone:"🎥", cor:"#8b5cf6", saidas:["Próximo"],                     grupo:"Bubbles"},
  audio:                {label:"Áudio",           icone:"🎵", cor:"#ec4899", saidas:["Próximo"],                     grupo:"Bubbles"},
  embed:                {label:"Incorporar",      icone:"🔗", cor:"#f97316", saidas:["Próximo"],                     grupo:"Bubbles"},
  input_texto:          {label:"Texto",           icone:"✏️", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_numero:         {label:"Número",          icone:"🔢", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_email:          {label:"Email",           icone:"📧", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_website:        {label:"Website",         icone:"🌐", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_data:           {label:"Data",            icone:"📅", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_hora:           {label:"Hora",            icone:"🕐", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_telefone:       {label:"Telefone",        icone:"📱", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_botao:          {label:"Botão",           icone:"🔘", cor:"#16a34a", saidas:["Botão 1","Botão 2","Botão 3"], grupo:"Inputs"},
  input_selecao_imagem: {label:"Seleção Imagem", icone:"🖼️", cor:"#16a34a", saidas:["Selecionado"],                 grupo:"Inputs"},
  input_pagamento:      {label:"Pagamento",       icone:"💳", cor:"#16a34a", saidas:["Aprovado","Recusado"],         grupo:"Inputs"},
  input_avaliacao:      {label:"Avaliação",       icone:"⭐", cor:"#16a34a", saidas:["Resposta recebida"],           grupo:"Inputs"},
  input_arquivo:        {label:"Arquivo",         icone:"📎", cor:"#16a34a", saidas:["Arquivo recebido"],            grupo:"Inputs"},
  input_cards:          {label:"Cards",           icone:"🃏", cor:"#16a34a", saidas:["Selecionado"],                 grupo:"Inputs"},
  condicao:             {label:"Condição",        icone:"🔀", cor:"#f59e0b", saidas:["Verdadeiro","Falso"],          grupo:"Lógica"},
  variavel:             {label:"Variável",        icone:"📦", cor:"#f59e0b", saidas:["Próximo"],                     grupo:"Lógica"},
  redirecionar:         {label:"Redirecionar",    icone:"↩️", cor:"#f59e0b", saidas:[],                              grupo:"Lógica"},
  script:               {label:"Script",          icone:"⌨️", cor:"#f59e0b", saidas:["Próximo"],                     grupo:"Lógica"},
  espera:               {label:"Espera",          icone:"⏳", cor:"#f59e0b", saidas:["Continuar"],                   grupo:"Lógica"},
  teste_ab:             {label:"Teste A/B",       icone:"🧪", cor:"#f59e0b", saidas:["A","B"],                       grupo:"Lógica"},
  webhook:              {label:"Webhook",         icone:"🔔", cor:"#f59e0b", saidas:["Próximo"],                     grupo:"Lógica"},
  pular:                {label:"Pular",           icone:"⏭️", cor:"#f59e0b", saidas:[],                              grupo:"Lógica"},
  retornar:             {label:"Retornar",        icone:"🔁", cor:"#f59e0b", saidas:[],                              grupo:"Lógica"},
  google_sheets:        {label:"Google Sheets",   icone:"📊", cor:"#10b981", saidas:["Próximo"],                     grupo:"Integrações"},
  http_request:         {label:"HTTP Request",    icone:"🌐", cor:"#10b981", saidas:["Sucesso","Erro"],              grupo:"Integrações"},
  openai:               {label:"OpenAI",          icone:"🤖", cor:"#10b981", saidas:["Próximo"],                     grupo:"Integrações"},
  claude_ai:            {label:"Claude AI",       icone:"🧠", cor:"#10b981", saidas:["Próximo"],                     grupo:"Integrações"},
  gmail:                {label:"Gmail",           icone:"📨", cor:"#10b981", saidas:["Enviado"],                     grupo:"Integrações"},
  inicio:               {label:"Início",          icone:"🚀", cor:"#16a34a", saidas:["Próximo"],                     grupo:"Eventos"},
  comando:              {label:"Comando",         icone:"⚡", cor:"#dc2626", saidas:["Próximo"],                     grupo:"Eventos"},
  reply:                {label:"Reply",           icone:"↩️", cor:"#dc2626", saidas:["Próximo"],                     grupo:"Eventos"},
  invalido:             {label:"Inválido",        icone:"❌", cor:"#dc2626", saidas:["Próximo"],                     grupo:"Eventos"},
  transferir:           {label:"Transferir",      icone:"👤", cor:"#dc2626", saidas:["Próximo"],                     grupo:"Eventos"},
  finalizar:            {label:"Finalizar",       icone:"🏁", cor:"#dc2626", saidas:[],                              grupo:"Eventos"},
};

const GRUPOS = ["Bubbles","Inputs","Lógica","Integrações","Eventos"];
const uid = () => Math.random().toString(36).slice(2,10);

const IS: React.CSSProperties = {width:"100%",background:"#0a0a0a",border:"1px solid #374151",borderRadius:6,padding:"8px 10px",color:"white",fontSize:12,boxSizing:"border-box"};
const LS: React.CSSProperties = {color:"#9ca3af",fontSize:10,textTransform:"uppercase",display:"block",marginBottom:4,letterSpacing:1};

// ✅ ATUALIZADO — pega username do workspace (nunca o id numérico)
async function getWsUsername(): Promise<string|null> {
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return null;
  // 1. Dono do workspace
  const {data: wsDono} = await supabase.from("workspaces").select("username").eq("owner_id", user.id).maybeSingle();
  if (wsDono?.username) return wsDono.username;
  // 2. Sub-usuário
  const {data: uw} = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", user.email).maybeSingle();
  if (uw) {
    const {data: wsSub} = await supabase.from("workspaces").select("username").or(`username.eq.${uw.workspace_id},id.eq.${uw.workspace_id}`).maybeSingle();
    if (wsSub?.username) return wsSub.username;
  }
  return null;
}

function defaultD(tipo: TipoNo): Record<string,any> {
  const m: Partial<Record<TipoNo,Record<string,any>>> = {
    texto:{texto:"Digite sua mensagem aqui..."},
    imagem:{url:"",legenda:""},video:{url:"",legenda:""},audio:{url:""},embed:{url:""},
    input_texto:{pergunta:"Qual é o seu nome?",variavel:"nome"},
    input_numero:{pergunta:"Qual número?",variavel:"numero"},
    input_email:{pergunta:"Qual seu email?",variavel:"email"},
    input_website:{pergunta:"Qual website?",variavel:"website"},
    input_data:{pergunta:"Qual a data?",variavel:"data"},
    input_hora:{pergunta:"Qual a hora?",variavel:"hora"},
    input_telefone:{pergunta:"Qual telefone?",variavel:"telefone"},
    input_botao:{texto:"Escolha:",botoes:["Opção 1","Opção 2"]},
    input_selecao_imagem:{texto:"Selecione:",itens:[]},
    input_pagamento:{valor:0,descricao:"Pagamento"},
    input_avaliacao:{pergunta:"Como avalia?",max:5,variavel:"avaliacao"},
    input_arquivo:{pergunta:"Envie arquivo:",variavel:"arquivo"},
    input_cards:{cards:[{titulo:"Card 1",descricao:""}]},
    condicao:{variavel:"resposta",operador:"igual",valor:""},
    variavel:{nome:"minhaVar",valor:"",tipo:"texto"},
    redirecionar:{url:""},script:{codigo:"// código\nreturn true;"},
    espera:{segundos:3},teste_ab:{percentual_a:50},
    webhook:{url:"",metodo:"POST",headers:"",body:""},
    pular:{alvo:""},retornar:{alvo:""},
    google_sheets:{spreadsheet_id:"",aba:"Sheet1",acao:"append",dados:""},
    http_request:{url:"",metodo:"GET",headers:"",body:"",variavel:""},
    openai:{apiKey:"",modelo:"gpt-4o-mini",prompt:"",variavel:"resposta_ia"},
    claude_ai:{apiKey:"",modelo:"claude-sonnet-4-20250514",prompt:"",variavel:"resposta_ia"},
    gmail:{para:"",assunto:"",corpo:""},
    inicio:{mensagem:"Olá! Como posso te ajudar?"},
    comando:{comando:"/start"},reply:{palavras:""},
    invalido:{mensagem:"Não entendi."},
    transferir:{fila:"",mensagem:"Transferindo..."}, // 🆕 fila vazia, usuário seleciona
    finalizar:{mensagem:"Atendimento finalizado. Obrigado!"},
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
      return `${d.pergunta||"?"} → {{${d.variavel||"var"}}}`;
    case "input_botao": return `${d.botoes?.length||0} botões`;
    case "input_selecao_imagem": return `${d.itens?.length||0} imgs`;
    case "input_pagamento": return `R$ ${d.valor||0}`;
    case "input_cards": return `${d.cards?.length||0} cards`;
    case "condicao": {
      // 🆕 Suporta múltiplas condições com OR/AND
      if (Array.isArray(d.condicoes) && d.condicoes.length > 0) {
        const juncao = d.juncao === "OR" ? " OU " : " E ";
        return d.condicoes.slice(0, 2).map((c: any) => `{{${c.variavel||"?"}}} ${c.operador||"="} "${c.valor||""}"`).join(juncao) + (d.condicoes.length > 2 ? ` ${juncao} +${d.condicoes.length - 2}` : "");
      }
      return `SE {{${d.variavel}}} ${d.operador} "${d.valor}"`;
    }
    case "variavel": {
      // 🆕 Mostra modo no canvas
      const modo = d.modo_valor || "texto";
      const icone = modo === "codigo" ? "💻" : modo === "expressao" ? "🔗" : "📝";
      const valor = String(d.valor || "").slice(0, 30);
      return `${icone} {{${d.nome||"?"}}} = ${valor}${String(d.valor||"").length > 30 ? "..." : ""}`;
    }
    case "redirecionar": return d.url||"Sem URL";
    case "script": return "Script JS";
    case "espera": return `⏳ ${d.segundos}s`;
    case "teste_ab": return `A:${d.percentual_a}% B:${100-(d.percentual_a||50)}%`;
    case "webhook": return `${d.metodo} ${d.url||""}`;
    case "pular":case"retornar": return `→ ${d.alvo||"?"}`;
    case "google_sheets": return `Sheets: ${d.acao}`;
    case "http_request": return `${d.metodo} ${d.url||""}`;
    case "openai": return `GPT: ${d.modelo}`;
    case "claude_ai": return `Claude: ${d.modelo}`;
    case "gmail": return `Para: ${d.para||"?"}`;
    case "inicio": return d.mensagem||"Início";
    case "comando": return d.comando||"/start";
    case "reply": return d.palavras||"Palavras-chave";
    case "invalido": return d.mensagem||"Inválido";
    case "transferir": return d.fila ? `→ ${d.fila}` : "⚠️ Sem fila selecionada"; // 🆕
    case "finalizar": return d.mensagem||"Finalizar";
    default: return "";
  }
}

function PainelProps({ noSel, updateNo, excluirNo, setNos, filasBanco, nos }: {
  noSel: No;
  updateNo: (id: string, d: Record<string,any>) => void;
  excluirNo: (id: string) => void;
  setNos: React.Dispatch<React.SetStateAction<No[]>>;
  filasBanco: FilaItem[]; // 🆕
  nos: No[]; // 🆕 lista completa de nós pra detectar variáveis criadas
}) {
  const d = noSel.dados;
  const id = noSel.id;
  const u = (o: Record<string,any>) => updateNo(id, o);

  // 🆕 Coleta TODAS as variáveis criadas no fluxo (em qualquer bloco que seta variável).
  // Usado pro autocomplete/dropdown nos blocos que usam variáveis.
  const variaveisDoFluxo = (() => {
    const set = new Set<string>();
    nos.forEach(n => {
      const dn = n.dados || {};
      // Blocos que CAPTURAM variáveis
      if (dn.variavel) set.add(dn.variavel);
      if (dn.variavel_resposta) set.add(dn.variavel_resposta);
      if (dn.variavel_status) set.add(dn.variavel_status);
      // Bloco "variavel" (set manual)
      if (n.tipo === "variavel" && dn.nome) set.add(dn.nome);
      // Condições — referenciam mas também incluo pra autocompletar
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

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // TVar — Textarea COM botão "+ Variável" estilo Typebot.
  // ═══════════════════════════════════════════════════════════════════════
  // Permite inserir {{nome_variavel}} na posição do cursor com 1 clique.
  // Mostra lista de variáveis existentes no fluxo + opção de criar nova.
  // Use em blocos onde a mensagem contém texto + variáveis (texto, legenda, etc).
  const TVar = (lbl: string, key: string, ph = "", h = 100) => {
    const dropdownId = `tvar-${id}-${key}`;
    const textareaId = `textarea-${id}-${key}`;

    // Insere {{nome}} na posição do cursor (ou no fim se não tiver foco)
    const inserirVar = (nome: string) => {
      if (!nome.trim()) return;
      const nomeFinal = nome.trim();
      const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
      const valorAtual = String(d[key] || "");
      let novoValor: string;
      let novaPos: number;

      if (ta) {
        const start = ta.selectionStart ?? valorAtual.length;
        const end = ta.selectionEnd ?? valorAtual.length;
        const insercao = `{{${nomeFinal}}}`;
        novoValor = valorAtual.slice(0, start) + insercao + valorAtual.slice(end);
        novaPos = start + insercao.length;
      } else {
        novoValor = valorAtual + `{{${nomeFinal}}}`;
        novaPos = novoValor.length;
      }

      u({ [key]: novoValor });

      // Restaura o cursor depois do insert (precisa de timeout pq React vai re-renderizar)
      setTimeout(() => {
        const taNova = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (taNova) {
          taNova.focus();
          taNova.setSelectionRange(novaPos, novaPos);
        }
      }, 50);

      // Fecha o dropdown
      document.getElementById(dropdownId)?.removeAttribute("open");
    };

    return (
      <div key={`${id}-${key}-tvar`}>
        <label style={LS}>{lbl}</label>
        <div style={{ position: "relative" }}>
          <textarea
            id={textareaId}
            value={d[key] || ""}
            onChange={e => u({ [key]: e.target.value })}
            style={{ ...IS, height: h, resize: "vertical", paddingRight: 12 }}
            placeholder={ph}
          />
          {/* Botão "+ Variável" no canto inferior direito do textarea */}
          <details
            id={dropdownId}
            style={{ position: "absolute", bottom: 8, right: 8 }}
          >
            <summary style={{
              listStyle: "none",
              cursor: "pointer",
              background: "#8b5cf622",
              color: "#a78bfa",
              border: "1px solid #8b5cf633",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: "bold",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              userSelect: "none",
              outline: "none",
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>＋</span> Variável
            </summary>
            <div style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              right: 0,                  // 🆕 alinhado pela direita do botão (cresce pra esquerda)
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 8,
              boxShadow: "0 8px 24px #000c",
              padding: 10,
              width: 240,                // 🆕 width fixo menor — cabe no modal
              maxHeight: 220,
              overflowY: "auto",
              zIndex: 2000,
            }}>
              {/* Input pra digitar nome novo */}
              <input
                type="text"
                placeholder="Digite ou crie variável..."
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    inserirVar((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                style={{
                  width: "100%",
                  background: "#111",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "white",
                  fontSize: 12,
                  marginBottom: 8,
                  outline: "none",
                }}
              />
              {variaveisDoFluxo.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                  Nenhuma variável no fluxo ainda.<br />Digite acima pra criar a primeira.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {variaveisDoFluxo.map(v => (
                    <button
                      key={v}
                      onClick={() => inserirVar(v)}
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
          </details>
        </div>
        {variaveisDoFluxo.length > 0 && (
          <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", lineHeight: 1.3 }}>
            💡 Clique em <b style={{ color: "#a78bfa" }}>＋ Variável</b> pra inserir uma variável do fluxo na posição do cursor.
          </p>
        )}
      </div>
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

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // VarPill — Componente visual estilo Typebot pra escolher variável.
  // ═══════════════════════════════════════════════════════════════════════
  // Exibe a variável atual como uma "pílula" roxa (igual Typebot). Click abre
  // dropdown com lista das variáveis existentes + opção de criar nova.
  const VarPill = (label: string | null, key: string, placeholder = "Selecionar variável") => {
    const valor = d[key] || "";
    const dropdownId = `varpill-${id}-${key}`;
    return (
      <div key={dropdownId}>
        {label && <label style={LS}>{label}</label>}
        <details className="var-pill-dropdown" style={{ position: "relative" }}>
          <summary style={{
            listStyle: "none",
            background: "#1f2937",
            border: "1px solid #374151",
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
                background: "#8b5cf622",
                color: "#a78bfa",
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: "bold",
              }}>{`{{${valor}}}`}</span>
            ) : (
              <span style={{ color: "#6b7280", fontSize: 12 }}>{placeholder}</span>
            )}
            <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>▼</span>
          </summary>
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
            zIndex: 100, maxHeight: 280, overflowY: "auto", padding: 8,
            boxShadow: "0 8px 24px #0008",
          }}>
            {/* Input pra digitar nova variável */}
            <input
              type="text"
              placeholder="Digite ou crie uma variável..."
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
                width: "100%", background: "#111", border: "1px solid #374151",
                borderRadius: 6, padding: "6px 10px", color: "white", fontSize: 12,
                marginBottom: 8, outline: "none",
              }}
            />
            {/* Lista de variáveis existentes */}
            {variaveisDoFluxo.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                Nenhuma variável no fluxo ainda.<br/>Digite acima pra criar a primeira.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {variaveisDoFluxo.map(v => (
                  <button
                    key={v}
                    onClick={() => {
                      u({ [key]: v });
                      // Fecha o details
                      const det = document.getElementById(dropdownId)?.closest("details");
                      det?.removeAttribute("open");
                    }}
                    style={{
                      background: v === valor ? "#8b5cf633" : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#a78bfa",
                      fontSize: 12,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{
                      background: "#8b5cf622",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                    }}>{`{{${v}}}`}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Botão limpar */}
            {valor && (
              <button
                onClick={() => u({ [key]: "" })}
                style={{
                  width: "100%", marginTop: 6, padding: 6, background: "transparent",
                  border: "1px dashed #374151", borderRadius: 6, color: "#6b7280",
                  fontSize: 11, cursor: "pointer",
                }}
              >✕ Limpar</button>
            )}
          </div>
        </details>
      </div>
    );
  };

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // OpSelect — Select de operador estilo Typebot (visual customizado, não nativo).
  // ═══════════════════════════════════════════════════════════════════════
  const OpSelect = (key: string, valor: string, onChange: (v: string) => void) => {
    const opcoes = [
      { value: "igual", label: "Igual a", icone: "=" },
      { value: "diferente", label: "Diferente de", icone: "≠" },
      { value: "contem", label: "Contém", icone: "⊇" },
      { value: "nao_contem", label: "Não contém", icone: "⊉" },
      { value: "comeca_com", label: "Começa com", icone: "▶" },
      { value: "termina_com", label: "Termina com", icone: "◀" },
      { value: ">", label: "Maior que", icone: ">" },
      { value: "<", label: "Menor que", icone: "<" },
      { value: ">=", label: "Maior ou igual", icone: "≥" },
      { value: "<=", label: "Menor ou igual", icone: "≤" },
      { value: "preenchido", label: "Preenchido", icone: "✓" },
      { value: "vazio", label: "Vazio", icone: "∅" },
    ];
    const atual = opcoes.find(o => o.value === valor) || opcoes[0];
    return (
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "#1f2937",
          border: "1px solid #374151",
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

  // 🆕 ═══════════════════════════════════════════════════════════════════════
  // VarSelect — versão LEGACY (autocomplete simples). Mantenho pra blocos pequenos
  // tipo http_request "Salvar status em" que não precisam de UI tão rica.
  // ═══════════════════════════════════════════════════════════════════════
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
          💡 Variáveis no fluxo: {variaveisDoFluxo.slice(0, 5).join(", ")}{variaveisDoFluxo.length > 5 ? "..." : ""}
        </p>
      )}
    </div>
  );

  switch (noSel.tipo) {
    case "texto": return <>{TVar("Mensagem","texto","Digite sua mensagem aqui...",120)}</>;
    case "imagem": return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
    case "video":  return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
    case "audio":  return <>{F("URL do Áudio","url","url","https://...")}</>;
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
        {F("Máximo","max","number","5")}
        {VarPill("Salvar resposta em", "variavel", "ex: avaliacao")}
      </>;
    case "input_pagamento":
      return <>{F("Valor (R$)","valor","number","0")}{F("Descrição","descricao")}</>;
    case "input_botao":
      return <>
        {TVar("Texto","texto","Escolha:",60)}
        <div>
          <label style={LS}>Botões (máx 3, um por linha)</label>
          <textarea
            value={(d.botoes||[]).join("\n")}
            onChange={e => {
              const b = e.target.value.split("\n").filter(Boolean).slice(0,3);
              u({botoes: b});
              setNos(p => p.map(n => n.id===id ? {...n, saidas: b.length ? b : ["Botão 1"]} : n));
            }}
            style={{...IS, height:80, resize:"vertical"}}
            placeholder={"Sim\nNão\nTalvez"}
          />
        </div>
        {VarPill("Salvar resposta em (opcional)", "variavel", "ex: opcao_escolhida")}
      </>;
    case "input_cards":
      return <div>
        <label style={LS}>Cards (Título|Descrição, um por linha)</label>
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
          placeholder={"Produto 1|Descrição\nProduto 2|Outra"}
        />
      </div>;
    case "condicao":
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 10px",lineHeight:1.4}}>
          🔀 SE (todas/alguma) das condições forem verdadeiras → saída <b style={{color:"#16a34a"}}>Verdadeiro</b>, senão → <b style={{color:"#dc2626"}}>Falso</b>
        </p>
        {/* Lógica AND/OR — botões grandes */}
        <label style={LS}>Lógica entre condições</label>
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
                  background: ativo ? "#8b5cf622" : "#1f2937",
                  border: `1px solid ${ativo ? "#8b5cf6" : "#374151"}`,
                  color: ativo ? "#a78bfa" : "white",
                  borderRadius:8, padding:"8px 10px", fontSize:11, cursor:"pointer", fontWeight:"bold",
                  textAlign:"center",
                }}
                title={opt.desc}
              >{opt.label}</button>
            );
          })}
        </div>

        {/* Lista de condições — cada uma com VarPill + OpSelect + valor */}
        <label style={LS}>Condições</label>
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
                  background: "#0d1418",
                  border: "1px solid #1f2937",
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
                          marginLeft: "auto", background: "#dc262622", color: "#dc2626",
                          border: "none", borderRadius: 6, padding: "3px 8px",
                          fontSize: 11, cursor: "pointer", fontWeight: "bold",
                        }}
                      >✕</button>
                    )}
                  </div>
                  {/* Variável (pill) */}
                  <details style={{ position: "relative" }} id={dropdownVarId}>
                    <summary style={{
                      listStyle: "none",
                      background: "#1f2937",
                      border: "1px solid #374151",
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
                        <span style={{ color: "#6b7280", fontSize: 12 }}>Selecionar variável...</span>
                      )}
                      <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>▼</span>
                    </summary>
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                      background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
                      zIndex: 100, maxHeight: 240, overflowY: "auto", padding: 8,
                      boxShadow: "0 8px 24px #0008",
                    }}>
                      <input
                        type="text"
                        placeholder="Digite ou crie variável..."
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
                          width: "100%", background: "#111", border: "1px solid #374151",
                          borderRadius: 6, padding: "6px 10px", color: "white", fontSize: 12,
                          marginBottom: 8, outline: "none",
                        }}
                      />
                      {variaveisDoFluxo.length === 0 ? (
                        <p style={{ color: "#6b7280", fontSize: 11, textAlign: "center", padding: 12, margin: 0 }}>
                          Sem variáveis ainda
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
                          flex: 1, background: "#1f2937", border: "1px solid #374151",
                          borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, outline: "none",
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
              + Adicionar condição
            </button>
          </>;
        })()}
      </>;
    case "variavel": {
      // 🆕 Modo do valor: "texto" (literal), "codigo" (JS), "expressao" (substituição {{var}})
      const modo = d.modo_valor || "texto";
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 10px",lineHeight:1.4}}>
          📝 Cria ou atualiza uma variável. O valor é salvo no banco e fica disponível em todos os blocos seguintes.
        </p>
        {VarPill("Nome da variável", "nome", "Selecionar ou criar variável...")}
        {/* Toggle Text / Code / Expressão */}
        <div>
          <label style={LS}>Tipo do valor</label>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {[
              {key:"texto",label:"📝 Texto",hint:"Valor literal"},
              {key:"expressao",label:"🔗 Expressão",hint:"Usa {{var}}"},
              {key:"codigo",label:"💻 Código",hint:"JavaScript"},
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => u({ modo_valor: opt.key })}
                style={{
                  flex:1,
                  background: modo === opt.key ? "#3b82f622" : "#1f2937",
                  border: `1px solid ${modo === opt.key ? "#3b82f6" : "#374151"}`,
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
            <label style={LS}>Expressão</label>
            <input value={d.valor||""} onChange={e => u({valor: e.target.value})} style={IS} placeholder="{{nome}} - {{cpf_limpo}}" />
            <p style={{color:"#6b7280", fontSize:10, margin:"3px 0 0"}}>
              💡 Use <code style={{color:"#3b82f6"}}>{"{{nome_variavel}}"}</code> pra inserir valores de outras variáveis. Ex: <code>{"Olá {{nome}}"}</code>
            </p>
          </div>
        )}
        {modo === "codigo" && (
          <>
            <div>
              <label style={LS}>Código JavaScript</label>
              <textarea
                value={d.valor||""}
                onChange={e => u({valor: e.target.value})}
                style={{...IS, height:140, resize:"vertical", fontFamily:"monospace", fontSize:11}}
                placeholder={`// Use 'return' pro valor da variável\n// API: getVariable(nome), setVariable(nome,valor), fetch, sleep, log\nconst cep = getVariable("cep").replace(/\\D/g, "");\nreturn cep;`}
              />
            </div>
            {/* Save error in variable (igual Typebot) */}
            {VarPill("Salvar erro em (opcional)", "salvar_erro_em", "Variável pra erro...")}
            <p style={{color:"#6b7280", fontSize:10, margin:"-6px 0 0", lineHeight:1.3}}>
              Se o código der erro, a mensagem fica salva nessa variável. Útil pra blocos de condição depois.
            </p>
          </>
        )}
      </>;
    }
    case "redirecionar": return <>{F("URL","url","url","https://...")}</>;
    case "script":
      return <>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 6px"}}>🆕 API disponível: <code style={{color:"#3b82f6"}}>setVariable(nome, valor)</code>, <code style={{color:"#3b82f6"}}>getVariable(nome)</code>, <code style={{color:"#3b82f6"}}>fetch</code>, <code style={{color:"#3b82f6"}}>sleep(ms)</code>, <code style={{color:"#3b82f6"}}>log(...)</code></p>
        <p style={{color:"#9ca3af",fontSize:11,margin:"0 0 6px"}}>{`{{variaveis}} são substituídas no código antes de executar.`}</p>
        {T("Código JavaScript","codigo",`// Exemplo:\n// const resp = await fetch("https://api.exemplo.com/cep/" + getVariable("cep"))\n// const data = await resp.json()\n// setVariable("rua", data.logradouro)`,200)}
        <p style={{color:"#9ca3af",fontSize:10,margin:"4px 0 0"}}>Saídas: <span style={{color:"#16a34a"}}>0=sucesso</span> / <span style={{color:"#dc2626"}}>1=erro</span></p>
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
        {S("Método","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
        {T("Headers JSON","headers",'{"Authorization":"Bearer token"}',60)}
        {T("Body JSON","body",'{"chave":"valor"}',60)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_api")}
        {VarPill("Salvar status em", "variavel_status", "ex: status_api")}
      </>;
    case "pular": case "retornar":
      return <>{F("ID do nó alvo","alvo","text","ID do bloco destino")}</>;
    case "google_sheets":
      return <>
        <p style={{color:"#f59e0b",fontSize:11,margin:"0 0 6px"}}>⚠️ Em desenvolvimento — ainda não funcional.</p>
        {F("ID da Planilha","spreadsheet_id","text","ID do Google Sheets")}
        {F("Aba","aba","text","Sheet1")}
        {S("Ação","acao",[{value:"append",label:"Adicionar linha"},{value:"update",label:"Atualizar"},{value:"get",label:"Buscar"}])}
        {T("Dados ({{var1}},{{var2}})","dados","{{nome}},{{email}}",60)}
      </>;
    case "http_request":
      return <>
        {F("URL","url","url","https://api.exemplo.com")}
        {S("Método","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
        {T("Headers JSON","headers",'{"Content-Type":"application/json"}',60)}
        {T("Body JSON","body",'{"chave":"{{variavel}}"}',60)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_api")}
        {VarPill("Salvar status em", "variavel_status", "ex: status_api")}
      </>;
    case "openai":
      return <>
        {F("API Key","apiKey","password","sk-...")}
        {S("Modelo","modelo",[{value:"gpt-4o",label:"GPT-4o"},{value:"gpt-4o-mini",label:"GPT-4o Mini"},{value:"gpt-3.5-turbo",label:"GPT-3.5"}])}
        {T("Prompt do sistema","prompt","Você é um assistente...",100)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_ia")}
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,color:"white",fontSize:12}}>
          <input type="checkbox" checked={d.enviar_resposta !== false} onChange={e => u({ enviar_resposta: e.target.checked })} />
          Enviar resposta pro cliente automaticamente
        </label>
      </>;
    case "claude_ai":
      return <>
        {F("API Key","apiKey","password","sk-ant-...")}
        {S("Modelo","modelo",[{value:"claude-opus-4-5",label:"Claude Opus 4.5"},{value:"claude-sonnet-4-20250514",label:"Claude Sonnet 4"},{value:"claude-haiku-4-5",label:"Claude Haiku"}])}
        {T("Prompt do sistema","prompt","Você é um assistente...",100)}
        {VarPill("Salvar resposta em", "variavel_resposta", "ex: resposta_ia")}
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,color:"white",fontSize:12}}>
          <input type="checkbox" checked={d.enviar_resposta !== false} onChange={e => u({ enviar_resposta: e.target.checked })} />
          Enviar resposta pro cliente automaticamente
        </label>
      </>;
    case "gmail":
      return <>
        <p style={{color:"#f59e0b",fontSize:11,margin:"0 0 6px"}}>⚠️ Em desenvolvimento — ainda não funcional.</p>
        {F("Para","para","email","email@exemplo.com")}
        {F("Assunto","assunto","text","Assunto do email")}
        {T("Corpo do email","corpo","Olá {{nome}}...",120)}
      </>;
    case "inicio":    return <>{TVar("Mensagem de boas-vindas","mensagem","Olá! Como posso ajudar?",100)}</>;
    case "comando":   return <>{F("Comando","comando","text","/start")}</>;
    case "reply":
      return <div>
        <label style={LS}>Palavras-chave (separadas por vírgula)</label>
        <input value={d.palavras||""} onChange={e => u({palavras: e.target.value})} style={IS} placeholder="oi, olá, bom dia" />
      </div>;
    case "invalido":  return <>{T("Mensagem para inválido","mensagem","Não entendi...",80)}</>;

    // 🆕 Transferir — agora lista filas do banco (tabela filas do workspace)
    case "transferir":
      return <>
        <div>
          <label style={LS}>Fila de destino</label>
          {filasBanco.length === 0 ? (
            <div style={{background:"#1f1b0a", border:"1px solid #f59e0b44", borderRadius:6, padding:10}}>
              <p style={{color:"#f59e0b", fontSize:11, margin:"0 0 4px", fontWeight:"bold"}}>⚠️ Nenhuma fila cadastrada</p>
              <p style={{color:"#9ca3af", fontSize:10, margin:0, lineHeight:1.4}}>
                Vá em <b>CRM → Configurações → Filas</b> e crie suas filas.<br/>
                Depois volte aqui e selecione a fila de destino.
              </p>
            </div>
          ) : (
            <select value={d.fila||""} onChange={e => u({fila: e.target.value})} style={IS}>
              <option value="">Selecione uma fila...</option>
              {filasBanco.map(f => (
                <option key={f.id} value={f.nome}>📋 {f.nome}{f.conexao ? ` (${f.conexao})` : ""}</option>
              ))}
            </select>
          )}
          <p style={{color:"#6b7280", fontSize:10, margin:"4px 0 0"}}>
            💡 Filas são criadas em <b>Configurações → Filas</b> do CRM
          </p>
        </div>
        {T("Mensagem ao transferir","mensagem","Transferindo...",80)}
      </>;

    case "finalizar": return <>{T("Mensagem de encerramento","mensagem","Obrigado pelo contato!",80)}</>;
    default: return <p style={{color:"#6b7280",fontSize:12}}>Sem propriedades.</p>;
  }
}

function NoCard({ no, sel, scale, onSelect, onOpen, onDelete, onConectarSaida, onConectarEntrada }: {
  no: No; sel: boolean; scale: number;
  onSelect: (id:string) => void;
  onOpen: (id:string) => void; // 🆕 abre modal (separado de selecionar)
  onDelete: (id:string) => void;
  onConectarSaida: (noId:string, idx:number) => void;
  onConectarEntrada: (noId:string) => void;
  onMove: (id:string, x:number, y:number) => void;
}) {
  const cfg = B[no.tipo];
  const divRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const moveu = useRef(false); // 🆕 detecta se houve movimento real (drag) ou só click
  const startPtr = useRef({px:0, py:0, nx:0, ny:0, t:0});

  function onPointerDown(e: React.PointerEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName==="BUTTON"||t.tagName==="INPUT"||t.tagName==="SELECT"||t.tagName==="TEXTAREA") return;
    if (t.closest("button")||t.closest("input")||t.closest("select")||t.closest("textarea")) return;
    e.stopPropagation();
    // 🆕 NÃO seleciona aqui — só prepara o drag. Seleção/abertura acontece no PointerUp.
    dragging.current = true;
    moveu.current = false;
    startPtr.current = {px:e.clientX, py:e.clientY, nx:no.x, ny:no.y, t:Date.now()};
    divRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = (e.clientX - startPtr.current.px) / scale;
    const dy = (e.clientY - startPtr.current.py) / scale;
    // 🆕 Considera "movimento real" se passou de 5px em qualquer direção (tolerância anti-click trêmulo)
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
      // 🆕 Foi DRAG — só atualiza posição, NÃO seleciona/abre modal
      (window as any).__wolfMoveNo?.(no.id, startPtr.current.nx+dx, startPtr.current.ny+dy);
    } else {
      // 🆕 Foi CLICK — só seleciona (destaca, mas NÃO abre modal)
      onSelect(no.id);
    }
  }

  // 🆕 Double click pra abrir o modal de edição
  function onDoubleClickHandler(e: React.MouseEvent) {
    e.stopPropagation();
    onOpen(no.id);
  }

  return (
    <div
      ref={divRef}
      style={{position:"absolute", left:no.x, top:no.y, width:220,
        background:"#111", borderRadius:10,
        border:`2px solid ${sel ? cfg.cor : "#2d2d2d"}`,
        boxShadow: sel ? `0 0 0 3px ${cfg.cor}33,0 4px 20px rgba(0,0,0,.5)` : "0 2px 8px rgba(0,0,0,.4)",
        userSelect:"none", zIndex:sel?10:1, touchAction:"none", cursor: "grab"}}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClickHandler}
      onMouseUp={e => {e.stopPropagation(); onConectarEntrada(no.id);}}
    >
      <div style={{background:cfg.cor, borderRadius:"8px 8px 0 0", padding:"8px 10px",
        display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"grab"}}>
        <div style={{display:"flex", alignItems:"center", gap:6, pointerEvents:"none"}}>
          <span style={{fontSize:13}}>{cfg.icone}</span>
          <span style={{color:"white", fontSize:11, fontWeight:"bold"}}>{cfg.label}</span>
          <span style={{background:"rgba(0,0,0,.2)", color:"rgba(255,255,255,.6)", fontSize:9, padding:"1px 6px", borderRadius:10}}>{cfg.grupo}</span>
        </div>
        {no.tipo!=="inicio" && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {e.stopPropagation(); onDelete(no.id);}}
            style={{background:"none", border:"none", color:"rgba(255,255,255,.7)", cursor:"pointer", fontSize:13, padding:0, lineHeight:1}}>✕</button>
        )}
      </div>
      <div style={{padding:"7px 10px", borderBottom:cfg.saidas.length?"1px solid #1f2937":"none", pointerEvents:"none"}}>
        <p style={{color:"#9ca3af", fontSize:10, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{getPreview(no)}</p>
      </div>
      {no.tipo!=="inicio" && (
        <div
          style={{position:"absolute", left:-7, top:48+18-7, width:14, height:14, borderRadius:"50%",
            background:"#1f2937", border:`2px solid ${cfg.cor}`, cursor:"crosshair", zIndex:5}}
          onPointerDown={e => e.stopPropagation()}
          onMouseUp={e => {e.stopPropagation(); onConectarEntrada(no.id);}}
        />
      )}
      {no.saidas.map((saida,idx) => (
        <div key={idx} style={{display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 10px", height:36, borderTop:idx>0?"1px solid #1a1a1a":"none"}}>
          <span style={{color:"#6b7280", fontSize:10, pointerEvents:"none"}}>{saida}</span>
          <div
            style={{width:14, height:14, borderRadius:"50%", background:cfg.cor, cursor:"crosshair",
              flexShrink:0, position:"relative", right:-18, border:"2px solid #111"}}
            onPointerDown={e => {e.stopPropagation(); onConectarSaida(no.id,idx);}}
          />
        </div>
      ))}
    </div>
  );
}

export default function FluxosPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ✅ Agora é username (string como "wolf_admin"), nunca id numérico
  const [wsId,setWsId]             = useState<string|null>(null);
  const [fluxos,setFluxos]         = useState<Fluxo[]>([]);
  const [filasBanco,setFilasBanco] = useState<FilaItem[]>([]); // 🆕
  const [view,setView]             = useState<"lista"|"editor">("lista");
  const [fluxoAtivo,setFluxoAtivo] = useState<Fluxo|null>(null);
  const [nos,setNos]               = useState<No[]>([]);
  const [arestas,setArestas]       = useState<Aresta[]>([]);
  const [noSel,setNoSel]           = useState<No|null>(null);
  // 🆕 noEditando = qual nó tá com modal aberto. Separado de noSel pra permitir
  //    drag/seleção sem abrir modal automaticamente. Modal só abre em DOUBLE click.
  const [noEditando, setNoEditando] = useState<No|null>(null);
  const [salvando,setSalvando]     = useState(false);
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

  // ✅ Carrega username + fluxos iniciais + Realtime + polling 5s
  useEffect(() => {
    let cancelled = false;
    getWsUsername().then(username => {
      if (cancelled || !username) return;
      setWsId(username);
      load(username);
      fetchFilas(username); // 🆕

      // 🔒 MULTI-TENANT: Realtime AGORA filtra por workspace_id no servidor.
      // Antes recebia eventos de fluxos/filas de TODOS workspaces — vazamento de
      // metadados (nomes de fluxos, IDs, status ativo/inativo) entre contas.
      // O filter precisa ser registrado depois que sabemos o username, por isso
      // movido pra dentro do .then() do getWsUsername.
      const ch = supabase.channel("fluxos_editor_rt_" + username)
        .on("postgres_changes", { event: "*", schema: "public", table: "fluxos", filter: `workspace_id=eq.${username}` }, () => {
          if (!cancelled) load(username);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "filas", filter: `workspace_id=eq.${username}` }, () => { // 🆕
          if (!cancelled) fetchFilas(username);
        })
        .subscribe();

      // Guarda a referência do channel pra cleanup
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

  // ✅ Busca fluxos filtrando por username
  async function load(username?: string) {
    const u = username || wsId;
    if (!u) return;
    const {data} = await supabase.from("fluxos").select("*").eq("workspace_id", u).order("created_at",{ascending:false});
    setFluxos((data||[]).map(f=>({...f,nos:f.nos||[],conexoes:f.conexoes||[]})));
  }

  // 🆕 Busca filas cadastradas em Configurações → Filas do CRM
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

  async function criarFluxo() {
    if(!form.nome.trim()){alert("Digite o nome!");return;}
    setCriando(true);
    try {
      const username = wsId || await getWsUsername();
      if(!username){alert("Workspace não encontrado! Faça login novamente.");return;}
      const ini:No = {id:uid(),tipo:"inicio",x:200,y:200,dados:defaultD("inicio"),saidas:[...B.inicio.saidas]};
      const payload = {nome:form.nome.trim(),descricao:form.descricao,ativo:false,
        trigger_tipo:form.trigger_tipo,trigger_valor:form.trigger_valor,
        nos:[ini],conexoes:[],workspace_id:username};
      const {data,error} = await supabase.from("fluxos").insert([payload]).select().single();
      if(error){alert("Erro: "+error.message);return;}
      setWsId(username); await load(username); await fetchFilas(username);
      abrirEditor({...payload, id:data.id} as Fluxo);
      setShowNovo(false);
      setForm({nome:"",descricao:"",trigger_tipo:"qualquer_mensagem",trigger_valor:""});
    } finally { setCriando(false); }
  }

  function abrirEditor(f:Fluxo) {
    setFluxoAtivo(f); setNos(f.nos||[]); setArestas(f.conexoes||[]); setNoSel(null); setNoEditando(null); setView("editor");
    fetchFilas(); // 🆕 recarrega filas ao abrir o editor
  }

  async function salvar() {
    if(!fluxoAtivo?.id) return;
    if(!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    // 🆕 Validação: avisa se algum nó transferir não tem fila selecionada
    const transferirSemFila = nos.filter(n => n.tipo === "transferir" && !n.dados?.fila);
    if (transferirSemFila.length > 0) {
      if (!confirm(`⚠️ ${transferirSemFila.length} nó(s) de Transferir estão sem fila selecionada.\n\nQuando executados vão usar "Fila Principal" como fallback. Deseja salvar assim mesmo?`)) return;
    }
    setSalvando(true);
    // 🔒 MULTI-TENANT: defesa em profundidade — só salva se fluxo for deste workspace
    await supabase.from("fluxos").update({nos,conexoes:arestas,nome:fluxoAtivo.nome,
      descricao:fluxoAtivo.descricao,ativo:fluxoAtivo.ativo,
      trigger_tipo:fluxoAtivo.trigger_tipo,trigger_valor:fluxoAtivo.trigger_valor})
      .eq("id",fluxoAtivo.id)
      .eq("workspace_id", wsId);
    await load(); setSalvando(false); alert("✅ Fluxo salvo!");
  }

  async function toggleAtivo() {
    if(!fluxoAtivo?.id) return;
    if(!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    const v = !fluxoAtivo.ativo;
    // 🔒 MULTI-TENANT: defesa em profundidade — só togglea se fluxo for deste workspace
    await supabase.from("fluxos").update({ativo:v})
      .eq("id",fluxoAtivo.id)
      .eq("workspace_id", wsId);
    setFluxoAtivo(p => p?{...p,ativo:v}:null); await load();
  }

  // ✅ Exclusão real — verifica se deu certo e limpa sessão se estava aberta
  async function excluirFluxo(id:number, nome:string) {
    if(!confirm(`Excluir o fluxo "${nome}" permanentemente?\nIsso não pode ser desfeito.`)) return;
    if(!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }

    // 🔒 MULTI-TENANT: confere que o fluxo realmente pertence a este workspace ANTES de mexer.
    // Antes, qualquer user com o id do fluxo (descoberto via DevTools, console, etc) podia
    // deletar fluxos de outros workspaces.
    const fluxo = fluxos.find(f => f.id === id);
    if (!fluxo || fluxo.workspace_id !== wsId) {
      alert("Erro: fluxo não pertence a este workspace.");
      return;
    }

    // Também apaga as sessões em execução desse fluxo (pra não ficar lixo).
    // Não precisa filtrar por workspace_id aqui: como já confirmamos acima que `fluxo` pertence
    // a este workspace, `id` é uma chave globalmente única e podemos confiar nele.
    await supabase.from("fluxo_sessoes").delete().eq("fluxo_id", id);

    // 🔒 MULTI-TENANT CRÍTICO: delete do fluxo agora exige id E workspace_id baterem
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
    if(nos.find(n=>n.id===id)?.tipo==="inicio"){alert("Não pode excluir o início!");return;}
    setNos(p => p.filter(n=>n.id!==id));
    setArestas(p => p.filter(a=>a.de!==id&&a.para!==id));
    if(noSel?.id===id) setNoSel(null);
    if(noEditando?.id===id) setNoEditando(null);
  }

  function updateNo(id:string, d:Record<string,any>) {
    setNos(p => p.map(n => n.id===id ? {...n,dados:{...n.dados,...d}} : n));
    setNoSel(p => p?.id===id ? {...p,dados:{...p.dados,...d}} : p);
    setNoEditando(p => p?.id===id ? {...p,dados:{...p.dados,...d}} : p);
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
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#0a0a0a",color:"white"}}>
      <div style={{width:220,background:"#111",borderRight:"1px solid #1f2937",display:"flex",flexDirection:"column",padding:16,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <img src="/logo1.png" alt="Wolf" style={{width:32,filter:"brightness(0) invert(1)"}}/>
          <span style={{color:"white",fontWeight:"bold",fontSize:14}}>Wolf Chatbot</span>
        </div>
        <button onClick={()=>router.push("/chatbot")} style={{background:"#3b82f622",border:"1px solid #3b82f633",borderRadius:8,padding:"10px 14px",color:"#3b82f6",fontSize:13,fontWeight:"bold",cursor:"pointer",textAlign:"left"}}>💬 Conversas</button>
        <button style={{background:"#8b5cf622",border:"1px solid #8b5cf633",borderRadius:8,padding:"10px 14px",color:"#8b5cf6",fontSize:13,fontWeight:"bold",cursor:"pointer",textAlign:"left"}}>🤖 Fluxos</button>
        <button onClick={()=>router.push("/crm")} style={{background:"none",border:"none",borderRadius:8,padding:"10px 14px",color:"#6b7280",fontSize:13,cursor:"pointer",textAlign:"left",marginTop:"auto"}}>← CRM</button>
      </div>
      <div style={{flex:1,padding:32,overflowY:"auto"}}>
        {showNovo && (
          <div style={{position:"fixed",inset:0,background:"#000c",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#111",borderRadius:16,padding:32,width:500,border:"1px solid #1f2937",display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <h2 style={{color:"white",fontSize:18,fontWeight:"bold",margin:0}}>➕ Novo Fluxo</h2>
                <button onClick={()=>setShowNovo(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:22,cursor:"pointer"}}>✕</button>
              </div>
              <div><label style={{...LS,fontSize:11}}>Nome *</label>
                <input autoFocus placeholder="Ex: Fluxo de Vendas" value={form.nome}
                  onChange={e=>setForm({...form,nome:e.target.value})}
                  onKeyDown={e=>e.key==="Enter"&&criarFluxo()}
                  style={{...IS,fontSize:14,padding:"10px 14px",background:"#1f2937"}}/>
              </div>
              <div><label style={{...LS,fontSize:11}}>Descrição</label>
                <input placeholder="Objetivo" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} style={{...IS,background:"#1f2937"}}/>
              </div>
              <div><label style={{...LS,fontSize:11}}>Quando Ativar</label>
                <select value={form.trigger_tipo} onChange={e=>setForm({...form,trigger_tipo:e.target.value})} style={{...IS,background:"#1f2937"}}>
                  <option value="qualquer_mensagem">Qualquer mensagem</option>
                  <option value="palavra_chave">Palavra-chave</option>
                  <option value="primeiro_contato">Primeiro contato</option>
                  <option value="fora_horario">Fora do horário</option>
                </select>
              </div>
              {form.trigger_tipo==="palavra_chave" && (
                <div><label style={{...LS,fontSize:11}}>Palavra-chave</label>
                  <input placeholder="oi, olá" value={form.trigger_valor} onChange={e=>setForm({...form,trigger_valor:e.target.value})} style={{...IS,background:"#1f2937"}}/>
                </div>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowNovo(false)} style={{background:"none",color:"#9ca3af",border:"1px solid #374151",borderRadius:8,padding:"10px 20px",fontSize:13,cursor:"pointer"}}>Cancelar</button>
                <button onClick={criarFluxo} disabled={criando} style={{background:criando?"#6b21a8":"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,cursor:criando?"wait":"pointer",fontWeight:"bold"}}>
                  {criando?"⏳ Criando...":"🤖 Criar Fluxo"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h1 style={{color:"white",fontSize:22,fontWeight:"bold",margin:0}}>🤖 Meus Fluxos</h1>
            <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{fluxos.length} fluxo(s)</p>
          </div>
          <button onClick={()=>setShowNovo(true)} style={{background:"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,cursor:"pointer",fontWeight:"bold"}}>+ Novo Fluxo</button>
        </div>
        {fluxos.length===0 ? (
          <div style={{background:"#111",borderRadius:12,padding:64,textAlign:"center",border:"1px solid #1f2937"}}>
            <p style={{fontSize:64,margin:"0 0 16px"}}>🤖</p>
            <h3 style={{color:"white",fontSize:18,fontWeight:"bold",margin:"0 0 8px"}}>Nenhum fluxo criado</h3>
            <p style={{color:"#6b7280",fontSize:14,margin:"0 0 24px"}}>Crie fluxos de atendimento automático</p>
            <button onClick={()=>setShowNovo(true)} style={{background:"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"12px 28px",fontSize:14,cursor:"pointer",fontWeight:"bold"}}>+ Criar Primeiro Fluxo</button>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {fluxos.map(f => (
              <div key={f.id} style={{background:"#111",borderRadius:12,padding:24,border:`1px solid ${f.ativo?"#8b5cf644":"#1f2937"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <h3 style={{color:"white",fontSize:15,fontWeight:"bold",margin:0}}>{f.nome}</h3>
                    {f.descricao&&<p style={{color:"#6b7280",fontSize:12,margin:"4px 0 0"}}>{f.descricao}</p>}
                  </div>
                  <span style={{background:f.ativo?"#8b5cf622":"#1f2937",color:f.ativo?"#8b5cf6":"#6b7280",fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:"bold",whiteSpace:"nowrap"}}>
                    {f.ativo?"🟢 Ativo":"⚫ Inativo"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <span style={{background:"#1f2937",color:"#9ca3af",fontSize:11,padding:"3px 8px",borderRadius:6}}>{f.nos?.length||0} blocos</span>
                  <span style={{background:"#1f2937",color:"#9ca3af",fontSize:11,padding:"3px 8px",borderRadius:6}}>
                    {f.trigger_tipo==="qualquer_mensagem"?"📨 Qualquer":f.trigger_tipo==="palavra_chave"?`🔑 "${f.trigger_valor}"`:f.trigger_tipo==="primeiro_contato"?"👋 1º":"🕐 Fora horário"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>abrirEditor(f)} style={{flex:1,background:"#8b5cf622",color:"#8b5cf6",border:"1px solid #8b5cf633",borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",fontWeight:"bold"}}>✏️ Editar</button>
                  <button onClick={()=>excluirFluxo(f.id!, f.nome)} style={{background:"#dc262622",color:"#dc2626",border:"1px solid #dc262633",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#0a0a0a",color:"white",overflow:"hidden"}}>

      <div style={{width:210,background:"#111",borderRight:"1px solid #1f2937",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setView("lista")} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer",padding:0}}>←</button>
          <h3 style={{color:"white",fontSize:12,fontWeight:"bold",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{fluxoAtivo?.nome}</h3>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {GRUPOS.map(grupo => {
            const tipos = (Object.entries(B) as [TipoNo,BC][]).filter(([,c])=>c.grupo===grupo);
            const ab = grupoAberto===grupo;
            return (
              <div key={grupo}>
                <button onClick={()=>setGrupoAberto(ab?"":grupo)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"7px 14px",background:"none",border:"none",cursor:"pointer",color:ab?"#8b5cf6":"#9ca3af",fontSize:11,fontWeight:"bold",textTransform:"uppercase",letterSpacing:1}}>
                  <span>{grupo}</span><span style={{fontSize:9}}>{ab?"▼":"▶"}</span>
                </button>
                {ab && (
                  <div style={{padding:"2px 8px 8px"}}>
                    {tipos.map(([tipo,cfg]) => (
                      <button key={tipo} onClick={()=>adicionarNo(tipo)}
                        style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:"#1a1a1a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 10px",color:"white",fontSize:11,cursor:"pointer",marginBottom:3,textAlign:"left"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#1f2937")}
                        onMouseLeave={e=>(e.currentTarget.style.background="#1a1a1a")}>
                        <span style={{fontSize:14,width:20,textAlign:"center"}}>{cfg.icone}</span>
                        <span style={{flex:1}}>{cfg.label}</span>
                        <span style={{width:8,height:8,borderRadius:"50%",background:cfg.cor,flexShrink:0}}/>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{padding:10,borderTop:"1px solid #1f2937"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1a1a1a",borderRadius:8,padding:"7px 10px",marginBottom:8}}>
            <span style={{color:fluxoAtivo?.ativo?"#8b5cf6":"#6b7280",fontSize:11,fontWeight:"bold"}}>{fluxoAtivo?.ativo?"🟢 Ativo":"⚫ Inativo"}</span>
            <button onClick={toggleAtivo} style={{width:34,height:18,background:fluxoAtivo?.ativo?"#8b5cf6":"#374151",borderRadius:9,cursor:"pointer",border:"none",position:"relative"}}>
              <div style={{width:12,height:12,background:"white",borderRadius:"50%",position:"absolute",top:3,left:fluxoAtivo?.ativo?19:3,transition:"left 0.2s"}}/>
            </button>
          </div>
          <button onClick={salvar} disabled={salvando} style={{width:"100%",background:salvando?"#6b21a8":"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"9px",fontSize:12,cursor:"pointer",fontWeight:"bold"}}>
            {salvando?"Salvando...":"💾 Salvar Fluxo"}
          </button>
        </div>
      </div>

      <div ref={canvasRef}
        style={{flex:1,position:"relative",overflow:"hidden",cursor:panning.current?"grabbing":conectando?"crosshair":"default",touchAction:"none"}}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onWheel={onWheel}
        onClick={()=>setNoSel(null)}
      >
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          <defs>
            <pattern id="dots" width={24*scale} height={24*scale} patternUnits="userSpaceOnUse" x={offset.x%(24*scale)} y={offset.y%(24*scale)}>
              <circle cx={1} cy={1} r={0.8} fill="#1f2937"/>
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
          <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 12px"}}>
            <p style={{color:"#6b7280",fontSize:10,margin:0}}>🖱️ Arraste blocos • Scroll zoom • ● conectar • Clique na linha para excluir</p>
          </div>
          <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 10px",display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{const s=Math.min(scaleRef.current*1.2,2.5);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>+</button>
            <span style={{color:"#6b7280",fontSize:10}}>{Math.round(scale*100)}%</span>
            <button onClick={()=>{const s=Math.max(scaleRef.current*0.8,0.2);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>−</button>
            <button onClick={()=>{scaleRef.current=1;offsetRef.current={x:80,y:80};setScale(1);setOffset({x:80,y:80});}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10}}>Reset</button>
          </div>
        </div>
        <div style={{position:"absolute",top:16,right:noSel?285:16,background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 12px"}}>
          <p style={{color:"#6b7280",fontSize:10,margin:0}}>{nos.length} blocos • {arestas.length} conexões</p>
        </div>
      </div>

      {/* 🆕 MODAL CENTRALIZADO de edição (em vez de sidebar lateral).
          Vantagens: muito mais espaço pros campos, não some informação, foco total no bloco.
          Desvantagem: canvas fica escurecido atrás (mas dá pra fechar e voltar rápido). */}
      {noEditando && (
        <div
          onClick={() => setNoEditando(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000cc",
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
              background: "#111",
              borderRadius: 12,
              border: "1px solid #1f2937",
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
              borderBottom: "1px solid #1f2937",
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
                  <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{B[noEditando.tipo]?.label}</h3>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{B[noEditando.tipo]?.grupo}</p>
                </div>
              </div>
              <button
                onClick={() => setNoEditando(null)}
                style={{
                  background: "#1f2937",
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
              >✕</button>
            </div>

            {/* Conteúdo (scrollável). overflowX visible permite que o dropdown ＋Variável
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
                nos={nos}
              />
            </div>

            {/* Footer com ações */}
            {noEditando.tipo !== "inicio" && (
              <div style={{
                padding: "12px 18px",
                borderTop: "1px solid #1f2937",
                display: "flex",
                gap: 8,
                flexShrink: 0,
              }}>
                <button
                  onClick={() => { excluirNo(noEditando.id); setNoEditando(null); }}
                  style={{
                    background: "#dc262611",
                    color: "#dc2626",
                    border: "1px solid #dc262633",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >🗑️ Excluir bloco</button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setNoEditando(null)}
                  style={{
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >✓ Concluir</button>
              </div>
            )}
            {/* Pro nó "inicio" só botão de concluir */}
            {noEditando.tipo === "inicio" && (
              <div style={{
                padding: "12px 18px",
                borderTop: "1px solid #1f2937",
                display: "flex",
                justifyContent: "flex-end",
                flexShrink: 0,
              }}>
                <button
                  onClick={() => setNoEditando(null)}
                  style={{
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >✓ Concluir</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}