'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Vendedora IA das lojas (Informática, Vendas, Roupas) — integração "loja_sistema".
// Atende no bloco Nicho do fluxo e consulta o sistema do workspace pela API
// /api/loja/agente (catálogo, estoque, frete, pedido, pagamento e status).
// A IA nunca define preço nem estoque: tudo vem das ferramentas.
// Recarregado a quente pelo index.cjs quando este arquivo muda.
// ═══════════════════════════════════════════════════════════════════════
const path = require('node:path');

const API = (process.env.LOJA_API_URL || 'https://app.wolfgyn.com.br').replace(/\/+$/, '');
const SEGREDO = () => String(process.env.WOLF_INTERNAL_API_SECRET || process.env.WOLF_SIGNATURE_PROXY_SECRET || '');
const KEY = '__loja_ia';
const ler = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v || {}; } catch { return {}; } };
const so = (v) => String(v || '').replace(/\D/g, '');

async function api(workspaceId, acao, dados = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(API + '/api/loja/agente', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-wolf-internal-secret': SEGREDO() },
      body: JSON.stringify({ workspaceId, acao, ...dados }),
    });
    const j = await r.json().catch(() => ({ ok: false, erro: 'resposta inválida (' + r.status + ')' }));
    return j;
  } catch (e) { return { ok: false, erro: 'sistema da loja indisponível: ' + e.message }; }
  finally { clearTimeout(t); }
}

const FERRAMENTAS = [
  { name: 'buscar_produtos', description: 'Procura produtos no catálogo da loja pelo que o cliente pediu. Devolve preço, estoque, variações (tamanho/cor) e descrição. Use SEMPRE antes de falar de preço ou disponibilidade.', parameters: { type: 'object', properties: { busca: { type: 'string', description: 'termos do produto, ex.: "placa mãe b550", "vestido midi preto"' }, categoria: { type: 'string' } }, required: ['busca'] } },
  { name: 'ver_produto', description: 'Detalhes atualizados de um produto (preço, estoque por variação, garantia, descrição).', parameters: { type: 'object', properties: { produto_id: { type: 'string' } }, required: ['produto_id'] } },
  { name: 'calcular_frete', description: 'Calcula o frete para o CEP do cliente com os itens escolhidos. Devolve as opções (ex.: SEDEX/PAC) com valor e prazo.', parameters: { type: 'object', properties: { cep: { type: 'string' }, itens: { type: 'array', items: { type: 'object', properties: { produto_id: { type: 'string' }, variante_id: { type: 'string' }, qtd: { type: 'number' } }, required: ['produto_id', 'qtd'] } } }, required: ['cep', 'itens'] } },
  { name: 'fechar_pedido', description: 'Cria o pedido no sistema. Só chame depois de mostrar o resumo (itens, entrega, frete, total, pagamento) e o cliente CONFIRMAR. O telefone do cliente é preenchido automaticamente. Se o pagamento for online, devolve o link de pagamento.', parameters: { type: 'object', properties: {
    nome: { type: 'string', description: 'nome completo do cliente' }, cpf: { type: 'string' }, email: { type: 'string' },
    itens: { type: 'array', items: { type: 'object', properties: { produto_id: { type: 'string' }, variante_id: { type: 'string' }, qtd: { type: 'number' } }, required: ['produto_id', 'qtd'] } },
    entrega: { type: 'string', enum: ['retirada', 'entrega'] }, cep: { type: 'string' }, endereco: { type: 'string', description: 'rua, número, complemento e bairro' }, cidade: { type: 'string' }, uf: { type: 'string' },
    servico_frete: { type: 'string', description: 'SEDEX, PAC ou Entrega, conforme a opção escolhida' }, pagamento: { type: 'string', description: 'forma de pagamento escolhida; use "Pagamento online" para pagar pelo link' }, observacoes: { type: 'string' },
  }, required: ['nome', 'itens', 'entrega', 'pagamento'] } },
  { name: 'link_pagamento', description: 'Gera (ou reenvia) o link de pagamento online de um pedido já criado.', parameters: { type: 'object', properties: { pedido_id: { type: 'number' }, cpf: { type: 'string' } }, required: ['pedido_id'] } },
  { name: 'consultar_pedidos', description: 'Status dos pedidos deste cliente (pago, em separação, enviado, rastreio, link de pagamento). Use quando o cliente perguntar do pedido.', parameters: { type: 'object', properties: { pedido_id: { type: 'number' } } } },
  { name: 'chamar_humano', description: 'Transfere para um atendente humano: reclamação, troca/devolução, garantia, negociação de preço, assunto fora da loja, ou quando o cliente pedir uma pessoa.', parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
  { name: 'encerrar', description: 'Encerra o atendimento quando o cliente se despedir ou disser que não quer mais nada.', parameters: { type: 'object', properties: { motivo: { type: 'string' } } } },
].map((f) => ({ type: 'function', function: f }));

function instrucoes(assistente, nicho, loja) {
  return [
    `Você é ${assistente.nome || 'a vendedora virtual'}${loja.loja ? ` da loja ${loja.loja}` : assistente.empresa ? ` da ${assistente.empresa}` : ''} e atende clientes pelo WhatsApp.`,
    'Jeito: simpática, objetiva, mensagens curtas como no WhatsApp (no máximo 4 linhas por mensagem), poucos emojis. Uma pergunta por vez.',
    'Você é uma assistente virtual: se o cliente perguntar sinceramente se fala com robô ou pessoa, diga que é a assistente virtual da loja e ofereça chamar um atendente.',
    'REGRAS DO SISTEMA (obrigatórias):',
    '- Preço, estoque, variações, frete e prazos SÓ podem vir das ferramentas. Nunca invente, nunca estime, nunca prometa desconto que a loja não deu.',
    '- Se o produto não aparecer na busca ou estiver sem estoque, diga que no momento não tem e ofereça alternativas da própria busca.',
    '- Roupas e itens com variação: confirme tamanho/cor (variante_id) e veja o estoque daquela variação.',
    '- Antes de fechar: mostre o resumo (itens com preço, entrega ou retirada, frete, total e forma de pagamento) e peça confirmação. Só chame fechar_pedido depois do "sim" do cliente.',
    '- Para entrega, peça o CEP e calcule o frete com calcular_frete; depois peça rua, número, complemento e bairro.',
    loja.pagamento_online ? '- A loja aceita pagamento online pelo link (PIX, cartão ou boleto): ofereça. Depois de fechar, envie o link de pagamento que a ferramenta devolver. Avise que, quando o pagamento entrar, ela recebe a confirmação aqui e o pedido vai para separação.' : '- A loja não tem pagamento online: combine uma das formas de pagamento da loja.',
    '- Depois de fechar, informe o número do pedido. Se perguntarem do pedido, use consultar_pedidos.',
    '- Troca, devolução, garantia, reclamação ou negociação: chame_humano.',
    `DADOS DA LOJA: ${JSON.stringify({ loja: loja.loja, telefone: loja.telefone, endereco: loja.endereco, formas_pagamento: loja.formas_pagamento, pagamento_online: loja.pagamento_online, frete: loja.frete, frete_gratis_acima: loja.frete_gratis_acima, categorias: loja.categorias })}`,
    loja.instrucoes ? `INSTRUÇÕES DA LOJA: ${loja.instrucoes}` : '',
    assistente.regras ? `REGRAS DA EMPRESA: ${assistente.regras}` : '',
    nicho.prompt ? `ROTEIRO DA VENDEDORA (do fluxo):\n${nicho.prompt}` : '',
  ].filter(Boolean).join('\n');
}

async function chamarIA({ apiKey, modelo, mensagens }) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, messages: mensagens, tools: FERRAMENTAS, temperature: 0.4 }),
    });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'OpenAI ' + r.status), { status: r.status, codigo: j?.error?.code });
    return j.choices[0].message;
  } finally { clearTimeout(t); }
}

module.exports = function criar({ ctx, log, previous }) {
  return async function processar(f, no, vars, texto, input, enviar, meta) {
    if (no?.tipo !== 'nicho_atendimento' || no.dados?.integracao !== 'loja_sistema') return previous(f, no, vars, texto, input, enviar, meta);
    if ((await ctx.verificarBloqueioManualBot?.(meta.workspaceId, meta.canalId, meta.numero))?.bloqueado) return { parar: true };
    const at = await ctx.supabase.from('atendimentos').select('status').eq('workspace_id', meta.workspaceId).eq('canal_id', meta.canalId).eq('numero', meta.numero).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (at.data?.status === 'resolvido') return { parar: true };

    const assistente = f.nos.find((n) => n.tipo === 'assistente_universal')?.dados || {};
    const nicho = no.dados || {};
    const apiKey = assistente.apiKey || process.env.OPENAI_API_KEY;
    const s = ler(vars[KEY]); s.historico ||= []; s.pendentes ||= [];
    const salvar = async () => { vars[KEY] = JSON.stringify(s); await ctx.salvarSessaoFluxo(meta.workspaceId, meta.canalId, meta.numero, f.id, no.id, vars, true, 'nicho_atendimento'); };

    const novo = String(texto || '').trim();
    if (novo) s.pendentes = [...s.pendentes, novo].slice(-15);
    if (!s.pendentes.length) {
      // Primeira entrada no bloco sem texto: apresentação.
      if (!s.apresentou) { const a = String(assistente.apresentacao || `Olá! 😊 Sou ${assistente.nome || 'a assistente virtual'}${assistente.empresa ? ' da *' + assistente.empresa + '*' : ''}. Como posso te ajudar?`); await enviar(a); s.apresentou = true; s.historico.push({ role: 'assistant', content: a }); await salvar(); }
      return { aguardarInput: true };
    }
    await salvar(); // guarda a entrada antes da IA (retomada se falhar)
    if (!apiKey) { log(meta.numero, 'sem chave OpenAI no bloco Assistente'); return { aguardarInput: true }; }

    const bruto = s.pendentes.join('\n');
    try {
      // Áudio e imagem: mesma preparação da vendedora v2 (transcrição e leitura).
      let entrada = bruto, imagens = [];
      try { const m = await require('../claro-prime-v2/midia.cjs').preparar(bruto, { dir: ctx.AUDIOS_DIR, apiKey }); entrada = m.texto || bruto; imagens = m.imagens || []; } catch (e) { log(meta.numero, 'mídia: ' + e.message); }

      const loja = await api(meta.workspaceId, 'config');
      if (!loja.ok) { log(meta.numero, 'config da loja: ' + loja.erro); if (/não liberado/.test(String(loja.erro))) return previous(f, no, vars, texto, input, enviar, meta); throw new Error(loja.erro); }

      const conteudo = imagens.length ? [{ type: 'text', text: entrada }, ...imagens.slice(0, 3).map((u) => ({ type: 'image_url', image_url: { url: u } }))] : entrada;
      const msgs = [{ role: 'system', content: instrucoes(assistente, nicho, loja) }, ...s.historico.slice(-30), { role: 'user', content: conteudo }];
      const modelo = assistente.modelo || 'gpt-4.1', reserva = assistente.modelo_reserva || 'gpt-4.1-mini';
      let saida = { humano: null, encerrar: null }, resposta = '';
      for (let volta = 0; volta < 8; volta++) {
        let m;
        try { m = await chamarIA({ apiKey, modelo, mensagens: msgs }); }
        catch (e) { if (e.status === 401 || e.codigo === 'insufficient_quota') throw e; log(meta.numero, 'modelo principal falhou, usando reserva: ' + e.message); m = await chamarIA({ apiKey, modelo: reserva, mensagens: msgs }); }
        msgs.push(m);
        if (!m.tool_calls?.length) { resposta = String(m.content || '').trim(); break; }
        for (const tc of m.tool_calls) {
          let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          let r;
          const fn = tc.function.name;
          if (fn === 'buscar_produtos') r = await api(meta.workspaceId, 'catalogo', { busca: args.busca, categoria: args.categoria, limite: 8 });
          else if (fn === 'ver_produto') r = await api(meta.workspaceId, 'produto', { produto_id: args.produto_id });
          else if (fn === 'calcular_frete') r = await api(meta.workspaceId, 'frete', { cep: args.cep, itens: args.itens });
          else if (fn === 'fechar_pedido') {
            r = await api(meta.workspaceId, 'criar_pedido', { cliente: { nome: args.nome, telefone: so(meta.numero), cpf: args.cpf, email: args.email }, itens: args.itens, entrega: args.entrega, cep: args.cep, endereco: args.endereco, cidade: args.cidade, uf: args.uf, servico_frete: args.servico_frete, pagamento: args.pagamento, observacoes: args.observacoes });
            if (r.ok) { s.pedidos = [...(s.pedidos || []), r.pedido_id].slice(-10); log(meta.numero, `pedido ${r.numero} criado (${r.total_texto})`); }
          }
          else if (fn === 'link_pagamento') r = await api(meta.workspaceId, 'link_pagamento', { pedido_id: args.pedido_id, documento: args.cpf });
          else if (fn === 'consultar_pedidos') r = await api(meta.workspaceId, 'status_pedido', args.pedido_id ? { pedido_id: args.pedido_id } : { telefone: so(meta.numero) });
          else if (fn === 'chamar_humano') { saida.humano = args.motivo || 'cliente pediu atendente'; r = { ok: true, aviso: 'Avise o cliente que um atendente vai continuar.' }; }
          else if (fn === 'encerrar') { saida.encerrar = args.motivo || 'despedida'; r = { ok: true }; }
          else r = { ok: false, erro: 'ferramenta desconhecida' };
          // Fotos são dados grandes: a IA só precisa saber que existem.
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 12000) });
        }
      }
      if (!resposta && !saida.humano && !saida.encerrar) resposta = 'Só um instante, pode repetir o que você precisa? 😊';

      const partes = resposta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const blocos = []; let atual = '';
      for (const p of partes) { if ((atual + '\n\n' + p).length > 700 && atual) { blocos.push(atual); atual = p; } else atual = atual ? atual + '\n\n' + p : p; }
      if (atual) blocos.push(atual);
      for (const b of blocos) await enviar(b);
      s.apresentou = true;
      s.historico = [...s.historico, { role: 'user', content: bruto.slice(0, 2000) }, ...(resposta ? [{ role: 'assistant', content: resposta.slice(0, 3000) }] : [])].slice(-40);
      s.pendentes = []; delete s.erro; delete s.falhas;
      await salvar();

      if (saida.humano) {
        vars.handoff_mensagem = resposta || 'Vou chamar um atendente para continuar com você. 😊';
        vars.handoff_motivo = String(saida.humano).slice(0, 200);
        await salvar();
        return { proximoNoId: nicho.humano_no_id || f.nos.find((n) => n.tipo === 'transferir')?.id || null };
      }
      if (saida.encerrar) {
        s.encerrado = true; await salvar();
        try { await require(path.join(__dirname, '../universal-v1/finalizar-conversa.cjs')).finalizarConversa(ctx.supabase, meta.workspaceId, meta.canalId, meta.numero); } catch (e) { log(meta.numero, 'finalizar: ' + e.message); }
        return { parar: true };
      }
      return { aguardarInput: true };
    } catch (e) {
      console.error('[LojaIA]', meta.numero, e.stack || e.message);
      s.erro = String(e.message).slice(0, 150); s.falhas = (s.falhas || 0) + 1;
      if (s.falhas === 2) { try { await enviar('Tive uma instabilidade aqui, mas guardei sua mensagem. Já te respondo! 😊'); } catch {} }
      try { await salvar(); } catch {}
      return { aguardarInput: true };
    }
  };
};
