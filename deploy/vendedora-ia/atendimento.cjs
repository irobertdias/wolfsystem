'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Vendedora IA genérica (integracao "vendedora_ia") — configurada só pela tela.
//  • Catálogo: lista manual, planilha do Google (link) ou API (URL que devolve JSON)
//  • Coleta os dados configurados, confirma o resumo e registra o pedido/lead
//  • Ao registrar: aviso no WhatsApp do dono, webhook externo, planilha (Apps Script)
//    e, se a saída do bloco estiver ligada, segue para os próximos blocos (CRM etc.)
//  • Responde em português, inglês ou espanhol, conforme o cliente escreve
// ═══════════════════════════════════════════════════════════════════════
const fs = require('node:fs'), path = require('node:path');
const KEY = '__vendedora_ia';
const ler = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v || {}; } catch { return {}; } };
const so = (v) => String(v || '').replace(/\D/g, '');
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LANG = { type: 'string', enum: ['pt', 'en', 'es'], description: 'idioma em que o cliente está escrevendo' };

// ---------- catálogo ----------
function csv(texto) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',' || c === ';' && !texto.slice(0, 500).includes(',')) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => String(x).trim()));
}
const COLUNAS = {
  id: ['id', 'codigo', 'cod', 'sku', 'ref', 'referencia'], nome: ['nome', 'produto', 'servico', 'item', 'titulo', 'plano', 'name', 'product', 'title'],
  preco: ['preco', 'valor', 'price', 'preco_venda', 'valor_venda'], descricao: ['descricao', 'detalhes', 'description', 'obs', 'observacao', 'caracteristicas'],
  link: ['link', 'url', 'link_pagamento', 'pagamento', 'checkout'], imagem: ['imagem', 'foto', 'image', 'img', 'imagem_url', 'foto_url'],
  estoque: ['estoque', 'qtd', 'quantidade', 'stock', 'disponivel'], categoria: ['categoria', 'tipo', 'category', 'grupo'],
};
function normalizarItem(o, i) {
  const chaves = Object.keys(o || {});
  const pega = (k) => { const c = chaves.find((x) => COLUNAS[k].includes(sem(x).replace(/[^a-z_]/g, ''))); return c ? o[c] : undefined; };
  const nome = String(pega('nome') ?? '').trim();
  if (!nome) return null;
  const precoBruto = pega('preco');
  const preco = typeof precoBruto === 'number' ? precoBruto : Number(String(precoBruto ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const extras = {}; for (const c of chaves) if (!Object.values(COLUNAS).flat().includes(sem(c).replace(/[^a-z_]/g, ''))) extras[c] = o[c];
  return { id: String(pega('id') ?? i + 1), nome, preco: Number.isFinite(preco) ? preco : null, descricao: String(pega('descricao') ?? '').slice(0, 600), link: String(pega('link') ?? '').trim(), imagem: String(pega('imagem') ?? '').trim(), estoque: pega('estoque') ?? null, categoria: String(pega('categoria') ?? ''), ...(Object.keys(extras).length ? { extras } : {}) };
}
function urlPlanilha(u) {
  const s = String(u || '').trim();
  const m = s.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (m && !/output=csv|format=csv/.test(s)) { const gid = (s.match(/[#&?]gid=(\d+)/) || [])[1] || '0'; return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`; }
  return s;
}
const CACHE = new Map();
async function carregarCatalogo(n) {
  const fonte = n.catalogo_fonte || 'manual';
  if (fonte === 'manual' || fonte === 'nenhum') return (n.catalogo || []).map(normalizarItem).filter(Boolean);
  const url = fonte === 'planilha' ? urlPlanilha(n.planilha_url) : String(n.api_url || '').trim();
  if (!/^https:\/\//.test(url)) throw Error(fonte === 'planilha' ? 'link da planilha não configurado' : 'URL da API não configurada');
  const c = CACHE.get(url); if (c && Date.now() - c.em < 3 * 60_000) return c.itens;
  const headers = {}; for (const l of String(n.api_headers || '').split('\n')) { const i = l.indexOf(':'); if (i > 0) headers[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error(`catálogo respondeu ${r.status}${fonte === 'planilha' ? ' (a planilha precisa estar compartilhada como "qualquer pessoa com o link")' : ''}`);
  let itens;
  if (fonte === 'planilha') {
    const t = await r.text();
    if (/<html/i.test(t.slice(0, 200))) throw Error('a planilha não está pública: compartilhe como "qualquer pessoa com o link pode ver"');
    const [cab, ...linhas] = csv(t);
    itens = linhas.map((l, i) => normalizarItem(Object.fromEntries(cab.map((h, k) => [h, l[k] ?? ''])), i)).filter(Boolean);
  } else {
    let j = await r.json(); if (!Array.isArray(j)) j = j?.produtos || j?.items || j?.itens || j?.data || j?.results || j?.ofertas || [];
    itens = (Array.isArray(j) ? j : []).map(normalizarItem).filter(Boolean);
  }
  CACHE.set(url, { em: Date.now(), itens });
  return itens;
}
function buscar(itens, busca) {
  const termos = sem(busca).split(/\s+/).filter((t) => t.length > 1);
  if (!termos.length) return itens.slice(0, 15);
  return itens.map((p) => { const alvo = sem(`${p.nome} ${p.categoria} ${p.descricao} ${p.id}`); return { p, n: termos.reduce((s, t) => s + (alvo.includes(t) ? (sem(p.nome).includes(t) ? 2 : 1) : 0), 0) }; })
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 10).map((x) => x.p);
}

// ---------- validação dos dados ----------
function validarCampo(c, v) {
  const t = String(v ?? '').trim(); if (!t) return 'vazio';
  if (c.tipo === 'cpf' && so(t).length !== 11 && so(t).length !== 14) return 'CPF/CNPJ inválido';
  if (c.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'e-mail inválido';
  if (c.tipo === 'telefone' && so(t).length < 10) return 'telefone com DDD inválido';
  if (c.tipo === 'numero' && !Number.isFinite(Number(t.replace(',', '.')))) return 'número inválido';
  return null;
}
function detectarIdioma(texto) {
  const t = ' ' + sem(texto).replace(/[^a-zñ¿¡\s]/g, ' ') + ' ';
  const conta = (l) => l.reduce((n, w) => n + (t.includes(' ' + w + ' ') ? 1 : 0), 0);
  const en = conta(['hello', 'hi', 'the', 'want', 'my', 'how', 'buy', 'please', 'thanks', 'what', 'you', 'i', 'price', 'much', 'do', 'have']);
  const es = conta(['hola', 'quiero', 'cuanto', 'gracias', 'por', 'favor', 'tengo', 'usted', 'necesito', 'precio', 'buenas', 'tienen', 'como']);
  const pt = conta(['oi', 'ola', 'quero', 'voce', 'obrigado', 'tenho', 'minha', 'meu', 'preciso', 'quanto', 'nao', 'boa', 'tarde', 'dia', 'sim', 'vcs', 'tem', 'gostaria']);
  const m = Math.max(en, es, pt); if (m < 1) return null;
  if (en === m && en > es && en > pt) return 'en'; if (es === m && es > pt && es > en) return 'es'; if (pt === m && pt > en && pt > es) return 'pt'; return null;
}

/** A última fala da IA foi um resumo pedindo confirmação? (então o "sim" do cliente vale) */
function pediuConfirmacao(s) {
  const ultima = [...(s.historico || [])].reverse().find((m) => m.role === 'assistant')?.content || '';
  return /\?/.test(ultima) && /(confirm|tudo certo|est[aá] (tudo )?certo|correto|posso (registrar|fechar|finalizar)|podemos fechar|is everything (correct|right)|is that correct|shall i|todo (est[aá] )?bien|correcto|lo confirmo)/i.test(sem(ultima));
}

// ---------- ferramentas ----------
const FERRAMENTAS = [
  { name: 'buscar_catalogo', description: 'Procura produtos/serviços/planos no catálogo da empresa (nome, preço, descrição, link, estoque). Use SEMPRE antes de falar de preço, disponibilidade ou opções. Busca vazia lista os principais.', parameters: { type: 'object', properties: { busca: { type: 'string', description: 'termos curtos, ex.: "camiseta preta", "limpeza de pele", "plano 500mb"' } }, required: ['busca'] } },
  { name: 'enviar_foto', description: 'Envia ao cliente a foto de um item do catálogo que tenha imagem. Use quando ajudar a decidir (roupas, imóveis, carros, comida...). No máximo 3 por resposta.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'salvar_dados', description: 'Guarda os dados do cliente que ele já informou (nome, CPF, endereço, data desejada...). Use os nomes de variável da lista DADOS A COLETAR. Chame sempre que o cliente informar algum desses dados, mesmo sem você ter perguntado.', parameters: { type: 'object', properties: { dados: { type: 'object', additionalProperties: { type: 'string' }, description: '{ "variavel": "valor" }' } }, required: ['dados'] } },
  { name: 'registrar_pedido', description: 'Registra o pedido / agendamento / solicitação depois que o cliente CONFIRMOU o resumo e os dados obrigatórios estão salvos. Avisa a empresa e devolve os próximos passos (ex.: link de pagamento).', parameters: { type: 'object', properties: {
    itens: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, qtd: { type: 'number' }, preco: { type: 'number' } }, required: ['nome'] } },
    total: { type: 'number', description: 'em reais, se houver' }, resumo: { type: 'string', description: 'resumo curto do que foi combinado' }, idioma: LANG,
  }, required: ['resumo', 'idioma'] } },
  { name: 'chamar_humano', description: 'Passa a conversa para um atendente: o cliente pediu uma pessoa, reclamação, negociação/desconto fora das regras, assunto que você não sabe responder com as informações que tem.', parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
  { name: 'encerrar', description: 'Encerra quando o cliente se despedir, disser que não quer mais nada, ou for curioso/spam insistente.', parameters: { type: 'object', properties: { motivo: { type: 'string' } } } },
].map((f) => ({ type: 'function', function: f }));

function instrucoes(a, n, s, catalogoInfo) {
  const coleta = (n.coleta || []).filter((c) => c.variavel);
  const L = [
    `Você é ${a.nome || 'a assistente virtual'}, atendente virtual de ${a.papel === 'atendimento' ? 'atendimento' : a.papel === 'agendamento' ? 'agendamento' : 'vendas'} da *${a.empresa || 'empresa'}* no WhatsApp${n.nicho_nome ? ` (ramo: ${n.nicho_nome})` : ''}.`,
    `Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}.`,
    n.objetivo ? `OBJETIVO: ${n.objetivo}` : '',
    '',
    'COMO CONVERSAR',
    `- Tom ${a.tom === 'formal' ? 'formal e educado' : a.tom === 'consultivo' ? 'consultivo, de especialista' : 'acolhedor, simpático e objetivo'}. Mensagens curtas de WhatsApp (até ~5 linhas por bloco), negrito com *asteriscos*, poucos emojis, UMA pergunta por vez. Links puros, sem markdown.`,
    '- Primeira resposta: apresente-se em uma linha e já ajude no que o cliente pediu. Nunca mande menu numerado ou lista de opções enorme.',
    a.apresentacao ? `- Apresentação sugerida pela empresa: "${a.apresentacao}"` : '',
    '- Responda no idioma em que o cliente escreve (português, inglês ou espanhol). Textos colados/prints não mudam o idioma da conversa.',
    '- Se perguntarem se é robô, diga que é a assistente virtual e ofereça chamar um atendente.',
    '- Nunca diga "vou verificar/vou mandar" e pare: use a ferramenta na mesma resposta e já responda com o resultado.',
    '',
    'COMO VENDER',
    '- Entenda o que o cliente precisa (no máximo 1 ou 2 perguntas) e MOSTRE opções reais do catálogo (buscar_catalogo): 1 a 3 itens com nome, preço e 1 linha de por que serve para ele. Recomende um.',
    '- Responda dúvidas com as informações da empresa abaixo. Trate objeções com argumentos reais (benefícios, garantia, condições informadas). Não invente.',
    '- Quando o cliente decidir, colete os dados da lista DADOS A COLETAR, um por vez, aproveitando o que ele já disse (salvar_dados). Depois mande o resumo e peça confirmação. Confirmado: registrar_pedido.',
    '- Se um dado da lista não se aplica ao item escolhido (ex.: cor de um produto que não tem opções de cor na descrição), salve "padrão" e siga, sem perguntar. NUNCA invente opções (cores, tamanhos, sabores, horários) que não estejam na descrição do item ou nas informações da empresa.',
    '- Depois de registrar, passe os próximos passos que a ferramenta devolver (link de pagamento, agendamento, prazo). Nunca diga que o pagamento foi aprovado.',
    '- Preço, estoque, horários, prazos e condições SÓ do catálogo e das informações da empresa. Se não estiver lá, diga que vai confirmar com a equipe (chamar_humano se o cliente precisar disso para decidir).',
    '- Curiosos, spam ou quem não tem interesse real: respostas curtas; se insistir sem objetivo, despeça-se e chame encerrar.',
    '',
    `CATÁLOGO: ${catalogoInfo}`,
    coleta.length ? `DADOS A COLETAR (variável → o que é${coleta.some((c) => c.obrigatorio !== false) ? '; * = obrigatório para registrar' : ''}):\n${coleta.map((c) => `- ${c.variavel}${c.obrigatorio !== false ? '*' : ''} → ${c.rotulo || c.variavel}${c.pergunta ? ` (pergunta sugerida: "${c.pergunta}")` : ''}${c.tipo && c.tipo !== 'texto' ? ` [${c.tipo}]` : ''}`).join('\n')}` : 'DADOS A COLETAR: nome do cliente (salve em "nome").',
    n.link_pagamento ? `LINK DE PAGAMENTO GERAL (use se o item não tiver link próprio): ${n.link_pagamento}` : '',
    n.formas_pagamento ? `FORMAS DE PAGAMENTO: ${n.formas_pagamento}` : '',
    n.link_agendamento ? `LINK DE AGENDAMENTO: ${n.link_agendamento} (mande quando o cliente quiser marcar horário)` : '',
    n.empresa_info ? `\nSOBRE A EMPRESA (endereço, horários, entrega, garantias, políticas):\n${n.empresa_info}` : '',
    n.faq ? `\nPERGUNTAS FREQUENTES:\n${n.faq}` : '',
    n.dicas ? `\nDICAS DO RAMO:\n${n.dicas}` : '',
    a.regras ? `\nREGRAS DA EMPRESA:\n${a.regras}` : '',
    n.regras ? `\nREGRAS DESTE ATENDIMENTO:\n${n.regras}` : '',
    n.prompt ? `\nINSTRUÇÕES EXTRAS:\n${n.prompt}` : '',
  ];
  return L.filter((x) => x !== '').join('\n');
}

async function chamarIA({ apiKey, modelo, mensagens }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, messages: mensagens, tools: FERRAMENTAS, temperature: 0.5 }),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'OpenAI ' + r.status), { status: r.status, codigo: j?.error?.code });
  return j.choices[0].message;
}

module.exports = function criar({ ctx, log }) {
  /** Manda texto para um número pelo mesmo canal (avisos ao dono). */
  async function enviarPara(meta, numero, texto) {
    const cfg = await ctx.getConfigCanal?.(meta.canalId).catch(() => null);
    if (cfg?.tipo === 'waba' && typeof ctx.enviarMensagemWaba === 'function') return ctx.enviarMensagemWaba(cfg, so(numero), texto);
    const s = ctx.sessoes?.[String(meta.canalId)];
    if (!s?.client || s.status !== 'conectado') throw Error('canal desconectado');
    return require('../bko-roteamento.js').enviar(s.client, so(numero), texto);
  }
  async function enviarFoto(meta, url, legenda) {
    const s = ctx.sessoes?.[String(meta.canalId)];
    if (!s?.client || s.status !== 'conectado' || !ctx.MessageMedia) throw Error('envio de foto só no WhatsApp Web');
    const media = await ctx.MessageMedia.fromUrl(url, { unsafeMime: true });
    return require('../bko-roteamento.js').enviar(s.client, so(meta.numero), media, { caption: legenda || undefined });
  }

  return async function processar(f, no, vars, texto, input, enviar, meta) {
    if ((await ctx.verificarBloqueioManualBot?.(meta.workspaceId, meta.canalId, meta.numero))?.bloqueado) return { parar: true };
    const at = await ctx.supabase.from('atendimentos').select('status,nome').eq('workspace_id', meta.workspaceId).eq('canal_id', meta.canalId).eq('numero', meta.numero).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (at.data?.status === 'resolvido') return { parar: true };
    const nomeContato = (() => { const x = String(at.data?.nome || '').trim(); return x && !/^\+?\d[\d\s()-]*$/.test(x) ? x.slice(0, 80) : undefined; })();
    const a = f.nos.find((x) => x.tipo === 'assistente_universal')?.dados || {};
    const n = no.dados || {};
    const s = ler(vars[KEY]); s.historico ||= []; s.pendentes ||= []; s.dados ||= {};
    const salvar = async () => { vars[KEY] = JSON.stringify(s); await ctx.salvarSessaoFluxo(meta.workspaceId, meta.canalId, meta.numero, f.id, no.id, vars, true, 'nicho_atendimento'); };

    const novo = String(texto || '').trim();
    if (novo) s.pendentes = [...s.pendentes, novo].slice(-15);
    if (!s.pendentes.length) return { aguardarInput: true };
    await salvar();
    if (!a.apiKey) { log(meta.numero, 'sem chave da IA no bloco Assistente'); return { aguardarInput: true }; }

    const bruto = s.pendentes.join('\n');
    try {
      let entrada = bruto, imagens = [];
      try { const m = await require('../claro-prime-v2/midia.cjs').preparar(bruto, { dir: ctx.AUDIOS_DIR, apiKey: a.apiKey }); entrada = m.texto || bruto; imagens = m.imagens || []; } catch (e) { log(meta.numero, 'mídia: ' + e.message); }
      const idioma = detectarIdioma(novo); if (idioma) s.lang = idioma;

      let itens = [], catalogoInfo;
      try { itens = await carregarCatalogo(n); catalogoInfo = itens.length ? `${itens.length} itens disponíveis (use buscar_catalogo). Exemplos: ${itens.slice(0, 8).map((p) => p.nome).join(', ')}` : 'não há catálogo cadastrado: fale das soluções pelas informações da empresa e, para valores, colete os dados e registre a solicitação de orçamento.'; }
      catch (e) { log(meta.numero, 'catálogo: ' + e.message); catalogoInfo = 'catálogo indisponível agora: não informe preços; colete os dados e registre a solicitação para a equipe responder.'; }

      const memoria = [
        s.lang ? `Idioma da conversa: ${{ pt: 'português', en: 'inglês', es: 'espanhol' }[s.lang]}.` : '',
        Object.keys(s.dados).length ? `Dados já salvos: ${JSON.stringify(s.dados)}` : '',
        s.vistos?.length ? `Itens já mostrados: ${s.vistos.join(' | ')}` : '',
        s.pedidos?.length ? `Pedidos já registrados nesta conversa: ${s.pedidos.join(' | ')}` : '',
        nomeContato && !s.dados.nome ? `Nome no WhatsApp do cliente: ${nomeContato} (confirme antes de usar como nome completo).` : '',
      ].filter(Boolean).join('\n');
      const conteudo = imagens.length ? [{ type: 'text', text: entrada }, ...imagens.slice(0, 3).map((u) => ({ type: 'image_url', image_url: { url: u } }))] : entrada;
      const msgs = [{ role: 'system', content: instrucoes(a, n, s, catalogoInfo) + (memoria ? '\n\nMEMÓRIA:\n' + memoria : '') }, ...s.historico.slice(-30), { role: 'user', content: conteudo }];
      const modelo = a.modelo && !/^gpt-4o-mini$/.test(a.modelo) ? a.modelo : 'gpt-4.1', reserva = a.modelo_reserva || 'gpt-4.1-mini';
      const saida = { humano: null, encerrar: null, seguir: false }; let resposta = '';
      const campos = (n.coleta || []).filter((c) => c.variavel);

      for (let volta = 0; volta < 10; volta++) {
        let m;
        try { m = await chamarIA({ apiKey: a.apiKey, modelo, mensagens: msgs }); }
        catch (e) { if (e.status === 401 || e.codigo === 'insufficient_quota') throw e; log(meta.numero, 'modelo principal falhou, usando reserva: ' + e.message); m = await chamarIA({ apiKey: a.apiKey, modelo: reserva, mensagens: msgs }); }
        msgs.push(m);
        if (!m.tool_calls?.length) { resposta = String(m.content || '').trim(); break; }
        for (const tc of m.tool_calls) {
          let x = {}; try { x = JSON.parse(tc.function.arguments || '{}'); } catch {}
          if (['pt', 'en', 'es'].includes(x.idioma)) s.lang = x.idioma;
          let r; const fn = tc.function.name;
          try {
            if (fn === 'buscar_catalogo') {
              const achados = buscar(itens, x.busca);
              s.vistos = [...new Set([...(s.vistos || []), ...achados.slice(0, 5).map((p) => `${p.id}: ${p.nome}`)])].slice(-25);
              r = { ok: true, total_catalogo: itens.length, itens: achados.map((p) => ({ ...p, preco_texto: p.preco != null ? brl(p.preco) : 'sob consulta' })) };
              log(meta.numero, `catálogo "${x.busca}" → ${achados.length}`);
            } else if (fn === 'enviar_foto') {
              const p = itens.find((i) => String(i.id) === String(x.id));
              if (!p?.imagem) r = { ok: false, erro: 'item sem foto' };
              else { await enviarFoto(meta, p.imagem, `${p.nome}${p.preco != null ? ' · ' + brl(p.preco) : ''}`); r = { ok: true, enviada: p.nome }; }
            } else if (fn === 'salvar_dados') {
              const ok = {}, erros = {};
              for (const [k, v] of Object.entries(x.dados || {})) {
                const c = campos.find((c) => c.variavel === k);
                if (!c && campos.length) { erros[k] = 'não é um dos dados configurados'; continue; }
                const e = c ? validarCampo(c, v) : null;
                if (e) erros[k] = e; else { s.dados[k] = String(v).trim().slice(0, 500); vars[k] = s.dados[k]; ok[k] = s.dados[k]; }
              }
              const faltam = campos.filter((c) => c.obrigatorio !== false && !s.dados[c.variavel]).map((c) => c.variavel);
              r = { ok: true, salvos: ok, erros, faltam };
            } else if (fn === 'registrar_pedido') {
              const faltam = campos.filter((c) => c.obrigatorio !== false && !s.dados[c.variavel]).map((c) => c.rotulo || c.variavel);
              const chave = JSON.stringify({ d: s.dados, i: (x.itens || []).map((i) => `${i.qtd || 1}|${sem(i.nome)}`), t: x.total ?? null });
              if (faltam.length) r = { ok: false, erro: 'faltam dados obrigatórios', faltam };
              else if (s.registrado === chave) r = { ok: true, ja_registrado: true, aviso: 'Este pedido JÁ foi registrado. Não registre de novo; só confirme e passe os próximos passos.' };
              else if (s.resumo_mostrado !== chave && !pediuConfirmacao(s)) {
                // Trava: primeiro o cliente vê o resumo e confirma; só depois registra.
                s.resumo_mostrado = chave;
                r = { ok: false, precisa_confirmacao: true, aviso: 'Ainda NÃO registrado. Mande ao cliente o resumo (itens, valores, dados) e pergunte se está tudo certo. Quando ele confirmar, chame registrar_pedido de novo com os mesmos dados.' };
              } else {
                s.registrado = chave;
                const lista = (x.itens || []).map((i) => `${i.qtd || 1}x ${i.nome}${i.preco != null ? ' ' + brl(i.preco) : ''}`).join('; ');
                const links = [...new Set((x.itens || []).map((i) => itens.find((p) => sem(p.nome) === sem(i.nome))?.link).filter(Boolean))];
                Object.assign(vars, { pedido_itens: lista, pedido_total: x.total != null ? brl(x.total) : '', pedido_total_numero: x.total ?? '', pedido_resumo: x.resumo || '', cliente_whatsapp: so(meta.numero), cliente_idioma: s.lang || 'pt' });
                const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                s.pedidos = [...(s.pedidos || []), `${quando} ${x.resumo || lista}`].slice(-5);
                const dadosTxt = campos.filter((c) => s.dados[c.variavel]).map((c) => `${c.rotulo || c.variavel}: ${s.dados[c.variavel]}`).join('\n');
                const aviso = [`🛎️ *${n.titulo_aviso || 'NOVO PEDIDO'}* · ${a.empresa || ''}`, x.resumo ? `📝 ${x.resumo}` : '', lista ? `📦 ${lista}` : '', x.total != null ? `💰 ${brl(x.total)}` : '', '', dadosTxt, `📱 +${so(meta.numero)}`].filter((l) => l !== '').join('\n');
                for (const dono of String(n.aviso_whatsapp || '').split(/[,;\s]+/).map(so).filter((d) => d.length >= 10)) {
                  try { await enviarPara(meta, dono, aviso); } catch (e) { log(meta.numero, 'aviso ao dono falhou: ' + e.message); }
                }
                const evento = { evento: 'pedido', quando: new Date().toISOString(), workspace: meta.workspaceId, canal: meta.canalId, whatsapp: so(meta.numero), idioma: s.lang || 'pt', dados: s.dados, itens: x.itens || [], total: x.total ?? null, resumo: x.resumo || '' };
                if (/^https:\/\//.test(n.webhook_url || '')) fetch(n.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento), signal: AbortSignal.timeout(15000) }).catch((e) => log(meta.numero, 'webhook: ' + e.message));
                if (/^https:\/\/script\.google\.com\//.test(n.planilha_registro_url || '')) {
                  const linha = { data: quando, whatsapp: so(meta.numero), ...s.dados, itens: lista, total: x.total ?? '', resumo: x.resumo || '' };
                  fetch(n.planilha_registro_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow', body: JSON.stringify({ acao: 'append', aba: n.planilha_registro_aba || '', dados: JSON.stringify(linha), linha }), signal: AbortSignal.timeout(20000) }).catch((e) => log(meta.numero, 'planilha: ' + e.message));
                }
                saida.seguir = !!(f.conexoes || []).find((c) => c.de === no.id && Number(c.saidaIndex || 0) === 0 && f.nos.find((z) => z.id === c.para && z.tipo !== 'transferir'));
                r = { ok: true, proximos_passos: { link_pagamento: links[0] || n.link_pagamento || null, formas_pagamento: n.formas_pagamento || null, link_agendamento: n.link_agendamento || null, mensagem_empresa: n.mensagem_pos_pedido || null }, aviso: 'Confirme o registro ao cliente e passe os próximos passos.' };
                log(meta.numero, `pedido registrado: ${x.resumo || lista}`);
              }
            } else if (fn === 'chamar_humano') {
              saida.humano = x.motivo || 'cliente pediu atendente'; r = { ok: true, aviso: 'Avise que um atendente vai continuar por aqui.' };
              for (const dono of String(n.aviso_whatsapp || '').split(/[,;\s]+/).map(so).filter((d) => d.length >= 10)) enviarPara(meta, dono, `🙋 *Atendimento humano solicitado* · ${a.empresa || ''}\n📱 +${so(meta.numero)}${nomeContato ? ' · ' + nomeContato : ''}\n💬 ${saida.humano}`).catch(() => {});
            } else if (fn === 'encerrar') { saida.encerrar = x.motivo || 'despedida'; r = { ok: true }; }
            else r = { ok: false, erro: 'ferramenta desconhecida' };
          } catch (e) { log(meta.numero, fn + ' falhou: ' + e.message); r = { ok: false, erro: e.message }; }
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 12000) });
        }
      }
      if (!resposta && !saida.humano && !saida.encerrar) resposta = { en: 'Sorry, could you repeat that? 😊', es: '¿Perdón, puedes repetir? 😊' }[s.lang] || 'Pode repetir, por favor? 😊';

      const partes = resposta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const blocos = []; let atual = '';
      for (const p of partes) { if ((atual + '\n\n' + p).length > 700 && atual) { blocos.push(atual); atual = p; } else atual = atual ? atual + '\n\n' + p : p; }
      if (atual) blocos.push(atual);
      const transferir = f.nos.find((z) => z.tipo === 'transferir');
      const ultima = saida.humano && transferir ? blocos.pop() : null;
      for (const b of blocos) await enviar(b);
      if (saida.humano && transferir) resposta = ultima || resposta;
      s.historico = [...s.historico, { role: 'user', content: bruto.slice(0, 3000) }, ...(resposta ? [{ role: 'assistant', content: resposta.slice(0, 3000) }] : [])].slice(-40);
      s.pendentes = []; delete s.erro; delete s.falhas;
      for (const [k, v] of Object.entries(s.dados)) vars[k] = v;
      await salvar();

      if (saida.humano) {
        vars.handoff_mensagem = resposta || ({ en: 'I will call an attendant to continue with you. 😊', es: 'Voy a llamar a un asesor para seguir contigo. 😊' }[s.lang] || 'Vou chamar um atendente para continuar com você. 😊');
        vars.handoff_motivo = String(saida.humano).slice(0, 200); await salvar();
        return { proximoNoId: transferir?.id || null };
      }
      if (saida.encerrar) {
        s.encerrado = true; await salvar();
        try { await require('../universal-v1/finalizar-conversa.cjs').finalizarConversa(ctx.supabase, meta.workspaceId, meta.canalId, meta.numero); } catch (e) { log(meta.numero, 'finalizar: ' + e.message); }
        return { parar: true };
      }
      if (saida.seguir) {
        const c = (f.conexoes || []).find((c) => c.de === no.id && Number(c.saidaIndex || 0) === 0);
        return { proximoNoId: c?.para || null };
      }
      return { aguardarInput: true };
    } catch (e) {
      console.error('[VendedoraIA]', meta.numero, e.stack || e.message);
      s.erro = String(e.message).slice(0, 150); s.falhas = (s.falhas || 0) + 1;
      if (s.falhas === 2) { try { await enviar({ en: 'I had a hiccup, but I saved your message. I will reply shortly! 😊', es: 'Tuve una falla, pero guardé tu mensaje. ¡Ya te respondo! 😊' }[s.lang] || 'Tive uma instabilidade aqui, mas guardei sua mensagem. Já te respondo! 😊'); } catch {} }
      try { await salvar(); } catch {}
      return { aguardarInput: true };
    }
  };
};
module.exports.__teste = { csv, normalizarItem, urlPlanilha, buscar, detectarIdioma, validarCampo };
