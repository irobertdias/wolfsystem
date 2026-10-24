'use strict';
const fs = require('node:fs'), path = require('node:path'), { createHash, randomBytes } = require('node:crypto');
const { criarConsulta } = require('./vtal.cjs'), { criarInterpretador } = require('./interpretacao.cjs');
const { inicial, avancar, resumo } = require('./conversa.cjs'), { planosDaCidade } = require('./planos-grupoprime.cjs');
const WS = 'grupoprime', KEY = '__universal_v1';
const parse = v => { try {
    return typeof v === 'string' ? JSON.parse(v) : v || {};
}
catch {
    return {};
} };
const telefoneBko = v => { const n = String(v || '').replace(/\D/g, ''); return /^55\d{2}9[6-9]\d{7}$/.test(n) ? n.slice(0, 4) + n.slice(5) : n; };
module.exports = function carregarUniversal(ctx, opcoes = {}) {
    const db = ctx.supabase, base = ctx.executarFluxo, consulta = criarConsulta(), filas = new Map();
    let entregando = false;
    const secreto = opcoes.credencial || JSON.parse(fs.readFileSync(path.join(__dirname, 'credencial.json'), 'utf8'));
    const interprete = opcoes.interprete || criarInterpretador({ ...secreto, catalogo: planosDaCidade });
    ctx.app.get('/universal/health', (_q, r) => r.json({ versao: 1, workspace: WS, nicho: 'telecom', pronto: !!secreto.apiKey, leitura_documentos: secreto.documentosOpenai === true }));
    ctx.app.get('/universal/vtal', async (q, r) => { if (q.query.workspaceId !== WS)
        return r.status(403).json({ success: false }); const entrada = {}; for (const k of ['cep', 'cidade', 'uf', 'logradouro', 'quadra', 'lote', 'numero', 'casa', 'apartamento', 'bloco', 'texto']) {
        if (q.query[k] && String(q.query[k]).length > 500)
            return r.status(400).json({ success: false });
        entrada[k] = String(q.query[k] || '');
    } r.json({ success: true, ...await consulta(entrada) }); });
    async function salvar(fluxo, no, canal, n, s) { const vars = { ...s.dados, plano: s.plano?.nome || '', valor_plano: s.plano?.mensalidade || '', plano_id: s.plano?.id || '', operadora: 'Nio', [KEY]: JSON.stringify(s) }; await ctx.salvarSessaoFluxo(WS, canal, n, fluxo.id, no.id, vars, true, 'assistente_universal'); }
    async function anexar(mensagem, s, canal, n) {
        const anexos = [];
        for (const m of mensagem.matchAll(/\[(?:img|image|file|document):([^\]\r\n]+)\]/gi)) {
            const nome = path.basename(m[1]);
            if (nome !== m[1] || !nome || nome.includes('..'))
                throw Error('Arquivo fora do diretório de mídia');
            const fingerprint = createHash('sha256').update(nome).digest('hex');
            if (s.anexos.some(a => a.origem === fingerprint))
                continue;
            const origem = path.join(ctx.AUDIOS_DIR, nome), buffer = fs.readFileSync(origem);
            if (!buffer.length || buffer.length > 25 * 1024 * 1024)
                throw Error('Não foi possível armazenar o arquivo recebido');
            const ext = path.extname(nome).toLowerCase(), mime = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' })[ext] || 'application/octet-stream';
            const hash = createHash('sha256').update(`${WS}:${canal}:${n}`).digest('hex').slice(0, 24), storagePath = `${WS}/${hash}/arquivos/universal/${fingerprint}${ext}`;
            // Salvar o original ANTES de interpretar; retry reutiliza o mesmo caminho.
            const upload = await db.storage.from('documentos-clientes').upload(storagePath, buffer, { contentType: mime, upsert: true });
            if (upload.error)
                throw upload.error;
            const q = new URLSearchParams({ workspaceId: WS, path: storagePath, nome });
            const meta = { path: storagePath, url: '/api/documentos-clientes/arquivo?' + q, nome, tipo: mime, tamanho: buffer.length, privado: true, origem: fingerprint, enviado_em: new Date().toISOString() };
            const leitura = secreto.documentosOpenai === true ? await interprete.lerDocumento({ buffer, mime, nome, endereco: [s.dados.endereco, s.dados.cidade, s.dados.estado, s.dados.cep].filter(Boolean).join(' '), pendente: !s.documentos.rg_frente.length ? 'rg_frente' : !s.documentos.rg_verso.length ? 'rg_verso' : 'comprovante_endereco' }) : { categorias: [], leitura: 'inconclusiva' };
            anexos.push({ ...meta, ...leitura });
        }
        return anexos;
    }
    async function registrar(fluxo, canal, n, s) {
        const chave = createHash('sha256').update(`${WS}:${fluxo.id}:${canal}:${n}:${s.inicio}`).digest('hex');
        const anterior = await db.from('proposta').select('id').eq('workspace_id', WS).eq('dados_customizados->>universal_chave', chave).limit(2);
        if (anterior.error)
            throw anterior.error;
        if (anterior.data.length > 1)
            throw Error('Pedido exige reconciliação, sem novo cadastro');
        if (anterior.data.length === 1)
            return anterior.data[0].id;
        const d = s.dados, custom = { universal_v1: 'SIM', universal_chave: chave, numero_origem_whatsapp: String(n), plano_id: s.plano.id, velocidade_mbps: s.plano.velocidade_mbps, tipo_pessoa: d.tipo_pessoa, cnpj: d.cnpj || '', bairro: d.bairro, vtal: s.consulta, pendencias_bko: JSON.stringify([...new Set(s.pendencias)]), bko_pendente: 'SIM', universal_entrega: { partes: [], tentativas: 0 }, ...s.documentos };
        const p = { workspace_id: WS, canal_id: Number(canal), fluxo_id: fluxo.id, data_proposta: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), status_venda: 'AGUARDANDO AUDITORIA', operadora: 'Nio', plano: s.plano.nome, valor_plano: s.plano.mensalidade, dados_customizados: custom };
        for (const k of ['nome', 'cpf', 'data_nascimento', 'nome_mae', 'email', 'telefone1', 'vencimento', 'forma_pagamento', 'endereco', 'cidade', 'estado', 'cep'])
            p[k] = d[k] || '';
        const r = await db.from('proposta').insert(p).select('id').single();
        if (r.error)
            throw r.error;
        return r.data.id;
    }
    async function processar(item) {
        const { fluxo, no, canal, n, enviar, mensagens } = item;
        if ((await ctx.verificarBloqueioManualBot(WS, canal, n))?.bloqueado)
            return true;
        const sessao = await ctx.buscarSessaoFluxo(WS, canal, n);
        let s = parse(sessao?.variaveis?.[KEY]);
        if (s.versao !== 1)
            s = { ...inicial(), inicio: new Date().toISOString() };
        if (s.etapa === 'encerrado')
            return true;
        // Entrada é persistida antes da API. Se houver falha, a próxima tentativa retoma o lote.
        s.pendentes = [...(s.pendentes || []), ...mensagens].slice(-30);
        await salvar(fluxo, no, canal, n, s);
        try {
            const texto = s.pendentes.join('\n'), anexos = await anexar(texto, s, canal, n);
            const r = await avancar({ estado: s, entrada: texto, numero: n, extrair: interprete.extrair, consultar: consulta, catalogo: planosDaCidade, anexos, config: no.dados });
            const lotePendente = s.pendentes;
            s = r.estado;
            s.pendentes = [];
            delete s.erro;
            s.repeticoesErro = 0;
            if (s.consulta?.status === 'consulta_inconclusiva') {
                s.pendentes = lotePendente;
                s.retryEm = Date.now() + 60000;
                const avisou = s.instabilidadeAvisada;
                s.instabilidadeAvisada = true;
                await salvar(fluxo, no, canal, n, s);
                if (!avisou)
                    await enviar(r.mensagem);
                return true;
            }
            delete s.instabilidadeAvisada;
            if (r.acao === 'registrar') {
                s.proposta_id = await registrar(fluxo, canal, n, s);
                s.etapa = 'concluido';
                r.mensagem = `✅ *Pedido #${s.proposta_id} registrado!*\nSeus dados e arquivos foram salvos. O encaminhamento à equipe pelo WhatsApp está na fila automática. A análise e a instalação ainda serão confirmadas. Obrigado por escolher a Grupo Prime! 💚`;
            }
            await salvar(fluxo, no, canal, n, s);
            // Se uma nova mensagem chegou durante a interpretação, processe o conjunto
            // antes de perguntar algo que o cliente pode já ter respondido.
            if (filas.get(item.chave)?.mensagens.length && r.acao !== 'registrar')
                return true;
            await enviar(r.mensagem);
            if (r.acao === 'encerrar') {
                const { error } = await db.from('atendimentos').update({ status: 'finalizado', bloqueado_ia: true, bloqueado_fluxo: true, bloqueado_typebot: true }).eq('workspace_id', WS).eq('canal_id', canal).eq('numero', n);
                if (error)
                    throw error;
            }
            if (r.acao === 'registrar')
                setTimeout(() => entregarPendentes().catch(e => console.error('[Universal entrega]', e.message)), 100);
        }
        catch (e) {
            s.erro = String(e.message).slice(0, 250);
            s.repeticoesErro = (s.repeticoesErro || 0) + 1;
            s.retryEm = Date.now() + Math.min(300000, 15000 * s.repeticoesErro);
            await salvar(fluxo, no, canal, n, s);
            console.error('[Universal]', s.erro);
            if (s.repeticoesErro === 1)
                await enviar('Estou com uma instabilidade na consulta, mas seus dados foram preservados. Vou retomar automaticamente daqui, sem precisar começar de novo.');
        }
        return true;
    }
    async function drenar(chave) { const f = filas.get(chave); if (!f || f.rodando)
        return; f.rodando = true; try {
        while (f.mensagens.length) {
            const msgs = f.mensagens.splice(0), esperas = f.esperas.splice(0);
            try {
                await processar({ ...f, mensagens: msgs, chave });
                esperas.forEach(p => p.resolve(true));
            }
            catch (e) {
                esperas.forEach(p => p.reject(e));
            }
        }
    }
    finally {
        filas.delete(chave);
    } }
    ctx.executarFluxo = async function (ws, canal, n, mensagem, enviar, fluxoId, opts = {}) {
        if (ws !== WS)
            return base(ws, canal, n, mensagem, enviar, fluxoId, opts);
        const { data: fluxo, error } = await db.from('fluxos').select('*').eq('workspace_id', WS).eq('id', fluxoId || 0).maybeSingle();
        if (error)
            throw error;
        const no = fluxo?.nos?.find(n => n.tipo === 'assistente_universal' && n.dados?.runtime === 'universal-v1');
        if (!fluxo?.ativo || !no)
            return base(ws, canal, n, mensagem, enviar, fluxoId, opts);
        const destinos = (fluxo.conexoes || []).filter(a => a.de === no.id).map(a => fluxo.nos.find(n => n.id === a.para));
        if (destinos.length !== 1 || destinos[0]?.dados?.nicho !== 'telecom')
            throw Error('Configure um único nicho telecom');
        const configurado = { ...no, dados: { ...no.dados, regrasNicho: destinos[0].dados.regras || '' } };
        const chave = `${ws}:${canal}:${n}`, f = filas.get(chave) || { fluxo, no: configurado, canal, n, enviar, mensagens: [], esperas: [], rodando: false };
        filas.set(chave, f);
        f.mensagens.push(String(mensagem || ''));
        return new Promise((resolve, reject) => { f.esperas.push({ resolve, reject }); if (!f.rodando) {
            clearTimeout(f.timer);
            f.timer = setTimeout(() => drenar(chave).catch(console.error), 1500);
        } });
    };
    async function configBko() { const { data, error } = await db.from('fluxos').select('nos').eq('workspace_id', WS).eq('id', 27).single(); if (error)
        throw error; const cfg = data.nos.find(n => n.id === 'prime_documentos_enviar')?.dados?.bko_configuracao; if (!cfg?.ativo || !cfg.canal_id)
        throw Error('BKO Nio desativado'); return cfg; }
    async function salvarEntrega(p, c, patch = {}) { const { data, error } = await db.from('proposta').update({ dados_customizados: c, updated_at: new Date().toISOString(), ...patch }).eq('workspace_id', WS).eq('id', p.id).eq('updated_at', p.updated_at).select('*').maybeSingle(); if (error)
        throw error; if (!data)
        throw Error('Venda foi atualizada durante o envio'); return data; }
    async function entregar(p) {
        let c = structuredClone(p.dados_customizados), meta = c.universal_entrega || { partes: [], tentativas: 0 };
        const cfg = await configBko(), exatos = cfg.contatos.filter(r => Number(r.canal_trafego_id) === Number(p.canal_id));
        const destinos = exatos.length ? exatos : cfg.contatos;
        if (destinos.length !== 1)
            throw Error('BKO sem destino único para o canal');
        const destino = destinos[0].numero;
        if (meta.numero && meta.numero !== destino)
            throw Error('Destino do BKO mudou durante a entrega; conferir o pedido');
        const canal = await ctx.getConfigCanal(cfg.canal_id);
        if (canal?.workspaceId !== WS || canal.tipo !== 'webjs')
            throw Error('Conecte o canal WebJS configurado no BKO');
        const client = ctx.sessoes[String(cfg.canal_id)]?.client;
        if (!client || ctx.sessoes[String(cfg.canal_id)].status !== 'conectado')
            throw Error('Canal BKO desconectado; venda permanece na fila');
        c.bko_ref = c.bko_ref || `BKO-${p.id}-${randomBytes(8).toString('hex')}`.toUpperCase();
        meta.numero = destino;
        meta.canal_id = cfg.canal_id;
        if (!meta.partes.length) {
            const texto = `✅ *NOVA VENDA · GRUPO PRIME*\n📋 *Pedido #${p.id}*\n\n${resumo({ dados: { ...p, cnpj: c.cnpj, endereco: [p.endereco, c.bairro].filter(Boolean).join(', ') }, plano: { nome: p.plano, mensalidade: Number(p.valor_plano), velocidade_mbps: c.velocidade_mbps || '' } }).split('\nEstá tudo certo?')[0]}\n\n⚠️ *Conferência:* ${parse(c.pendencias_bko).join?.('; ') || 'Conferir os originais recebidos.'}\n\nResponda com APROVADO, CPF REPROVADO, GERADA, AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE ou CANCELADA.\n🔖 #${c.bko_ref}`;
            meta.partes = [{ tipo: 'texto', texto, estado: 'pendente' }, ...[...new Map(['rg_frente', 'rg_verso', 'comprovante_endereco'].flatMap(k => c[k] || []).map(a => [a.path, a])).values()].map(a => ({ tipo: 'arquivo', arquivo: a, estado: 'pendente' }))];
        }
        c.universal_entrega = meta;
        p = await salvarEntrega(p, c);
        for (let i = 0; i < meta.partes.length; i++) {
            const parte = meta.partes[i];
            if (parte.estado === 'enviado')
                continue;
            if (parte.id) {
                const m = await client.getMessageById(parte.id).catch(() => null);
                if (Number(m?.ack) >= 1) {
                    parte.estado = 'enviado';
                    c.universal_entrega = meta;
                    p = await salvarEntrega(p, c);
                    continue;
                }
                if (m?.ack === -1) {
                    parte.estado = 'pendente';
                    delete parte.id;
                }
                else
                    throw Error('Aguardando confirmação do WhatsApp para ' + parte.id);
            }
            if (parte.estado === 'em_envio') {
                // Resultado incerto: procurar a referência única antes de qualquer reenvio.
                const id = await client.getNumberId(destino), chat = id && await client.getChatById(id._serialized);
                const recentes = chat ? await chat.fetchMessages({ limit: 50 }) : [];
                const tag = `#${c.bko_ref}/${i}`, achada = recentes.find(m => m.fromMe && String(m.body || '').includes(tag));
                if (achada) {
                    parte.id = achada.id._serialized;
                    c.universal_entrega = meta;
                    await salvarEntrega(p, c);
                    return;
                }
                throw Error('Envio em reconciliação automática; não reenviar sem confirmação');
            }
            parte.estado = 'em_envio';
            c.universal_entrega = meta;
            p = await salvarEntrega(p, c);
            const tag = `#${c.bko_ref}/${i}`;
            let conteudo = parte.texto, opcoes = {};
            if (parte.tipo === 'arquivo') {
                if (!parte.arquivo.path?.startsWith(WS + '/') || parte.arquivo.path.includes('..'))
                    throw Error('Anexo fora do workspace');
                const { data, error } = await db.storage.from('documentos-clientes').download(parte.arquivo.path);
                if (error)
                    throw error;
                conteudo = new ctx.MessageMedia(parte.arquivo.tipo, Buffer.from(await data.arrayBuffer()).toString('base64'), parte.arquivo.nome);
                opcoes = { sendMediaAsDocument: true, caption: tag };
            }
            else
                conteudo += '\n' + tag;
            const enviada = await enviarBko(client, destino, conteudo, opcoes);
            if (!enviada?.id?._serialized)
                throw Error('WhatsApp não retornou recibo');
            parte.id = enviada.id._serialized;
            c.bko_reply_ids = [...new Set([...(c.bko_reply_ids || []), parte.id])];
            c.universal_entrega = meta;
            p = await salvarEntrega(p, c);
            await confirmarBko(client, parte.id, enviada.ack);
            parte.estado = 'enviado';
            c.universal_entrega = meta;
            p = await salvarEntrega(p, c);
        }
        meta.concluido = true;
        c.universal_entrega = meta;
        c.bko_pendente = 'ENVIADO';
        c.bko_erro = '';
        await salvarEntrega(p, c);
    }
    async function entregarPendentes() {
        if (entregando)
            return;
        entregando = true;
        try {
            const { data, error } = await db.from('proposta').select('*').eq('workspace_id', WS).eq('dados_customizados->>universal_v1', 'SIM').in('dados_customizados->>bko_pendente', ['SIM', 'AGUARDANDO']).order('id').limit(15);
            if (error)
                throw error;
            for (const p of data || []) {
                if (Number(p.dados_customizados?.universal_entrega?.tentarEm) > Date.now())
                    continue;
                try {
                    await entregar(p);
                }
                catch (e) {
                    const { data: atual } = await db.from('proposta').select('*').eq('workspace_id', WS).eq('id', p.id).single();
                    if (!atual)
                        continue;
                    const c = structuredClone(atual.dados_customizados);
                    c.bko_pendente = 'AGUARDANDO';
                    c.bko_erro = e.message;
                    c.universal_entrega = { ...c.universal_entrega, tentarEm: Date.now() + 60000 };
                    await salvarEntrega(atual, c).catch(() => { });
                    console.error('[Universal BKO]', e.message);
                }
            }
        }
        finally {
            entregando = false;
        }
    }
    const retornoAnterior = ctx.tratarRetornoBko;
    ctx.tratarRetornoBko = async (entrada) => {
        if (entrada.workspaceId !== WS || !entrada.verificado)
            return retornoAnterior?.(entrada) || false;
        const { interpretarRetornoBko, transicaoBkoPermitida } = require('../bko-ia-regras.js');
        const r = interpretarRetornoBko(entrada.mensagem || '');
        if (!r)
            return retornoAnterior?.(entrada) || false;
        let q = db.from('proposta').select('*').eq('workspace_id', WS).eq('dados_customizados->>universal_v1', 'SIM');
        q = r.referencia ? q.eq('dados_customizados->>bko_ref', r.referencia) : q.contains('dados_customizados', { bko_reply_ids: [entrada.quotedId || ''] });
        const { data, error } = await q.limit(2);
        if (error)
            throw error;
        if (data?.length !== 1)
            return retornoAnterior?.(entrada) || false;
        const p = data[0], c = p.dados_customizados, meta = c.universal_entrega;
        const n = String(entrada.numero || '').replace(/\D/g, '');
        if (!meta?.concluido || telefoneBko(n) !== telefoneBko(meta.numero) || Number(entrada.canalId) !== Number(meta.canal_id) || !entrada.messageId)
            return true;
        if (entrada.quotedId && !c.bko_reply_ids?.includes(entrada.quotedId))
            return true;
        if (!transicaoBkoPermitida(p.status_venda, r.status))
            return true;
        if (c.bko_retornos?.some(e => e.message_id === entrada.messageId))
            return true;
        c.bko_retornos = [...(c.bko_retornos || []), { message_id: entrada.messageId, status: r.status, em: new Date().toISOString() }];
        const baseline = await db.from('crm_automacao_estado').upsert({ workspace_id: WS, proposta_id: p.id, snapshot: p, proposta_updated_at: p.updated_at }, { onConflict: 'proposta_id', ignoreDuplicates: true });
        if (baseline.error)
            throw baseline.error;
        await salvarEntrega(p, c, { status_venda: r.status, ...(r.data_agendamento ? { data_agendamento: r.data_agendamento } : {}), ...(r.periodo_instalacao ? { periodo_instalacao: r.periodo_instalacao } : {}) });
        return true;
    };
    // Tentativas pendentes sobrevivem a reinício. Usa o canal e o contato persistidos.
    async function retomarPendentes() { const { data } = await db.from('fluxo_sessoes').select('*').eq('workspace_id', WS).eq('status', 'ativo').eq('tipo_input_aguardado', 'assistente_universal').limit(100); for (const row of data || []) {
        const s = parse(row.variaveis?.[KEY]);
        if (!s.pendentes?.length || Number(s.retryEm) > Date.now())
            continue;
        const chave = `${WS}:${row.canal_id}:${row.numero}`;
        if (filas.has(chave))
            continue;
        await ctx.executarFluxo(WS, row.canal_id, row.numero, '', async (m) => { const c = await ctx.getConfigCanal(row.canal_id); if (c?.tipo !== 'webjs')
            throw Error('Canal indisponível'); const client = ctx.sessoes[String(row.canal_id)]?.client; if (!client)
            throw Error('Canal desconectado'); await require('../bko-roteamento.js').enviar(client, row.numero, m); await ctx.salvarMensagem(WS, row.canal_id, c.fila, row.numero, m, 'bot', 'BOT', null); }, row.fluxo_id).catch(e => console.error('[Universal retomada]', e.message));
    } }
    const enviarBko = opcoes.enviarBko || ((...args) => require('../bko-roteamento.js').enviar(...args));
    const confirmarBko = opcoes.confirmarBko || ((...args) => require('../bko-recibo.js').confirmar(...args));
    const timer = setInterval(() => { entregarPendentes().catch(console.error); retomarPendentes().catch(console.error); }, 20000);
    timer.unref();
    ctx.universalV1 = true;
    if (opcoes.teste)
        ctx.universalTeste = { registrar, entregar, filas, parar: () => clearInterval(timer) };
    return ctx;
};
