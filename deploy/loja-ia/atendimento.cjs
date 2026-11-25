'use strict';
// ═══════════════════════════════════════════════════════════════════════
// Vendedora IA das lojas (Informática, Vendas, Roupas) — integração "loja_sistema".
// Atende no bloco Nicho do fluxo e consulta o sistema do workspace pela API
// /api/loja/agente (catálogo, estoque, frete, orçamento, pedido, pagamento e status).
// A IA nunca define preço nem estoque: tudo vem das ferramentas.
// Fluxo de venda: entende a necessidade → busca e explica → orçamento (link) →
// cliente aprova → pedido + pagamento → avisos de status (feitos pelo sistema).
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

const ITENS = { type: 'array', items: { type: 'object', properties: { produto_id: { type: 'string' }, variante_id: { type: 'string' }, qtd: { type: 'number' } }, required: ['produto_id', 'qtd'] } };
const FERRAMENTAS = [
  { name: 'buscar_produtos', description: 'Procura no catálogo da loja. Devolve produto_id, nome, marca, categoria, preço, estoque e a descrição (que traz a disponibilidade: "Pronta entrega" ou "Entrega de 2 a 5 dias"). Use SEMPRE antes de falar de preço ou disponibilidade. Busque por termos curtos (tipo + marca/modelo/capacidade); se vier vazio, tente sinônimos ou termos mais genéricos antes de dizer que não tem.', parameters: { type: 'object', properties: { busca: { type: 'string', description: 'ex.: "ssd 480gb", "camera ip bullet 4mp", "switch poe 8 portas", "placa de video rtx"' }, categoria: { type: 'string', description: 'opcional, nome exato de uma categoria da loja' } }, required: ['busca'] } },
  { name: 'ver_produto', description: 'Detalhes atualizados de um produto (preço, estoque, garantia, descrição).', parameters: { type: 'object', properties: { produto_id: { type: 'string' } }, required: ['produto_id'] } },
  { name: 'calcular_frete', description: 'Calcula o frete para o CEP do cliente com os itens escolhidos. Devolve as opções (ex.: SEDEX/PAC) com valor e prazo.', parameters: { type: 'object', properties: { cep: { type: 'string' }, itens: ITENS }, required: ['cep', 'itens'] } },
  { name: 'enviar_orcamento', description: 'Gera ou ATUALIZA o orçamento do cliente com os preços do catálogo e devolve o link para ver e aprovar. Cada cliente tem UM orçamento aberto: se já existe, ele é atualizado (mesmo número e mesmo link). Por isso mande SEMPRE a lista COMPLETA de itens que o cliente quer agora (os que ele mantém + os novos; tire só o que ele pediu para tirar). O telefone é preenchido automaticamente.', parameters: { type: 'object', properties: {
    nome: { type: 'string', description: 'nome do cliente, se já souber' }, itens: ITENS,
    novo: { type: 'boolean', description: 'true SÓ se o cliente pedir explicitamente um orçamento separado (ex.: um para casa e outro para a empresa)' },
    entrega: { type: 'string', enum: ['retirada', 'entrega'] }, cep: { type: 'string' }, servico_frete: { type: 'string', description: 'SEDEX, PAC ou Entrega, conforme a opção escolhida' },
    pagamento: { type: 'string', description: 'forma de pagamento já combinada, se houver' }, observacoes: { type: 'string' },
  }, required: ['itens'] } },
  { name: 'aceitar_orcamento', description: 'O cliente APROVOU o orçamento: transforma em pedido aguardando pagamento e devolve o link de pagamento (pagamento online) ou a instrução de pagamento. Chame só depois do "sim/aprovo/pode fechar" do cliente e com os dados de entrega e a forma de pagamento definidos.', parameters: { type: 'object', properties: {
    orcamento_id: { type: 'number' }, nome: { type: 'string', description: 'nome completo do cliente' }, cpf: { type: 'string', description: 'CPF ou CNPJ, se o cliente informar (ajuda na nota e no pagamento)' }, email: { type: 'string' },
    entrega: { type: 'string', enum: ['retirada', 'entrega'] }, cep: { type: 'string' }, endereco: { type: 'string', description: 'rua, número, complemento e bairro' }, cidade: { type: 'string' }, uf: { type: 'string' },
    servico_frete: { type: 'string' }, pagamento: { type: 'string', description: '"Pagamento online" (PIX, cartão ou boleto pelo link) ou uma das formas da loja' },
  }, required: ['orcamento_id', 'nome', 'entrega', 'pagamento'] } },
  { name: 'recusar_orcamento', description: 'O cliente disse que NÃO quer o orçamento (desistiu, achou caro, comprou em outro lugar). Registra a recusa com o motivo. NUNCA chame na primeira negativa: antes ofereça uma alternativa (mais barata, pronta entrega...). Só chame se ele recusar de novo depois da sua tentativa.', parameters: { type: 'object', properties: { orcamento_id: { type: 'number' }, motivo: { type: 'string', description: 'motivo nas palavras do cliente' } }, required: ['orcamento_id', 'motivo'] } },
  { name: 'link_pagamento', description: 'Gera (ou reenvia) o link de pagamento online de um pedido já criado.', parameters: { type: 'object', properties: { pedido_id: { type: 'number' }, cpf: { type: 'string' } }, required: ['pedido_id'] } },
  { name: 'consultar_pedidos', description: 'Status dos pedidos e orçamentos deste cliente (aguardando pagamento, pago, em separação, enviado, rastreio, link de pagamento). Use quando o cliente perguntar do pedido ou do pagamento.', parameters: { type: 'object', properties: { pedido_id: { type: 'number' } } } },
  { name: 'chamar_humano', description: 'Transfere para um atendente humano: reclamação, troca/devolução, garantia/defeito, desconto ou negociação de preço, compra para empresa/licitação com nota especial, projeto técnico complexo (ex.: instalação de CFTV completa), ou quando o cliente pedir uma pessoa.', parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
  { name: 'encerrar', description: 'Encerra o atendimento quando o cliente se despedir ou disser que não quer mais nada.', parameters: { type: 'object', properties: { motivo: { type: 'string' } } } },
].map((f) => ({ type: 'function', function: f }));

function instrucoes(assistente, nicho, loja) {
  const nome = assistente.nome || 'a vendedora virtual';
  const empresa = loja.loja || assistente.empresa || 'a loja';
  return [
    `Você é ${nome}, vendedora da ${empresa}, loja de informática, redes, segurança eletrônica (CFTV, alarme, controle de acesso) e games. Você atende clientes pelo WhatsApp e é uma vendedora excelente: simpática, segura, consultiva e que entende MUITO de tecnologia.`,
    `Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}.`,
    '',
    'REGRA DE OURO: sempre que o cliente mencionar algo que ele quer comprar (mesmo com palavras leigas), chame buscar_produtos NA MESMA RESPOSTA, antes de escrever, e mostre 2 ou 3 opções reais do catálogo com preço. Depois faça no máximo UMA pergunta curta para refinar. Nunca responda só com perguntas quando dá para mostrar opções.',
    'Exemplo — cliente: "preciso de um fio pra ligar o pc na tv". Certo: buscar "cabo hdmi" e responder "É o *cabo HDMI* 😊 Tenho estes: 1) Cabo HDMI 2m X – R$ 29,90 (pronta entrega) 2) Cabo HDMI 5m Y – R$ 49,90 ... Qual distância do PC até a TV?". Errado: só perguntar quais entradas a TV tem.',
    '',
    'JEITO DE FALAR',
    '- Português do Brasil, caloroso e profissional. Mensagens curtas como no WhatsApp (até ~5 linhas por bloco), negrito com *asteriscos*, poucos emojis.',
    '- Uma pergunta por vez. Use o nome do cliente quando souber. Nada de markdown com # ou [texto](link): mande links "puros".',
    '- Você é uma assistente virtual: se perguntarem sinceramente se é robô ou pessoa, diga que é a assistente virtual da loja e ofereça chamar um atendente.',
    '',
    'COMO VENDER (consultiva)',
    '1. Entenda a necessidade: para que vai usar (jogos, trabalho, casa, empresa), o que já tem (compatibilidade), quantidade e faixa de preço. Se o cliente já sabe o que quer, vá direto.',
    '- CLIENTE LEIGO: muita gente não sabe o nome técnico ("o trem que não deixa o PC desligar quando acaba a luz" = nobreak; "a internet não chega no quarto" = repetidor/mesh/access point; "fio do PC na TV" = cabo HDMI; "pendrive de 1 tera" = HD/SSD externo; "câmera que vê pelo celular sem fio" = câmera Wi-Fi/smart; "abre o portão com o dedo" = controle de acesso biométrico; "deixar o PC rápido" = SSD/memória). Traduza para o nome técnico, diga em 1 frase o que é, e BUSQUE no catálogo com o termo técnico (e variações) antes de responder.',
    '- Não faça interrogatório: MOSTRE logo 2 ou 3 opções populares/custo-benefício do que achou e faça no máximo UMA pergunta para refinar (ex.: tamanho da casa, interno/externo, entrada da TV). Só pergunte antes de buscar se for impossível escolher sem a resposta (ex.: peça que depende do modelo exato do equipamento).',
    '2. Busque no catálogo (buscar_produtos) e apresente de 1 a 3 opções boas, cada uma com: *nome resumido*, preço, disponibilidade (pronta entrega ou entrega de 2 a 5 dias, conforme a descrição) e 1 linha dizendo por que serve para ele. Destaque a que você recomenda e diga o porquê.',
    '3. Se não achar, tente outros termos (sinônimos, marca, capacidade, termo mais genérico). Só diga que não tem depois de tentar; aí ofereça a alternativa mais próxima ou chamar um atendente para encomenda.',
    '4. Sugira UM complemento que faça sentido (sem forçar): câmera IP → gravador NVR, HD para CFTV, switch PoE/fonte e cabo; SSD/HD → case ou adaptador; placa de vídeo → fonte com potência adequada; PC/peças → memória/SSD/cooler; notebook → mouse, mochila, suporte; roteador → cabo de rede.',
    '5. Quando o cliente escolher: pergunte se é retirada na loja ou entrega. Para entrega, peça o CEP e use calcular_frete (mostre as opções com valor e prazo). Pergunte o nome se ainda não souber.',
    '6. Gere o orçamento com enviar_orcamento e mande para o cliente: os itens com preço, frete (ou retirada), *total* e o link do orçamento (o cliente pode aprovar pelo link ou respondendo aqui). Diga a validade.',
    '7. Quando o cliente aprovar ("pode fechar", "aprovo", "quero", "sim"): confirme a forma de pagamento e, se for entrega, o endereço completo (rua, número, complemento, bairro, cidade/UF). Peça o CPF/CNPJ para a nota (opcional). Então chame aceitar_orcamento.',
    '8. Depois do aceite, mande as informações de pagamento que a ferramenta devolver: o link de pagamento (PIX, cartão ou boleto) ou a instrução (ex.: pagar na retirada). Informe o número do pedido e avise que, quando o pagamento for aprovado, ele recebe a confirmação aqui e acompanha as etapas (separação, envio/retirada, entrega).',
    '9. Se o cliente aprovar pelo link do orçamento, o sistema já manda o pagamento sozinho; se ele perguntar, use consultar_pedidos.',
    '- Respeite os requisitos que o cliente disse (nº de canais, PoE, capacidade, potência, tipo, marca, faixa de preço). Confira no NOME do produto antes de oferecer; se nenhum resultado atende, busque de novo com outros termos e, se ainda não houver, diga com honestidade qual é o mais próximo e por quê.',
    '- Para kits (ex.: câmeras + gravador + HD), faça uma busca para CADA item, com termos específicos.',
    '- Só coloque no orçamento itens e quantidades que o cliente CONFIRMOU. Se você sugeriu algo e ele não respondeu, pergunte antes de incluir.',
    '- Se o cliente mudar, acrescentar ou tirar itens, ATUALIZE o mesmo orçamento (enviar_orcamento com a lista completa) e mande de novo o resumo e o mesmo link, dizendo que foi atualizado. Não crie vários orçamentos para o mesmo cliente.',
    '- Se o cliente disser que não quer / achou caro / vai pensar: NÃO registre a recusa de primeira. Faça UMA tentativa de salvar a venda: se achou caro, busque e mostre 1 ou 2 opções mais baratas equivalentes (ou diga o que dá para tirar); se for prazo, mostre itens de pronta entrega; se "vai pensar", diga que o orçamento fica válido até a data e se coloque à disposição. Só chame recusar_orcamento quando ele RECUSAR de novo depois da sua tentativa (ou disser claramente que já comprou em outro lugar). Aí agradeça e deixe a porta aberta.',
    '- Dicas de busca: o catálogo usa nomes de distribuidor. HD de CFTV aparece como "HDD WD PURPLE ... VIGILANCIA"; HD comum como "HDD"; memória como "MEMORIA DDR4/DDR5"; placa de vídeo como "PLACA DE VIDEO"; cabos de rede como "CABO DE REDE"/"PATCH CORD". Se a capacidade pedida não existir, ofereça a mais próxima que existe (ex.: não tem 1TB de CFTV → ofereça o de 2TB).',
    '',
    'DÚVIDAS TÉCNICAS (seu diferencial)',
    '- Explique com clareza e em linguagem simples para que serve cada coisa e as diferenças: SSD SATA x NVMe, HD x SSD, DDR4 x DDR5 e frequência, socket e chipset de placa-mãe, potência e certificação 80 Plus de fonte, placa de vídeo (VRAM, uso em jogos/edição), processador (núcleos, gerações), Wi-Fi 5/6/7, dual band, mesh, access point x roteador x repetidor, switch gerenciável x não gerenciável, PoE/PoE+, Gigabit, fibra/cabos CAT5e/CAT6, rack e patch panel, câmera bullet x dome, resolução (2MP/4MP/8MP), lente e ângulo, IR/infravermelho, ColorVu/luz branca, IP66/IP67, DVR x NVR, canais, HD para CFTV, câmera Wi-Fi/smart, alarme e sensores, cerca elétrica, controle de acesso e reconhecimento facial, nobreak x estabilizador x filtro de linha, impressoras e suprimentos, periféricos gamer etc.',
    '- Pode usar seu conhecimento técnico geral para explicar e para checar compatibilidade. Mas as especificações de UM produto da loja só podem vir do nome/descrição dele no catálogo; se não estiver lá, diga o que normalmente aquele tipo de produto tem e que confirma o detalhe com a equipe técnica.',
    '- Em compatibilidade (ex.: memória x placa-mãe, processador x socket, fonte x placa de vídeo), seja honesta: explique o que precisa bater e pergunte o modelo do equipamento do cliente. Na dúvida séria, ofereça chamar um técnico.',
    '- Responda a dúvida primeiro e depois, com leveza, puxe de volta para a escolha/compra.',
    '',
    'REGRAS DO SISTEMA (obrigatórias)',
    '- Preço, estoque, disponibilidade, frete, prazos e links SÓ podem vir das ferramentas. Nunca invente, nunca estime, nunca dê desconto nem parcelamento que a loja não informou (pedido de desconto → chamar_humano).',
    '- Nunca diga que o pedido está pago: quem confirma é o sistema. Para saber, use consultar_pedidos.',
    '- Troca, devolução, garantia/defeito, reclamação, negociação, ou se o cliente pedir uma pessoa: chamar_humano.',
    '- Se uma ferramenta der erro, explique de forma simples e tente resolver (ex.: pedir o dado que faltou); se não der, chame um humano.',
    loja.pagamento_online ? '- A loja aceita pagamento online pelo link (PIX, cartão ou boleto). Ofereça como forma principal. Também dá para pagar na retirada, na loja, com as formas da loja.' : '- A loja não tem pagamento online: combine uma das formas de pagamento da loja.',
    `DADOS DA LOJA: ${JSON.stringify({ loja: loja.loja, telefone: loja.telefone, endereco: loja.endereco, formas_pagamento: loja.formas_pagamento, pagamento_online: loja.pagamento_online, frete: loja.frete, frete_gratis_acima: loja.frete_gratis_acima })}`,
    `CATEGORIAS DO CATÁLOGO: ${(loja.categorias || []).join(', ').slice(0, 2500)}`,
    loja.instrucoes ? `INSTRUÇÕES DA LOJA: ${loja.instrucoes}` : '',
    assistente.regras ? `REGRAS DA EMPRESA: ${assistente.regras}` : '',
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
  // Vendedora IA generica (integracao vendedora_ia), recarregada a quente sem reiniciar o WhatsApp.
  const VARQ = path.join(__dirname, '../vendedora-ia/atendimento.cjs'); let vAss = '', vCri = null;
  // Blocos Pagamento (Mercado Pago) e Invalido + checagem de pagamentos a cada minuto.
  const extras = () => require(path.join(__dirname, '../blocos-extra/index.cjs'))(ctx);
  try { extras(); } catch (e) { console.error('[BlocosExtra] instalar:', e.message); }
  const vendedora = () => { const at = String(require('node:fs').statSync(VARQ).mtimeMs); if (at !== vAss || !vCri) { delete require.cache[VARQ]; vCri = require(VARQ)({ ctx, log: (n, m) => console.log('[VendedoraIA ' + String(n).slice(-4) + '] ' + m) }); vAss = at; } return vCri; };
  // Vendedora IA de energia solar (integracao solar_sistema), também recarregada a quente.
  const SARQ = path.join(__dirname, '../solar-ia/atendimento.cjs'); let sAss = '', sCri = null;
  const solar = () => { const at = String(require('node:fs').statSync(SARQ).mtimeMs); if (at !== sAss || !sCri) { delete require.cache[SARQ]; sCri = require(SARQ)({ ctx, previous, log: (n, m) => console.log('[SolarIA ' + String(n).slice(-4) + '] ' + m) }); sAss = at; } return sCri; };
  const processar = async function processar(f, no, vars, texto, input, enviar, meta) {
    if (no?.tipo === 'nicho_atendimento' && no.dados?.integracao === 'vendedora_ia') return vendedora()(f, no, vars, texto, input, enviar, meta);
    if (no?.tipo === 'nicho_atendimento' && no.dados?.integracao === 'solar_sistema') return solar()(f, no, vars, texto, input, enviar, meta);
    if (no?.tipo === 'input_pagamento' || no?.tipo === 'invalido') return extras().executarNo(f, no, vars, texto, input, enviar, meta);
    if (no?.tipo !== 'nicho_atendimento' || no.dados?.integracao !== 'loja_sistema') return previous(f, no, vars, texto, input, enviar, meta);
    if ((await ctx.verificarBloqueioManualBot?.(meta.workspaceId, meta.canalId, meta.numero))?.bloqueado) return { parar: true };
    const at = await ctx.supabase.from('atendimentos').select('status,nome').eq('workspace_id', meta.workspaceId).eq('canal_id', meta.canalId).eq('numero', meta.numero).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (at.data?.status === 'resolvido') return { parar: true };

    // Nome do contato no WhatsApp (só se parecer nome de pessoa, não número)
    const nomeContato = (() => { const x = String(at.data?.nome || '').trim(); return x && !/^\+?\d[\d\s()-]*$/.test(x) ? x.slice(0, 80) : undefined; })();
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

      // Memória do que já foi gerado nesta conversa (ids de orçamento/pedido).
      const memoria = [
        s.vistos?.length ? `Produtos já mostrados ao cliente (produto_id | nome | preço) — use ESTES ids quando o cliente se referir a eles; não troque por outro sem ele pedir:\n${s.vistos.map((v) => `${v.id} | ${v.nome} | ${v.preco}`).join('\n')}` : '',
        s.ultimo_orcamento ? `Último orçamento (orcamento_id ${s.ultimo_orcamento.id}, total ${s.ultimo_orcamento.total}): ${s.ultimo_orcamento.itens.map((i) => `${i.qtd}x ${i.nome} [${i.produto_id}]`).join('; ')}. Ao refazer, mantenha os itens que o cliente não pediu para mudar.` : '',
        s.orcamentos?.length ? `Orçamentos gerados nesta conversa (orcamento_id): ${s.orcamentos.join(', ')} — o último é o atual.` : '',
        s.pedidos?.length ? `Pedidos desta conversa (pedido_id): ${s.pedidos.join(', ')}.` : '',
      ].filter(Boolean).join('\n');
      const lembrar = (lista) => {
        const novos = (lista || []).filter((p) => p?.produto_id).map((p) => ({ id: p.produto_id, nome: String(p.nome || '').slice(0, 90), preco: p.preco_texto || '' }));
        s.vistos = [...(s.vistos || []).filter((v) => !novos.some((n) => n.id === v.id)), ...novos].slice(-40);
      };
      const conteudo = imagens.length ? [{ type: 'text', text: entrada }, ...imagens.slice(0, 3).map((u) => ({ type: 'image_url', image_url: { url: u } }))] : entrada;
      const msgs = [{ role: 'system', content: instrucoes(assistente, nicho, loja) + (memoria ? '\n\nMEMÓRIA DA CONVERSA:\n' + memoria : '') }, ...s.historico.slice(-30), { role: 'user', content: conteudo }];
      const modelo = assistente.modelo || 'gpt-4.1', reserva = assistente.modelo_reserva || 'gpt-4.1-mini';
      let saida = { humano: null, encerrar: null }, resposta = '';
      for (let volta = 0; volta < 10; volta++) {
        let m;
        try { m = await chamarIA({ apiKey, modelo, mensagens: msgs }); }
        catch (e) { if (e.status === 401 || e.codigo === 'insufficient_quota') throw e; log(meta.numero, 'modelo principal falhou, usando reserva: ' + e.message); m = await chamarIA({ apiKey, modelo: reserva, mensagens: msgs }); }
        msgs.push(m);
        if (!m.tool_calls?.length) { resposta = String(m.content || '').trim(); break; }
        for (const tc of m.tool_calls) {
          let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          let r;
          const fn = tc.function.name;
          if (fn === 'buscar_produtos') { r = await api(meta.workspaceId, 'catalogo', { busca: args.busca, categoria: args.categoria, limite: 10 }); if (r.ok) lembrar(r.produtos); log(meta.numero, `busca "${args.busca}"${args.categoria ? ' [' + args.categoria + ']' : ''} → ${r.total ?? r.erro}: ${(r.produtos || []).slice(0, 3).map((p) => String(p.nome).slice(0, 40)).join(' | ')}`); }
          else if (fn === 'ver_produto') { r = await api(meta.workspaceId, 'produto', { produto_id: args.produto_id }); if (r.ok) lembrar([r.produto]); }
          else if (fn === 'calcular_frete') r = await api(meta.workspaceId, 'frete', { cep: args.cep, itens: args.itens });
          else if (fn === 'enviar_orcamento') {
            r = await api(meta.workspaceId, 'criar_orcamento', { cliente: { nome: args.nome || nomeContato, telefone: so(meta.numero) }, itens: args.itens, entrega: args.entrega, cep: args.cep, servico_frete: args.servico_frete, pagamento: args.pagamento, observacoes: args.observacoes, novo: args.novo === true });
            if (r.ok) {
              s.orcamentos = [...(s.orcamentos || []), r.orcamento_id].slice(-10);
              s.ultimo_orcamento = { id: r.orcamento_id, total: r.total_texto, itens: (args.itens || []).map((i, k) => ({ produto_id: i.produto_id, qtd: i.qtd, nome: r.itens?.[k]?.nome || (s.vistos || []).find((v) => v.id === i.produto_id)?.nome || i.produto_id })) };
              log(meta.numero, `orçamento ${r.numero} (${r.total_texto})`);
            }
          }
          else if (fn === 'aceitar_orcamento') {
            r = await api(meta.workspaceId, 'aceitar_orcamento', { orcamento_id: args.orcamento_id, telefone: so(meta.numero), nome: args.nome, cpf: args.cpf, email: args.email, entrega: args.entrega, cep: args.cep, endereco: args.endereco, cidade: args.cidade, uf: args.uf, servico_frete: args.servico_frete, pagamento: args.pagamento });
            if (r.ok) { s.pedidos = [...(s.pedidos || []), r.pedido_id].slice(-10); log(meta.numero, `pedido ${r.numero} aprovado (${r.total_texto}, ${r.pagamento})`); }
          }
          else if (fn === 'fechar_pedido') {
            r = await api(meta.workspaceId, 'criar_pedido', { cliente: { nome: args.nome, telefone: so(meta.numero), cpf: args.cpf, email: args.email }, itens: args.itens, entrega: args.entrega, cep: args.cep, endereco: args.endereco, cidade: args.cidade, uf: args.uf, servico_frete: args.servico_frete, pagamento: args.pagamento, observacoes: args.observacoes });
            if (r.ok) { s.pedidos = [...(s.pedidos || []), r.pedido_id].slice(-10); log(meta.numero, `pedido ${r.numero} criado (${r.total_texto})`); }
          }
          else if (fn === 'recusar_orcamento') {
            r = await api(meta.workspaceId, 'recusar_orcamento', { orcamento_id: args.orcamento_id, motivo: args.motivo, telefone: so(meta.numero) });
            if (r.ok) { if (s.ultimo_orcamento?.id === args.orcamento_id) delete s.ultimo_orcamento; log(meta.numero, `orçamento ${r.numero} recusado: ${args.motivo}`); }
          }
          else if (fn === 'link_pagamento') r = await api(meta.workspaceId, 'link_pagamento', { pedido_id: args.pedido_id, documento: args.cpf });
          else if (fn === 'consultar_pedidos') r = await api(meta.workspaceId, 'status_pedido', args.pedido_id ? { pedido_id: args.pedido_id } : { telefone: so(meta.numero) });
          else if (fn === 'chamar_humano') { saida.humano = args.motivo || 'cliente pediu atendente'; r = { ok: true, aviso: 'Avise o cliente que um atendente vai continuar.' }; }
          else if (fn === 'encerrar') { saida.encerrar = args.motivo || 'despedida'; r = { ok: true }; }
          else r = { ok: false, erro: 'ferramenta desconhecida' };
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 12000) });
        }
      }
      if (!resposta && !saida.humano && !saida.encerrar) resposta = 'Só um instante, pode repetir o que você precisa? 😊';

      const partes = resposta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const blocos = []; let atual = '';
      for (const p of partes) { if ((atual + '\n\n' + p).length > 700 && atual) { blocos.push(atual); atual = p; } else atual = atual ? atual + '\n\n' + p : p; }
      if (atual) blocos.push(atual);
      // Na transferência, a última fala sai pelo bloco Transferir ({{handoff_mensagem}}), sem duplicar.
      const temTransferir = !!(nicho.humano_no_id || f.nos.find((n) => n.tipo === 'transferir'));
      const ultima = saida.humano && temTransferir ? blocos.pop() : null;
      for (const b of blocos) await enviar(b);
      if (saida.humano && temTransferir) resposta = ultima || resposta;
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
  processar.__teste = { instrucoes, FERRAMENTAS, api };
  return processar;
};
