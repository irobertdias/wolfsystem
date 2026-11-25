'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Vendedora IA de energia solar — integração "solar_sistema" do bloco Nicho.
// Conversa no WhatsApp, lê a conta de luz (foto ou texto), calcula o sistema
// pela API /api/solar/agente (kit, tabela R$/Wp, tarifa e financiamento do
// CRM Solar do workspace), manda a proposta com link, registra aceite/recusa,
// pede a visita técnica e chama um humano quando precisa.
// A IA nunca inventa números: geração, preço, economia e parcelas vêm da API.
// Recarregado a quente pela loja-ia (services/loja-ia/atendimento.cjs).
// ═══════════════════════════════════════════════════════════════════════
const path = require('node:path');

const API = (process.env.LOJA_API_URL || 'https://app.wolfgyn.com.br').replace(/\/+$/, '');
const SEGREDO = () => String(process.env.WOLF_INTERNAL_API_SECRET || process.env.WOLF_SIGNATURE_PROXY_SECRET || '');
const KEY = '__solar_ia';
const ler = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v || {}; } catch { return {}; } };
const so = (v) => String(v || '').replace(/\D/g, '');

async function api(workspaceId, acao, dados = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(API + '/api/solar/agente', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-wolf-internal-secret': SEGREDO() },
      body: JSON.stringify({ workspaceId, acao, ...dados }),
    });
    return await r.json().catch(() => ({ ok: false, erro: 'resposta inválida (' + r.status + ')' }));
  } catch (e) { return { ok: false, erro: 'sistema indisponível: ' + e.message }; }
  finally { clearTimeout(t); }
}

const DADOS_SISTEMA = {
  consumo_kwh: { type: 'number', description: 'consumo MÉDIO mensal em kWh (média do histórico da conta, se tiver)' },
  conta_valor: { type: 'number', description: 'valor médio da conta em R$ (use só se não souber o consumo em kWh)' },
  tarifa: { type: 'number', description: 'R$/kWh com impostos, se a conta mostrar (valor total ÷ kWh). Opcional.' },
  uf: { type: 'string', description: 'sigla do estado da instalação, ex.: GO' },
  cidade: { type: 'string' },
  ligacao: { type: 'string', enum: ['mono', 'bi', 'tri'], description: 'tipo de ligação/fornecimento (monofásico, bifásico, trifásico), está na conta' },
  telhado: { type: 'string', enum: ['ceramico', 'fibrocimento', 'metalico', 'laje', 'solo'] },
  aumento_pct: { type: 'number', description: 'aumento de consumo previsto em % (ex.: vai comprar ar-condicionado). Opcional.' },
};
const FERRAMENTAS = [
  { name: 'simular_sistema', description: 'Calcula o sistema solar ideal para o cliente: painéis, inversor, potência, geração, conta antes/depois, economia por mês/ano/25 anos, investimento, retorno e parcelas do financiamento. Use assim que tiver o consumo (ou o valor da conta) e o estado. Não grava nada.', parameters: { type: 'object', properties: DADOS_SISTEMA, required: ['uf'] } },
  { name: 'enviar_proposta', description: 'Gera ou ATUALIZA a proposta do cliente no sistema e devolve o link para ele ver tudo e aprovar (cada cliente tem UMA proposta aberta; mandar de novo atualiza a mesma). Use quando o cliente quiser a proposta / gostar da simulação, ou para refazer com outros dados. O telefone é preenchido sozinho.', parameters: { type: 'object', properties: { nome: { type: 'string', description: 'nome do cliente' }, email: { type: 'string' }, novo: { type: 'boolean', description: 'true SÓ se o cliente pedir uma proposta separada (ex.: outra casa/empresa)' }, ...DADOS_SISTEMA }, required: ['uf'] } },
  { name: 'aprovar_proposta', description: 'O cliente APROVOU a proposta ("quero fechar", "pode fazer", "aprovado"). Registra o aceite com a forma de pagamento e avisa a empresa para agendar a visita técnica. Antes, confirme a forma de pagamento (e o prazo, se financiado), o nome completo e o endereço da instalação.', parameters: { type: 'object', properties: { proposta_id: { type: 'number' }, pagamento: { type: 'string', description: 'uma das formas de pagamento da empresa' }, prazo: { type: 'number', description: 'nº de parcelas, se financiado ou cartão' }, nome: { type: 'string' }, cpf: { type: 'string', description: 'CPF ou CNPJ, se informado' }, endereco: { type: 'string', description: 'rua, número, bairro e cidade da instalação' } }, required: ['pagamento', 'nome'] } },
  { name: 'agendar_visita', description: 'O cliente quer uma visita técnica (medir telhado, ver o padrão de energia) antes ou depois de aprovar. Registra o pedido com o dia/horário que ele prefere e avisa a empresa, que confirma.', parameters: { type: 'object', properties: { proposta_id: { type: 'number' }, data: { type: 'string', description: 'dia/horário preferido nas palavras do cliente' }, endereco: { type: 'string' }, obs: { type: 'string' } } } },
  { name: 'recusar_proposta', description: 'O cliente disse que NÃO quer (desistiu, fechou com outro). NUNCA chame na primeira negativa: antes tente salvar a venda (financiamento com parcela menor que a conta, sistema menor, visita técnica sem compromisso). Só chame se ele recusar de novo.', parameters: { type: 'object', properties: { proposta_id: { type: 'number' }, motivo: { type: 'string' } }, required: ['proposta_id', 'motivo'] } },
  { name: 'consultar_propostas', description: 'Mostra as propostas deste cliente: etapa (enviada, aceita, visita, instalação...), valor, link e se o link ainda vale.', parameters: { type: 'object', properties: {} } },
  { name: 'chamar_humano', description: 'Transfere para um consultor humano: negociação de preço/desconto, projeto grande (empresa, rural, usina, acima de 75 kWp), baterias/sistema off-grid, dúvida técnica que você não sabe, reclamação, pós-venda/manutenção, ou quando o cliente pedir uma pessoa.', parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
  { name: 'encerrar', description: 'Encerra quando o cliente se despedir ou disser que não quer mais nada.', parameters: { type: 'object', properties: { motivo: { type: 'string' } } } },
].map((f) => ({ type: 'function', function: f }));

function instrucoes(assistente, nicho, cfg) {
  const nome = assistente.nome || 'a consultora virtual';
  const empresa = cfg.empresa?.nome || assistente.empresa || 'a empresa';
  return [
    `Você é ${nome}, consultora de energia solar da ${empresa}. Atende pelo WhatsApp quem quer economizar na conta de luz com energia solar fotovoltaica. Você é uma vendedora excelente: simpática, segura, consultiva, e entende MUITO de energia solar.`,
    `Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}.`,
    '',
    'OBJETIVO: entender o consumo do cliente, mostrar quanto ele economiza, mandar a proposta com link e levar até a aprovação e a visita técnica.',
    '',
    'JEITO DE FALAR',
    '- Português do Brasil, caloroso e profissional. Mensagens curtas como no WhatsApp (até ~5 linhas por bloco), negrito com *asteriscos*, poucos emojis (☀️⚡💰).',
    '- Uma pergunta por vez. Use o nome do cliente quando souber. Sem markdown de título nem [texto](link): links puros.',
    '- Você é uma assistente virtual: se perguntarem sinceramente se é robô, diga que é a assistente virtual da empresa e ofereça um consultor.',
    '',
    'ROTEIRO DE VENDA',
    '1. Na primeira resposta, se o cliente ainda não disse, peça a *foto da conta de luz* (a mais recente, mostrando o histórico de consumo). Diga que com ela você calcula na hora o sistema certo e a economia. Se ele não tiver a conta, peça o valor médio que paga por mês e a cidade.',
    '2. LENDO A CONTA (quando vier foto/PDF): procure o *histórico de consumo* dos últimos meses (kWh) e calcule a média; o consumo do mês; o valor total; a tarifa com impostos (valor ÷ kWh, aprox.); o tipo de fornecimento (monofásico/bifásico/trifásico); a distribuidora; a cidade/UF; o nome do titular. Confirme em 1 linha o que leu ("Vi aqui: média de *520 kWh/mês*, conta de R$ 560, bifásico, em Goiânia/GO 👍"). Se a foto estiver ilegível, peça outra ou o valor médio.',
    '3. Pergunte o tipo de telhado (cerâmica, fibrocimento/Eternit, metálico, laje ou no chão) se ainda não souber. Se o cliente não souber, siga com cerâmica e diga que a visita técnica confirma.',
    '4. Chame simular_sistema e apresente de forma vendedora, em 2 blocos curtos: (a) o sistema: nº de painéis, potência, geração; (b) o dinheiro: conta hoje → conta depois, economia por mês e em 25 anos, investimento, retorno e a parcela do financiamento (destaque quando a parcela for MENOR ou parecida com a conta atual: "você troca a conta de luz pela parcela do seu próprio sistema").',
    '5. Ofereça mandar a proposta completa com link. Pergunte o nome se não souber e chame enviar_proposta. Mande o link e diga que nele dá para ver tudo e aprovar com um toque, e até quando a condição vale.',
    '6. Se o cliente aprovar: confirme a forma de pagamento (e o prazo se financiado/cartão), nome completo, CPF (opcional) e endereço da instalação; então chame aprovar_proposta. Explique o próximo passo: visita técnica gratuita para conferir telhado e padrão, contrato, projeto e homologação na distribuidora, instalação.',
    '7. Se ele quiser ver antes, ofereça a visita técnica sem compromisso (agendar_visita com o dia/horário preferido).',
    '8. Se mudar dados (outro consumo, outra casa, mais painéis por causa de ar-condicionado/piscina/carro elétrico), refaça simular_sistema e, se já havia proposta, enviar_proposta de novo (atualiza a mesma e o link).',
    '',
    'CONHECIMENTO TÉCNICO (use para tirar dúvidas, em linguagem simples)',
    '- Sistema on-grid: os painéis geram de dia; o que sobra vai para a rede e vira *créditos* que abatem a conta à noite e nos meses seguintes (valem 60 meses). Não precisa de bateria.',
    '- Dia nublado/chuva: gera menos, mas o cálculo já usa a média do ano da região. À noite usa os créditos.',
    '- A conta NÃO zera: fica a taxa mínima da distribuidora (custo de disponibilidade: 30 kWh mono, 50 bi, 100 tri), a iluminação pública e, pela Lei 14.300, uma parte do "Fio B" sobre a energia compensada. Nunca prometa conta zerada.',
    '- Manutenção: basicamente limpeza dos painéis 1 a 2 vezes por ano. Vida útil de 25 a 30 anos. Inversor costuma ter garantia de 10 anos.',
    '- Homologação: a empresa faz o projeto e pede a troca do medidor (bidirecional) na distribuidora; leva algumas semanas.',
    '- Valoriza o imóvel, protege dos aumentos da energia (que sobe todo ano) e é energia limpa.',
    '- Inversor string x microinversor; painel monocristalino; kWp = potência de pico; kWh = energia consumida. Explique se perguntarem.',
    '- Baterias/off-grid, usina, rural irrigação, empresas grandes: chame um consultor (chamar_humano).',
    '',
    'OBJEÇÕES',
    '- "Está caro": compare com o que ele já paga — em X anos a conta paga o sistema; mostre a parcela do financiamento ao lado da conta atual; economia em 25 anos. Se ainda assim, ofereça sistema menor (cobrindo parte do consumo) ou visita sem compromisso. Desconto ou negociação → chamar_humano.',
    '- "Vou pensar": diga até quando a condição vale, reforce a economia mensal perdida a cada mês sem o sistema (sem pressão exagerada) e ofereça a visita técnica gratuita.',
    '- "Moro de aluguel / telhado pequeno / sombra": seja honesta; peça foto do telhado; ofereça visita técnica.',
    '',
    'REGRAS DO SISTEMA (obrigatórias)',
    '- Potência, nº de painéis, geração, preço, economia, retorno e parcelas SÓ podem vir de simular_sistema/enviar_proposta. Nunca invente, nunca arredonde para mais, nunca dê desconto nem condição que a empresa não informou.',
    '- Sempre diga que os valores são estimativas confirmadas na visita técnica.',
    '- Se uma ferramenta der erro, explique de forma simples e peça o dado que faltou; se não resolver, chame um humano.',
    `DADOS DA EMPRESA: ${JSON.stringify({ empresa: cfg.empresa, kit: cfg.kit, garantias: cfg.garantias, prazo_instalacao: cfg.prazo_instalacao, formas_pagamento: cfg.formas_pagamento, financiamento: cfg.financiamento, cartao_vezes: cfg.cartao_vezes, estado_padrao: cfg.uf_padrao, condicoes: cfg.condicoes })}`,
    cfg.instrucoes ? `REGRAS DA EMPRESA: ${cfg.instrucoes}` : '',
    assistente.regras ? `REGRAS DO ATENDIMENTO: ${assistente.regras}` : '',
    nicho.prompt ? `ROTEIRO DO FLUXO:\n${nicho.prompt}` : '',
  ].filter((l) => l !== '').join('\n');
}

async function chamarIA({ apiKey, modelo, mensagens }) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, messages: mensagens, tools: FERRAMENTAS, temperature: 0.5 }),
    });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'OpenAI ' + r.status), { status: r.status, codigo: j?.error?.code });
    return j.choices[0].message;
  } finally { clearTimeout(t); }
}

module.exports = function criar({ ctx, log, previous }) {
  const processar = async function processar(f, no, vars, texto, input, enviar, meta) {
    if ((await ctx.verificarBloqueioManualBot?.(meta.workspaceId, meta.canalId, meta.numero))?.bloqueado) return { parar: true };
    const at = await ctx.supabase.from('atendimentos').select('status,nome').eq('workspace_id', meta.workspaceId).eq('canal_id', meta.canalId).eq('numero', meta.numero).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (at.data?.status === 'resolvido') return { parar: true };
    const nomeContato = (() => { const x = String(at.data?.nome || '').trim(); return x && !/^\+?\d[\d\s()-]*$/.test(x) ? x.slice(0, 80) : undefined; })();
    const assistente = f.nos.find((n) => n.tipo === 'assistente_universal')?.dados || {};
    const nicho = no.dados || {};
    const apiKey = assistente.apiKey || process.env.OPENAI_API_KEY;
    const s = ler(vars[KEY]); s.historico ||= []; s.pendentes ||= [];
    const salvar = async () => { vars[KEY] = JSON.stringify(s); await ctx.salvarSessaoFluxo(meta.workspaceId, meta.canalId, meta.numero, f.id, no.id, vars, true, 'nicho_atendimento'); };

    const novo = String(texto || '').trim();
    if (novo) s.pendentes = [...s.pendentes, novo].slice(-15);
    if (!s.pendentes.length) {
      if (!s.apresentou) {
        const a = String(assistente.apresentacao || `Olá! ☀️ Sou ${assistente.nome || 'a consultora virtual'}${assistente.empresa ? ' da *' + assistente.empresa + '*' : ''}. Vou te mostrar quanto você pode economizar com energia solar. Me manda uma *foto da sua conta de luz*? Com ela eu calculo na hora o sistema ideal pra você.`);
        await enviar(a); s.apresentou = true; s.historico.push({ role: 'assistant', content: a }); await salvar();
      }
      return { aguardarInput: true };
    }
    await salvar();
    if (!apiKey) { log(meta.numero, 'sem chave OpenAI no bloco Assistente'); return { aguardarInput: true }; }

    const bruto = s.pendentes.join('\n');
    try {
      let entrada = bruto, imagens = [];
      try { const m = await require('../claro-prime-v2/midia.cjs').preparar(bruto, { dir: ctx.AUDIOS_DIR, apiKey }); entrada = m.texto || bruto; imagens = m.imagens || []; } catch (e) { log(meta.numero, 'mídia: ' + e.message); }

      const cfg = await api(meta.workspaceId, 'config');
      if (!cfg.ok) { log(meta.numero, 'config solar: ' + cfg.erro); if (/não liberado/.test(String(cfg.erro)) && previous) return previous(f, no, vars, texto, input, enviar, meta); throw new Error(cfg.erro); }

      const memoria = [
        s.conta ? `Dados já levantados do cliente (use, não pergunte de novo): ${JSON.stringify(s.conta)}` : '',
        s.ultima_simulacao ? `Última simulação: ${s.ultima_simulacao}` : '',
        s.proposta ? `Proposta atual: proposta_id ${s.proposta.id}, nº ${s.proposta.numero}, link ${s.proposta.link}` : '',
        s.aceita ? 'O cliente JÁ APROVOU a proposta. Agora acompanhe: visita técnica, documentos, dúvidas.' : '',
      ].filter(Boolean).join('\n');
      const conteudo = imagens.length ? [{ type: 'text', text: entrada || '(o cliente mandou uma imagem — se for a conta de luz, leia os dados)' }, ...imagens.slice(0, 3).map((u) => ({ type: 'image_url', image_url: { url: u } }))] : entrada;
      const msgs = [{ role: 'system', content: instrucoes(assistente, nicho, cfg) + (memoria ? '\n\nMEMÓRIA DA CONVERSA:\n' + memoria : '') }, ...s.historico.slice(-30), { role: 'user', content: conteudo }];
      const modelo = assistente.modelo || 'gpt-4.1', reserva = assistente.modelo_reserva || 'gpt-4.1-mini';
      const saida = { humano: null, encerrar: null }; let resposta = '';
      const guardarConta = (a) => { const k = ['consumo_kwh', 'conta_valor', 'tarifa', 'uf', 'cidade', 'ligacao', 'telhado', 'aumento_pct']; s.conta = { ...(s.conta || {}), ...Object.fromEntries(k.filter((x) => a[x] !== undefined && a[x] !== null && a[x] !== '').map((x) => [x, a[x]])) }; };

      for (let volta = 0; volta < 10; volta++) {
        let m;
        try { m = await chamarIA({ apiKey, modelo, mensagens: msgs }); }
        catch (e) { if (e.status === 401 || e.codigo === 'insufficient_quota') throw e; log(meta.numero, 'modelo principal falhou, usando reserva: ' + e.message); m = await chamarIA({ apiKey, modelo: reserva, mensagens: msgs }); }
        msgs.push(m);
        if (!m.tool_calls?.length) { resposta = String(m.content || '').trim(); break; }
        for (const tc of m.tool_calls) {
          let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          let r; const fn = tc.function.name;
          if (fn === 'simular_sistema') {
            guardarConta(args);
            r = await api(meta.workspaceId, 'simular', { ...(s.conta || {}), ...args });
            if (r.ok) { s.ultima_simulacao = `${r.potencia}, ${r.paineis} painéis, economia ${r.economia_mes}/mês, investimento ${r.investimento}`; log(meta.numero, 'simulação ' + s.ultima_simulacao); }
          } else if (fn === 'enviar_proposta') {
            guardarConta(args);
            r = await api(meta.workspaceId, 'enviar_proposta', { ...(s.conta || {}), ...args, cliente: { nome: args.nome || nomeContato, telefone: so(meta.numero), cidade: args.cidade || s.conta?.cidade, uf: args.uf || s.conta?.uf, email: args.email }, novo: args.novo === true });
            if (r.ok) { s.proposta = { id: r.proposta_id, numero: r.numero, link: r.link }; log(meta.numero, `proposta ${r.numero} ${r.atualizada ? 'atualizada' : 'criada'} (${r.investimento})`); }
          } else if (fn === 'aprovar_proposta') {
            r = await api(meta.workspaceId, 'aceitar', { ...args, proposta_id: args.proposta_id || s.proposta?.id, telefone: so(meta.numero) });
            if (r.ok) { s.aceita = true; log(meta.numero, `proposta ${r.numero} aprovada (${args.pagamento})`); }
          } else if (fn === 'agendar_visita') {
            r = await api(meta.workspaceId, 'visita', { ...args, proposta_id: args.proposta_id || s.proposta?.id, telefone: so(meta.numero) });
            if (r.ok) log(meta.numero, `visita pedida: ${args.data || '-'}`);
          } else if (fn === 'recusar_proposta') {
            r = await api(meta.workspaceId, 'recusar', { ...args, proposta_id: args.proposta_id || s.proposta?.id, telefone: so(meta.numero) });
            if (r.ok) log(meta.numero, `proposta recusada: ${args.motivo}`);
          } else if (fn === 'consultar_propostas') r = await api(meta.workspaceId, 'status', { telefone: so(meta.numero) });
          else if (fn === 'chamar_humano') { saida.humano = args.motivo || 'cliente pediu atendente'; r = { ok: true, aviso: 'Avise o cliente que um consultor vai continuar.' }; }
          else if (fn === 'encerrar') { saida.encerrar = args.motivo || 'despedida'; r = { ok: true }; }
          else r = { ok: false, erro: 'ferramenta desconhecida' };
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 12000) });
        }
      }
      if (!resposta && !saida.humano && !saida.encerrar) resposta = 'Só um instante: pode me mandar de novo o que você precisa? ☀️';

      const partes = resposta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const blocos = []; let atual = '';
      for (const p of partes) { if ((atual + '\n\n' + p).length > 700 && atual) { blocos.push(atual); atual = p; } else atual = atual ? atual + '\n\n' + p : p; }
      if (atual) blocos.push(atual);
      const temTransferir = !!(nicho.humano_no_id || f.nos.find((n) => n.tipo === 'transferir'));
      const ultima = saida.humano && temTransferir ? blocos.pop() : null;
      for (const b of blocos) await enviar(b);
      if (saida.humano && temTransferir) resposta = ultima || resposta;
      s.apresentou = true;
      s.historico = [...s.historico, { role: 'user', content: (imagens.length ? '[imagem enviada] ' : '') + bruto.slice(0, 2000) }, ...(resposta ? [{ role: 'assistant', content: resposta.slice(0, 3000) }] : [])].slice(-40);
      s.pendentes = []; delete s.erro; delete s.falhas;
      await salvar();

      if (saida.humano) {
        vars.handoff_mensagem = resposta || 'Vou chamar um consultor para continuar com você. ☀️';
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
      console.error('[SolarIA]', meta.numero, e.stack || e.message);
      s.erro = String(e.message).slice(0, 150); s.falhas = (s.falhas || 0) + 1;
      if (s.falhas === 2) { try { await enviar('Tive uma instabilidade aqui, mas guardei sua mensagem. Já te respondo! ☀️'); } catch {} }
      try { await salvar(); } catch {}
      return { aguardarInput: true };
    }
  };
  processar.__teste = { instrucoes, FERRAMENTAS, api };
  return processar;
};
