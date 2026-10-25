'use strict';
const fs = require('node:fs'), path = require('node:path'), { createHash, randomBytes } = require('node:crypto');
const { criarConsulta } = require('./vtal.cjs'), { criarInterpretador } = require('./interpretacao.cjs');
const { inicial, avancar, resumo } = require('./conversa.cjs'), { planosDaCidade } = require('./planos-grupoprime.cjs');
const { conclusaoUniversalInicial } = require('./configuracao-universal.cjs');
const { incorporar, pendente } = require('./documentos.cjs');
const {prepararEntrega,confirmarEntrega}=require('./entrega-resposta.cjs');
const etiquetasVendas=require('./etiquetas-vendas.cjs');
const {finalizarConversa}=require('./finalizar-conversa.cjs');
const KEY = '__universal_v1';
const parse = v => { try {
    return typeof v === 'string' ? JSON.parse(v) : v || {};
}
catch {
    return {};
} };
const telefoneBko = v => { const n = String(v || '').replace(/\D/g, ''); return /^55\d{2}9[6-9]\d{7}$/.test(n) ? n.slice(0, 4) + n.slice(5) : n; };
module.exports = function carregarUniversal(ctx, opcoes = {}) {
    const WS=opcoes.workspace||'grupoprime';
    const {registro,modelo,configuracao}=require('./modelo-vendas.cjs');
    const db = ctx.supabase, base = ctx.executarFluxo, consulta = opcoes.consulta||criarConsulta(), filas = new Map();
    const enviarCliente=(client,numero,mensagem)=>typeof ctx.enviarTextoWebjs==='function'?ctx.enviarTextoWebjs(client,numero,mensagem):require('../bko-roteamento.js').enviar(client,numero,mensagem);
    let entregando = false;
    const secreto = opcoes.credencial || JSON.parse(fs.readFileSync(path.join(__dirname, 'credencial.json'), 'utf8'));
    const interprete = opcoes.interprete || criarInterpretador({ ...secreto, catalogo: planosDaCidade });
    if(!opcoes.semRotas)ctx.app.get('/universal/health', (_q, r) => r.json({ versao: ctx.universalConfiguravel?2:1, workspace: WS, nicho: 'telecom', pronto: !!secreto.apiKey, leitura_documentos: secreto.documentosOpenai === true, enderecos_versao:'20261024-v2', consulta_endereco_sem_cep:true, prompt_configuravel: true, conclusao_configuravel: true, documentos_em_lote: true, pos_venda: true, configuracao_multitenant: ctx.universalConfiguravel===true }));
    if(!opcoes.semRotas)ctx.app.get('/universal/vtal', async (q, r) => { if (q.query.workspaceId !== WS)
        return r.status(403).json({ success: false }); const entrada = {}; for (const k of ['cep', 'cidade', 'uf', 'logradouro', 'quadra', 'lote', 'numero', 'casa', 'apartamento', 'bloco', 'texto']) {
        if (q.query[k] && String(q.query[k]).length > 500)
            return r.status(400).json({ success: false });
        entrada[k] = String(q.query[k] || '');
    } r.json({ success: true, ...await consulta(entrada) }); });
    async function salvar(fluxo, no, canal, n, s) { const vars = { ...s.dados, plano: s.plano?.nome || '', valor_plano: s.plano?.mensalidade || '', plano_id: s.plano?.id || '', operadora: 'Nio', proposta_id:s.proposta_id?String(s.proposta_id):'', [KEY]: JSON.stringify(s) }; await ctx.salvarSessaoFluxo(WS, canal, n, fluxo.id, no.id, vars, true, 'assistente_universal'); }
    async function anexar(mensagem, s, canal, n, persistir = async () => {}, config = {}) {
        const anexos = [];
        for (const m of mensagem.matchAll(/\[(?:img|image|file|document):([^\]\r\n]+)\]/gi)) {
            const nome = path.basename(m[1]);
            if (nome !== m[1] || !nome || nome.includes('..'))
                throw Error('Arquivo fora do diretório de mídia');
            const fingerprint = createHash('sha256').update(nome).digest('hex');
            const existente=s.anexos.find(a => a.origem === fingerprint);
            if (existente) {
                anexos.push(existente);
                continue;
            }
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
            const leitor=config.apiKey||config.modelo?criarInterpretador({...secreto,apiKey:config.apiKey||secreto.apiKey,model:config.modelo||secreto.model,catalogo:planosDaCidade}):interprete;
            const autorizado=config.autorizar_leitura_documentos===undefined?secreto.documentosOpenai===true:config.autorizar_leitura_documentos===true;
            const leitura = autorizado ? await leitor.lerDocumento({ buffer, mime, nome, endereco: [s.dados.endereco, s.dados.cidade, s.dados.estado, s.dados.cep].filter(Boolean).join(' '), pendente: pendente(s) }) : { categorias: [], leitura: 'inconclusiva' };
            const arquivo = { ...meta, ...leitura };
            incorporar(s, arquivo);
            await persistir();
            anexos.push(arquivo);
        }
        return anexos;
    }
    async function registrar(fluxo, canal, n, s, conclusao = conclusaoUniversalInicial()) {
        if (conclusao.crm === false) throw Error('Cadastro automático no CRM está desativado neste bloco.');
        const chave = createHash('sha256').update(`${WS}:${fluxo.id}:${canal}:${n}:${s.inicio}`).digest('hex');
        const anterior = await db.from('proposta').select('id').eq('workspace_id', WS).eq('dados_customizados->>universal_chave', chave).limit(2);
        if (anterior.error)
            throw anterior.error;
        if (anterior.data.length > 1)
            throw Error('Pedido exige reconciliação, sem novo cadastro');
        if (anterior.data.length === 1){await etiquetasVendas.venda(db,WS,canal,n,anterior.data[0].id);return anterior.data[0].id;}
        const d = s.dados, custom = { universal_v1: 'SIM', universal_chave: chave, numero_origem_whatsapp: String(n), plano_id: s.plano?.id||'', velocidade_mbps: s.plano?.velocidade_mbps||'', tipo_pessoa: d.tipo_pessoa, cnpj: d.cnpj || '', bairro: d.bairro, vtal: s.consulta, pendencias_bko: JSON.stringify([...new Set([...(s.pendencias||[]),...(s.documentosDispensados?.length?['FALTA PEGAR DOCUMENTO']:[])])]), bko_pendente: conclusao.whatsapp === false ? 'DESATIVADO' : 'SIM', envio_whatsapp_ativo: conclusao.whatsapp !== false, universal_entrega: { partes: [], tentativas: 0 }, ...s.documentos,universal_documentos:s.anexos||[],documentos_dispensados:s.documentosDispensados||[],observacao_documentos:s.documentosDispensados?.length?'FALTA PEGAR DOCUMENTO':'',observacao_bko_documentos:s.documentosDispensados?.length?(s.observacaoBkoDocumentos||'CLIENTE NÃO ACEITOU ENVIAR DOCUMENTAÇÃO'):'',universal_conclusao:conclusao,universal_resumo:s.resumoPersonalizado||'',universal_variaveis:s.variaveisPublicas||{} };
        const mapeado=registro({...s.variaveisPublicas,...d,plano:s.plano?.nome||d.plano||'',valor_plano:s.plano?.mensalidade??d.valor_plano??'',operadora:d.operadora||(s.consulta?'Nio':'')},conclusao);Object.assign(custom,mapeado.custom);
        const p = { workspace_id: WS, canal_id: Number(canal), fluxo_id: fluxo.id, data_proposta: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), status_venda: conclusao.status_inicial||'AGUARDANDO AUDITORIA', dados_customizados: custom };
        Object.assign(p,mapeado.campos);p.status_venda=conclusao.status_inicial||p.status_venda||'AGUARDANDO AUDITORIA';
        const r = await db.from('proposta').insert(p).select('id').single();
        if (r.error)
            throw r.error;
        await etiquetasVendas.venda(db,WS,canal,n,r.data.id);
        return r.data.id;
    }
    async function processar(item) {
        const { fluxo, no, canal, n, enviar, mensagens } = item;
        if ((await ctx.verificarBloqueioManualBot(WS, canal, n))?.bloqueado)
            return true;
        const sessao = await ctx.buscarSessaoFluxo(WS, canal, n);
        let s = parse(sessao?.variaveis?.[KEY]);
        const retentativaDestino=s.erro==='WhatsApp não confirmou o destinatário configurado';
        if (s.versao !== 1)
            s = { ...inicial(), inicio: new Date().toISOString() };
        if (s.etapa === 'encerrado')
            return true;
        const agenda=!s.proposta_id&&ctx.lembretesUniversal?.receber(s,mensagens.join('\n'),no.dados);
        if(agenda){await salvar(fluxo,no,canal,n,s);await enviar(agenda);s.historico=[...(s.historico||[]),{role:'user',content:mensagens.join('\n')},{role:'assistant',content:agenda}].slice(-40);await salvar(fluxo,no,canal,n,s);return true;}
        if (s.proposta_id && s.etapa === 'concluido') {
            const {data:pedido,error} = await db.from('proposta').select('*').eq('workspace_id',WS).eq('id',s.proposta_id).single();
            if(error)throw error;
            const resposta = await posVenda.cliente(pedido,mensagens.join('\n'));
            if(resposta) { await enviar(resposta.mensagem);return true; }
        }
        // Entrada é persistida antes da API. Se houver falha, a próxima tentativa retoma o lote.
        const novaEntrada=mensagens.some(m=>String(m||'').trim());
        s.pendentes = [...(s.pendentes || []), ...mensagens].filter(m=>String(m||'').trim()).slice(-30);
        await salvar(fluxo, no, canal, n, s);
        try {
            const texto = s.pendentes.join('\n'), anexos = await anexar(texto, s, canal, n, () => salvar(fluxo, no, canal, n, s),no.dados);
            const entradaChave=createHash('sha256').update(texto).digest('hex');
            const retomadaInterpretada=!novaEntrada&&s.entradaInterpretadaChave===entradaChave;
            const ia=no.dados.apiKey||no.dados.modelo?criarInterpretador({...secreto,apiKey:no.dados.apiKey||secreto.apiKey,model:no.dados.modelo||secreto.model,catalogo:planosDaCidade}):interprete;
            const r = await avancar({ estado: s, entrada: retomadaInterpretada?'':texto, numero: n, extrair: ia.extrair, consultar: consulta, catalogo: planosDaCidade, anexos, config: no.dados });
            const lotePendente = s.pendentes;
            s = r.estado;
            prepararEntrega(s,r);
            if(r.inviavel)await etiquetasVendas.inviavel(db,WS,canal,n);
            else if(s.enderecosInviaveis?.length&&s.consulta?.status==='disponivel_na_base')await etiquetasVendas.limparInviavel(db,WS,canal,n);
            s.entradaInterpretadaChave=entradaChave;
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
                const conclusao = { ...conclusaoUniversalInicial(), ...no.dados.conclusao };
                if (conclusao.crm === false) {
                    r.mensagem = 'Recebi seus dados e arquivos. Eles ficaram preservados neste atendimento para a equipe continuar o pedido.';
                } else {
                    s.proposta_id = await registrar(fluxo, canal, n, s, conclusao);
                    r.mensagem = `✅ *Pedido #${s.proposta_id} registrado no CRM!*\n${s.documentosDispensados?.length?'Seus dados foram salvos, com a documentação pendente para conferência pela equipe.':'Seus dados e arquivos foram salvos.'} ${conclusao.whatsapp === false ? 'A equipe vai acompanhar o pedido no sistema.' : 'O encaminhamento à equipe pelo WhatsApp está na fila automática.'} A análise e a instalação ainda serão confirmadas. Obrigado por escolher a Grupo Prime! 💚`;
                    if(conclusao.mensagem_sucesso)r.mensagem=modelo(conclusao.mensagem_sucesso,{...s.dados,proposta_id:s.proposta_id,plano:s.plano?.nome||'',valor_plano:s.plano?.mensalidade||''});
                }
                s.etapa = 'concluido';
            }
            await salvar(fluxo, no, canal, n, s);
            // Se uma nova mensagem chegou durante a interpretação, processe o conjunto
            if(r.inviavel&&r.acao==='encerrar'){
                try{await enviar(r.mensagem);}catch(e){console.error('[Universal aviso inviável]',e.message);}finally{await finalizarConversa(db,WS,canal,n);}
                return true;
            }
            // antes de perguntar algo que o cliente pode já ter respondido.
            if (filas.get(item.chave)?.mensagens.length && !['registrar','encerrar'].includes(r.acao))
                return true;
            if(novaEntrada||r.acao||retentativaDestino||s.ultimaEtapaEnviada!==s.etapa){await enviar(r.mensagem);confirmarEntrega(s,r);}
            s.ultimaEtapaEnviada=s.etapa;
            delete s.retryEm;
            await salvar(fluxo, no, canal, n, s);
            if (r.acao === 'encerrar') {
                await finalizarConversa(db,WS,canal,n);
            }
            if (r.acao === 'registrar')
                setTimeout(() => entregarPendentes().catch(e => console.error('[Universal entrega]', e.message)), 100);
            if(r.acao==='registrar'&&no.dados.conclusao?.continuar_fluxo!==false){
                const nichoId=fluxo.conexoes.find(a=>a.de===no.id&&Number(a.saidaIndex)===0)?.para;
                const finalId=fluxo.conexoes.find(a=>a.de===nichoId&&Number(a.saidaIndex)===0)?.para;
                const seguinte=fluxo.conexoes.find(a=>a.de===finalId&&Number(a.saidaIndex)===0)?.para;
                if(seguinte)await base(WS,canal,n,'',enviar,fluxo.id,{forcarNovaSessao:true,iniciarNoId:seguinte,variaveisIniciais:{...s.dados,proposta_id:String(s.proposta_id),plano:s.plano?.nome||'',valor_plano:String(s.plano?.mensalidade||'')}});
            }
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
    if(!opcoes.semEnvolver)ctx.executarFluxo = async function (ws, canal, n, mensagem, enviar, fluxoId, opts = {}) {
        if (ws !== WS || opts.proposta || opts.iniciarNoId)
            return base(ws, canal, n, mensagem, enviar, fluxoId, opts);
        if(await posVenda.interceptarAlternativa(canal,n,mensagem,enviar))return true;
        const { data: fluxo, error } = await db.from('fluxos').select('*').eq('workspace_id', WS).eq('id', fluxoId || 0).maybeSingle();
        if (error)
            throw error;
        const no = fluxo?.nos?.find(n => n.tipo === 'assistente_universal' && n.dados?.runtime === 'universal-v1');
        if (!fluxo?.ativo || !no)
            return base(ws, canal, n, mensagem, enviar, fluxoId, opts);
        const destinos = (fluxo.conexoes || []).filter(a => a.de === no.id).map(a => fluxo.nos.find(n => n.id === a.para));
        if (destinos.length !== 1 || destinos[0]?.dados?.nicho !== 'telecom')
            throw Error('Configure um único nicho telecom');
        const finais = (fluxo.conexoes || []).filter(a => a.de === destinos[0].id && Number(a.saidaIndex) === 0).map(a => fluxo.nos.find(n => n.id === a.para));
        if (finais.length > 1 || (finais.length === 1 && finais[0]?.tipo !== 'concluir_venda_universal')) throw Error('Conecte o nicho a uma única conclusão de venda.');
        const conclusao = { ...conclusaoUniversalInicial(), ...(finais[0]?.dados || {}) };
        if (conclusao.crm === false && conclusao.whatsapp === true) throw Error('O WhatsApp depende do cadastro no CRM.');
        if(Array.isArray(destinos[0].dados.coleta))return base(ws,canal,n,mensagem,enviar,fluxoId,opts);
        const configurado = { ...no, dados: { ...no.dados, regrasNicho: destinos[0].dados.regras || '', promptNicho: destinos[0].dados.prompt || '', conclusao } };
        const chave = `${ws}:${canal}:${n}`, f = filas.get(chave) || { fluxo, no: configurado, canal, n, enviar, mensagens: [], esperas: [], rodando: false };
        filas.set(chave, f);
        f.mensagens.push(String(mensagem || ''));
        return new Promise((resolve, reject) => { f.esperas.push({ resolve, reject }); if (!f.rodando) {
            clearTimeout(f.timer);
            f.timer = setTimeout(() => drenar(chave).catch(console.error), 1500);
        } });
    };
    async function configBko(){const cfg=await configuracao(db,WS);if(!cfg?.ativo||!cfg.canal_id)throw Error('Configure e ative o BKO deste workspace.');return cfg;}
    async function salvarEntrega(p, c, patch = {}) { if(Array.isArray(c.universal_acoes)) c.universal_pos_pendente=c.universal_acoes.some(a=>!['enviado','cancelado'].includes(a.estado))||require('./alternativa-nio-bko.cjs').pendente(c)?'SIM':'NAO'; const { data, error } = await db.from('proposta').update({ dados_customizados: c, updated_at: new Date().toISOString(), ...patch }).eq('workspace_id', WS).eq('id', p.id).eq('updated_at', p.updated_at).select('*').maybeSingle(); if (error)
        throw error; if (!data)
        throw Error('Venda foi atualizada durante o envio'); return data; }
    async function entregar(p) {
        let c = structuredClone(p.dados_customizados), meta = c.universal_entrega || { partes: [], tentativas: 0 };
        if (c.envio_whatsapp_ativo === false || c.bko_pendente === 'DESATIVADO') return;
        const cfg = await configBko(), porCanal = cfg.contatos.filter(r => Number(r.canal_trafego_id) === Number(p.canal_id));
        const porOperadora=porCanal.filter(r=>r.operadora&&String(r.operadora).trim().toUpperCase()===String(p.operadora||'').trim().toUpperCase());
        const exatos=porOperadora.length?porOperadora:porCanal.filter(r=>!r.operadora);
        const destinos = cfg.modo==='por_canal'?exatos:(exatos.length?exatos:cfg.contatos);
        if (destinos.length !== 1)
            throw Error('BKO sem destino único para o canal');
        const destino = destinos[0].numero;
        const canalEnvio=destinos[0].canal_envio_id||cfg.canal_id;
        if(meta.canal_id&&Number(meta.canal_id)!==Number(canalEnvio))throw Error('Remetente do BKO mudou durante a entrega; conferir o pedido.');
        if (meta.numero && meta.numero !== destino)
            throw Error('Destino do BKO mudou durante a entrega; conferir o pedido');
        const canal = await ctx.getConfigCanal(canalEnvio);
        if (canal?.workspaceId !== WS || canal.tipo !== 'webjs')
            throw Error('Conecte o canal WebJS configurado no BKO');
        const client = ctx.sessoes[String(canalEnvio)]?.client;
        if (!client || ctx.sessoes[String(canalEnvio)].status !== 'conectado')
            throw Error('Canal BKO desconectado; venda permanece na fila');
        c.bko_ref = c.bko_ref || `BKO-${p.id}-${randomBytes(8).toString('hex')}`.toUpperCase();
        meta.numero = destino;
        meta.canal_id = canalEnvio;
        if (!meta.partes.length) {
            const textoPadrao = `✅ *NOVA VENDA*\n📋 *Pedido #${p.id}*\n\n${resumo({ dados: { ...p, cnpj: c.cnpj, endereco: [p.endereco, c.bairro].filter(Boolean).join(', ') }, plano: { nome: p.plano, mensalidade: Number(p.valor_plano), velocidade_mbps: c.velocidade_mbps || '' } }).split('\nEstá tudo certo?')[0]}\n\n⚠️ *Conferência:* ${parse(c.pendencias_bko).join?.('; ') || 'Conferir os originais recebidos.'}\n\nResponda com APROVADO, CPF REPROVADO, GERADA, AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE ou CANCELADA.\n🔖 #${c.bko_ref}`;
            let texto=modelo(c.universal_conclusao?.mensagem_bko||cfg.mensagem_venda||textoPadrao,{...p,...c.universal_variaveis,proposta_id:p.id,resumo:c.universal_resumo||resumo({dados:p,plano:{nome:p.plano||'',mensalidade:Number(p.valor_plano)||0,velocidade_mbps:c.velocidade_mbps||''}}).split('Está tudo certo?')[0]});
            if(c.documentos_dispensados?.length){const obs=c.observacao_bko_documentos||'CLIENTE NÃO ACEITOU ENVIAR DOCUMENTAÇÃO';if(!texto.includes(obs))texto+='\n\n⚠️ *Observação:* '+obs;const nota=(parse(c.pendencias_bko)||[]).filter(p=>p.includes('cliente manteve a recusa')).join('; ');if(nota&&!texto.includes(nota))texto+='\n\n⚠️ '+nota;}
            meta.partes = [{ tipo: 'texto', texto, estado: 'pendente' }, ...[...new Map([...(c.universal_documentos||[]),...['rg_frente', 'rg_verso', 'comprovante_endereco'].flatMap(k => c[k] || [])].map(a => [a.path, a])).values()].map(a => ({ tipo: 'arquivo', arquivo: a, estado: 'pendente' }))];
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
            parte.ack = Math.max(1,Number(enviada.ack)||1);
            parte.enviado_em = new Date().toISOString();
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
    let conferindoRecibos = false;
    async function atualizarRecibos() {
        if(conferindoRecibos)return;conferindoRecibos=true;
        try {
            const r=await db.from('proposta').select('*').eq('workspace_id',WS).eq('dados_customizados->>universal_v1','SIM').eq('dados_customizados->>bko_pendente','ENVIADO').order('id',{ascending:false}).limit(20);
            if(r.error)throw r.error;
            for(const p of r.data||[]) {
                const c=structuredClone(p.dados_customizados),meta=c.universal_entrega;
                if(!meta?.concluido||meta.partes?.every(m=>Number(m.ack)>=3)||Date.now()-Number(meta.recibosVerificadosEm||0)<300000)continue;
                const client=ctx.sessoes[String(meta.canal_id)]?.client;if(!client)continue;
                let mudou=false;
                for(const parte of meta.partes||[]) {
                    if(!parte.id)continue;
                    const m=await client.getMessageById(parte.id).catch(()=>null);
                    if(Number(m?.ack)>Number(parte.ack||0)){parte.ack=Number(m.ack);mudou=true;}
                }
                if(mudou){meta.recibosVerificadosEm=Date.now();await salvarEntrega(p,c);}
            }
        } finally {conferindoRecibos=false;}
    }
    const retornoAnterior = ctx.tratarRetornoBko;
    const alternativaNio=require('./alternativa-nio-bko.cjs').criar({workspace:WS,db,consultar:consulta,catalogo:planosDaCidade});
    const posVenda = require('./pos-venda.cjs')({ workspace:WS, ctx, db, salvarEntrega, configBko, telefoneBko,alternativaNio,enfileirarNio:()=>setTimeout(()=>entregarPendentes().catch(e=>console.error('[Alternativa Nio]',e.message)),100), enviarBko: (...args) => enviarBko(...args), confirmarBko: (...args) => confirmarBko(...args) });
    if(!opcoes.semEnvolver)ctx.tratarRetornoBko = async entrada => {
        try { if (await posVenda.tratar(entrada)) return true; }
        catch (e) { console.error('[Universal retorno BKO]', e.message); return true; }
        return retornoAnterior?.(entrada) || false;
    };
    // Tentativas pendentes sobrevivem a reinício. Usa o canal e o contato persistidos.
    async function retomarPendentes() { const { data } = await db.from('fluxo_sessoes').select('*').eq('workspace_id', WS).eq('status', 'ativo').eq('tipo_input_aguardado', 'assistente_universal').limit(100); for (const row of data || []) {
        const s = parse(row.variaveis?.[KEY]);
        if ((!s.pendentes?.length&&!(s.retryEm&&s.erro==='WhatsApp não confirmou o destinatário configurado')) || Number(s.retryEm) > Date.now())
            continue;
        const chave = `${WS}:${row.canal_id}:${row.numero}`;
        if (filas.has(chave))
            continue;
        await ctx.executarFluxo(WS, row.canal_id, row.numero, '', async (m) => { const c = await ctx.getConfigCanal(row.canal_id); if (c?.tipo !== 'webjs')
            throw Error('Canal indisponível'); const client = ctx.sessoes[String(row.canal_id)]?.client; if (!client)
            throw Error('Canal desconectado'); const enviada=await enviarCliente(client,row.numero,m); await ctx.salvarMensagem(WS,row.canal_id,c.fila,row.numero,m,'bot','BOT',enviada?.id?._serialized||null); }, row.fluxo_id).catch(e => console.error('[Universal retomada]', e.message));
    } }
    const enviarBko = opcoes.enviarBko || ((...args) => require('../bko-roteamento.js').enviar(...args));
    const confirmarBko = opcoes.confirmarBko || ((...args) => require('../bko-recibo.js').confirmar(...args));
    const encerrarInviaveis=require('./inviaveis-inativos.cjs').criar({db,workspace:WS,ocupado:(c,n)=>filas.has(`${WS}:${c}:${n}`),enviar:async(row,mensagem)=>{
        const c=await ctx.getConfigCanal(row.canal_id),sessao=ctx.sessoes[String(row.canal_id)];
        if(c?.workspaceId!==WS||c.tipo!=='webjs'||sessao?.status!=='conectado')throw Error('Canal indisponível para aviso de encerramento');
        const enviada=await enviarCliente(sessao.client,row.numero,mensagem);
        const r=await db.from('mensagens').insert({workspace_id:WS,canal_id:row.canal_id,numero:row.numero,mensagem,de:'bot',provider_message_id:enviada?.id?._serialized||null,status_entrega:Number(enviada?.ack)>=2?'delivered':'enviado'});if(r.error)throw r.error;
        await db.from('atendimentos').update({mensagem}).eq('workspace_id',WS).eq('canal_id',row.canal_id).eq('numero',row.numero).eq('status','resolvido');
    }});
    const recuperarEntradas=require('./entradas-sem-resposta.cjs').criar({db,workspace:WS,ocupado:(c,n)=>filas.has(`${WS}:${c}:${n}`),disponivel:async row=>{const c=await ctx.getConfigCanal(row.canal_id);return c?.workspaceId===WS&&c.modo==='fluxo'&&Number(c.fluxoId)===Number(row.fluxo_id)&&ctx.sessoes[String(row.canal_id)]?.status==='conectado';},processar:async(row,texto)=>{await ctx.executarFluxo(WS,row.canal_id,row.numero,texto,async mensagem=>{const c=await ctx.getConfigCanal(row.canal_id),client=ctx.sessoes[String(row.canal_id)]?.client;if(!client)throw Error('Canal desconectado');const enviada=await enviarCliente(client,row.numero,mensagem);await ctx.salvarMensagem(WS,row.canal_id,c.fila,row.numero,mensagem,'bot','BOT',enviada?.id?._serialized||null);},row.fluxo_id);}});
    const timer = setInterval(() => { recuperarEntradas().catch(e=>console.error('[Universal entrada recuperada]',e.message)); encerrarInviaveis().catch(e=>console.error('[Universal encerramento inviáveis]',e.message)); entregarPendentes().catch(console.error); retomarPendentes().catch(console.error); posVenda.pendentes().catch(console.error); atualizarRecibos().catch(console.error); }, 20000);
    timer.unref();
    ctx.universalOperacoes={registrar,entregar,entregarPendentes,posVenda,configBko,salvarEntrega};
    ctx.universalV1 = true;
    if(!opcoes.teste)require('./lembretes-universais.cjs').instalar(ctx);
    if (opcoes.teste)
        ctx.universalTeste = { registrar, entregar, anexar, processar, posVenda, filas, enviarCliente, retomarPendentes, parar: () => clearInterval(timer) };
    return ctx;
};
