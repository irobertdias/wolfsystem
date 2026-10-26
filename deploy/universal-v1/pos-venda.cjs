'use strict';
const { normalizar } = require('./vtal.cjs');
const { cpfValido } = require('./conversa.cjs');
const { randomBytes } = require('node:crypto');
const ESTADOS = ['CPF REPROVADO','APROVADA','GERADA','AGUARDANDO INSTALAÇÃO','INSTALADA','SEM DISPONIBILIDADE','CANCELADA'];
function lerRetorno(texto, atual) {
    const t = normalizar(texto.replace(/#?BKO-\d+-[A-F0-9]{16}(?:\/\d+)?/gi, ''));
    let status;
    if (/^(?:CPF\s+)?REPROVAD[OA]\b/.test(t)) status = 'CPF REPROVADO';
    else if (/^(?:CPF\s+)?APROVAD[OA]\b/.test(t)) status = 'APROVADA';
    else if (/^(?:AGUARDANDO|PENDENTE DE|PENDENTE)\s+INSTALACAO\b/.test(t)) status = 'AGUARDANDO INSTALAÇÃO';
    else if (/^GERADA\b/.test(t)) status = 'GERADA';
    else if (/^INSTALAD[OA]\b/.test(t)) status = 'INSTALADA';
    else if (/^SEM (?:DISPONIBILIDADE|VIABILIDADE|COBERTURA)\b/.test(t)) status = 'SEM DISPONIBILIDADE';
    else if (/^CANCELAD[OA]\b/.test(t)) status = 'CANCELADA';
    const m = t.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
    let data_agendamento;
    if (m) { const dt = new Date(Date.UTC(+m[3],+m[2]-1,+m[1])); if (+m[3]>=2000 && +m[3]<=2100 && dt.getUTCDate()===+m[1] && dt.getUTCMonth()===+m[2]-1) data_agendamento=`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`; }
    const periodo_instalacao = /\bMANHA\b/.test(t) ? 'Manhã' : /\bTARDE\b/.test(t) ? 'Tarde' : /\bNOITE\b/.test(t) ? 'Noite' : undefined;
    if (!status && (data_agendamento || periodo_instalacao) && ['APROVADA','GERADA','AGUARDANDO INSTALAÇÃO'].includes(atual)) status=atual;
    return { status, data_agendamento, periodo_instalacao };
}
function prepararAcoes(p, c, config = {}) {
    if(config.modo_retorno==='fluxos')return c.universal_acoes||[];
    const lista = c.universal_acoes ||= [];
    for(const acao of lista) if(!['enviado','cancelado'].includes(acao.estado)) {
        if((acao.chave.startsWith('cpf:')&&p.status_venda!=='CPF REPROVADO')||(acao.chave.startsWith('biometria:')&&p.status_venda!=='APROVADA')||(acao.chave==='solicitar_agenda'&&(!['GERADA','AGUARDANDO INSTALAÇÃO'].includes(p.status_venda)||(p.data_agendamento&&p.periodo_instalacao))))acao.estado='cancelado';
    }
    const adicionar = (chave, alvo, texto) => { if (!lista.some(a=>a.chave===chave)) lista.push({ chave, alvo, texto: alvo==='cliente' ? texto+`\nPedido #${p.id}` : texto, estado:'pendente', criado_em:new Date().toISOString() }); };
    const personalizada=(config.retornos||[]).find(r=>r.status===p.status_venda);
    if(personalizada){
        if(personalizada.mensagem_cliente)adicionar('regra:'+p.status_venda+':'+p.cpf,'cliente',require('./modelo-vendas.cjs').modelo(personalizada.mensagem_cliente,{...p,...c.universal_variaveis,proposta_id:p.id}));
        if(personalizada.solicitar_agenda&&(!p.data_agendamento||!p.periodo_instalacao))adicionar('solicitar_agenda','bko',`📅 Pedido #${p.id}: informe o dia e o período da instalação.\nDATA: DD/MM/AAAA\nPERIODO: MANHÃ ou TARDE\n#${c.bko_ref}`);
        if(p.status_venda==='CPF REPROVADO')c.universal_novo_cpf=true;
        return lista;
    }
    if (p.status_venda==='CPF REPROVADO') {
        c.universal_novo_cpf = true;
        adicionar('cpf:'+p.cpf, 'cliente', 'Precisamos de outro CPF para continuar o pedido, pois foi identificada uma inconsistência cadastral na análise da operadora. Você tem outro titular autorizado para a contratação? Pode me informar o CPF dele? Se houver troca de titular, vamos atualizar os dados do pedido.');
    }
    if (p.status_venda==='APROVADA') {
        c.universal_novo_cpf = false;
        adicionar('biometria:'+p.cpf, 'cliente', 'Seu cadastro foi aprovado! ✅ Agora vamos seguir para a etapa de biometria. A equipe vai orientar você pelo canal oficial. Assim que tivermos a confirmação, continuamos com a instalação.');
    }
    if (['GERADA','AGUARDANDO INSTALAÇÃO'].includes(p.status_venda)) {
        if (!p.data_agendamento || !p.periodo_instalacao) adicionar('solicitar_agenda', 'bko', `📅 Pedido #${p.id}: por favor, informe o dia e o período da instalação para avisarmos o cliente.\nDATA: DD/MM/AAAA\nPERIODO: MANHÃ ou TARDE\n🔖 #${c.bko_ref}`);
        else adicionar('agenda:'+p.data_agendamento+':'+p.periodo_instalacao, 'cliente', `📅 A instalação do seu pedido #${p.id} está agendada para *${p.data_agendamento}*, no período da *${p.periodo_instalacao.toLowerCase()}*. A equipe da operadora fará a instalação. Se precisar ajustar alguma informação, pode falar por aqui. 😊`);
    }
    if (p.status_venda==='INSTALADA') adicionar('instalada', 'cliente', 'Sua instalação foi registrada como concluída! ✅ Obrigado por escolher a Grupo Prime. Se precisar de alguma orientação, estamos por aqui. 💚');
    return lista;
}
module.exports = function criarPosVenda({workspace='grupoprime',ctx,db,salvarEntrega,enviarBko,confirmarBko,telefoneBko,configBko,alternativaNio,enfileirarNio=()=>{}}) {
    const locks = new Map(); let rodando=false;
    async function serial(id, fn) { const anterior=locks.get(id)||Promise.resolve(); const tarefa=anterior.catch(()=>{}).then(fn); locks.set(id,tarefa); try { return await tarefa; } finally { if(locks.get(id)===tarefa)locks.delete(id); } }
    async function obter(id) { const r=await db.from('proposta').select('*').eq('workspace_id',workspace).eq('id',id).single();if(r.error)throw r.error;return r.data; }
    async function executar(id) { return serial(id, async()=>{
        let p=await obter(id), c=structuredClone(p.dados_customizados);
        alternativaNio?.preparar(p,c);
        if(alternativaNio&&await alternativaNio.conferir(p,c))p=await salvarEntrega(p,c);
        for (const acao of c.universal_acoes || []) {
            if (['enviado','cancelado'].includes(acao.estado) || Number(acao.tentarEm)>Date.now())continue;
            try {
                const meta=c.universal_entrega, canalId=acao.alvo==='bko'?meta.canal_id:p.canal_id;
                const numero=acao.alvo==='bko'?meta.numero:c.numero_origem_whatsapp;
                const sessao=ctx.sessoes[String(canalId)];
                const config=await ctx.getConfigCanal(canalId);
                if(acao.chave.startsWith('alternativa_nio_ofertas:')&&(await ctx.verificarBloqueioManualBot?.(workspace,canalId,numero))?.bloqueado)throw Error('Oferta alternativa aguarda liberação do atendimento');
                if(config?.workspaceId!==workspace||config.tipo!=='webjs'||!sessao?.client||sessao.status!=='conectado')throw Error('Canal de acompanhamento desconectado');
                acao.numero=numero;acao.canal_id=canalId;
                if(acao.id) {
                    const m=await sessao.client.getMessageById(acao.id).catch(()=>null);
                    if(Number(m?.ack)>=1) { acao.estado='enviado';acao.ack=m.ack;acao.enviado_em=new Date().toISOString();delete acao.erro; p=await salvarEntrega(p,c);continue; }
                    if(m?.ack===-1) { delete acao.id;acao.estado='pendente'; } else throw Error('Aguardando confirmação do WhatsApp');
                }
                if(acao.estado==='em_envio') {
                    const id=await sessao.client.getNumberId(numero),chat=id&&await sessao.client.getChatById(id._serialized);
                    const recentes=chat?await chat.fetchMessages({limit:50}):[];
                    const encontrada=recentes.find(m=>m.fromMe&&m.body===acao.texto&&Number(m.timestamp)*1000>=Date.parse(acao.criado_em)-5000);
                    if(encontrada) { acao.id=encontrada.id._serialized;acao.estado='aguardando';p=await salvarEntrega(p,c); }
                    throw Error('Acompanhamento em reconciliação; aguardando recibo');
                }
                acao.estado='em_envio';p=await salvarEntrega(p,c);
                const r=await enviarBko(sessao.client,numero,acao.texto,{});
                if(!r?.id?._serialized)throw Error('WhatsApp não retornou recibo');
                acao.id=r.id._serialized;acao.ack=r.ack;
                if(acao.alvo==='bko')c.bko_reply_ids=[...new Set([...(c.bko_reply_ids||[]),acao.id])];
                p=await salvarEntrega(p,c);
                await confirmarBko(sessao.client,acao.id,r.ack);
                acao.estado='enviado';acao.enviado_em=new Date().toISOString();delete acao.erro;
                p=await salvarEntrega(p,c);
                if(acao.alvo==='cliente'&&ctx.salvarMensagem)await ctx.salvarMensagem(workspace,canalId,config.fila||null,numero,acao.texto,'bot',p.nome,acao.id);
            } catch(e) { acao.erro=String(e.message).slice(0,250);acao.tentarEm=Date.now()+60000;await salvarEntrega(p,c);break; }
        }
    }); }
    async function tratar(entrada) {
        if(entrada.workspaceId!==workspace||!entrada.verificado||!entrada.messageId)return false;
        const refs=[...String(entrada.mensagem||'').matchAll(/#?BKO-\d+-[a-f0-9]{16}\b/gi)].map(m=>m[0].replace(/^#/,'').toUpperCase());
        if(new Set(refs).size>1)return true;
        let q=db.from('proposta').select('*').eq('workspace_id',workspace).eq('dados_customizados->>universal_v1','SIM');
        if(refs[0])q=q.eq('dados_customizados->>bko_ref',refs[0]);
        else if(entrada.quotedId)q=q.contains('dados_customizados',{bko_reply_ids:[entrada.quotedId]});
        else {
            // Sem citação, associar apenas quando existe um único pedido em
            // andamento para esse destinatário. Nunca escolher "o mais recente".
            const cfg=await configBko();
            if(![cfg.canal_id,...cfg.contatos.map(r=>r.canal_envio_id)].some(id=>Number(id)===Number(entrada.canalId))||!cfg.contatos.some(x=>telefoneBko(x.numero)===telefoneBko(entrada.numero)))return false;
            const candidatas=await q.limit(100);if(candidatas.error)throw candidatas.error;
            const unicas=(candidatas.data||[]).filter(p=>!['INSTALADA','CANCELADA','SEM DISPONIBILIDADE'].includes(p.status_venda)&&p.dados_customizados.universal_entrega?.concluido&&Number(p.dados_customizados.universal_entrega.canal_id)===Number(entrada.canalId)&&telefoneBko(p.dados_customizados.universal_entrega.numero)===telefoneBko(entrada.numero));
            if(unicas.length!==1)return false;
            q=db.from('proposta').select('*').eq('workspace_id',workspace).eq('id',unicas[0].id);
        }
        const {data,error}=await q.limit(2);if(error)throw error;if(data?.length!==1)return false;
        const cfg=await configBko();
        const meta=data[0].dados_customizados.universal_entrega;
        if(!meta?.concluido||Number(meta.canal_id)!==Number(entrada.canalId)||telefoneBko(meta.numero)!==telefoneBko(entrada.numero)||!cfg.contatos.some(x=>telefoneBko(x.numero)===telefoneBko(entrada.numero)))return true;
        if(entrada.quotedId&&!data[0].dados_customizados.bko_reply_ids?.includes(entrada.quotedId))return true;
        await serial(data[0].id,async()=>{
            let p=await obter(data[0].id),c=structuredClone(p.dados_customizados);
            if(c.bko_retornos?.some(e=>e.message_id===entrada.messageId))return;
            const r=lerRetorno(entrada.mensagem||'',p.status_venda);
            const regra=(cfg.retornos||[]).find(x=>normalizar(x.resposta)===normalizar(String(entrada.mensagem||'').replace(/#?BKO-\d+-[a-f0-9]{16}\b/gi,'').split(/\r?\n/)[0].trim()));if(regra)r.status=regra.status;
            // Não retroceder pedidos concluídos por mensagem atrasada.
            const terminal=['INSTALADA','CANCELADA','SEM DISPONIBILIDADE'].includes(p.status_venda);
            const patch={};
            if(r.status&&(!terminal||r.status===p.status_venda)) {
                patch.status_venda=r.status;
                if(r.data_agendamento)patch.data_agendamento=r.data_agendamento;
                if(r.periodo_instalacao)patch.periodo_instalacao=r.periodo_instalacao;
            }
            c.bko_retornos=[...(c.bko_retornos||[]),{message_id:entrada.messageId,numero:entrada.numero,texto:String(entrada.mensagem||'').slice(0,6000),status:patch.status_venda||p.status_venda,em:new Date().toISOString()}].slice(-100);
            prepararAcoes({...p,...patch},c,cfg);
            if(alternativaNio&&patch.status_venda==='SEM DISPONIBILIDADE')alternativaNio.preparar({...p,...patch},c);
            // O pós-venda deste motor é próprio; baseline atualizado evita disparar
            // também um fluxo CRM antigo para o mesmo retorno.
            const antes=p;
            p=await salvarEntrega(p,c,patch);
            const snapshot=cfg.modo_retorno==='fluxos'?antes:p;
            const b=await db.from('crm_automacao_estado').upsert({workspace_id:workspace,proposta_id:p.id,snapshot,proposta_updated_at:snapshot.updated_at},{onConflict:'proposta_id'});if(b.error)throw b.error;
        });
        await executar(data[0].id);return true;
    }
    async function cliente(p, texto) {
        if(alternativaNio&&p.dados_customizados?.universal_migracao_nio_pendente==='SIM')return serial(p.id,async()=>{const atual=await obter(p.id),r=alternativaNio.cliente(atual,texto);if(!r)return false;if(r.c)await salvarEntrega(atual,r.c,r.patch||{});if(r.migrada)enfileirarNio();return {mensagem:r.mensagem};});
        if(!p.dados_customizados?.universal_novo_cpf)return false;
        const cpf=String(texto).replace(/\D/g,'');
        if(!/^\d{11}$/.test(cpf)||!cpfValido(cpf))return {mensagem:'Pode conferir os 11 números do CPF do titular autorizado? Vou atualizar o pedido existente e continuar por aqui.'};
        if(cpf===p.cpf)return {mensagem:'Esse é o CPF que já está no pedido. Você pode informar o CPF de outro titular autorizado para a contratação?'};
        await serial(p.id,async()=>{
            const atual=await obter(p.id),c=structuredClone(atual.dados_customizados);
            c.universal_cpf_anterior=atual.cpf;c.universal_novo_cpf=false;c.universal_revisao_titular=true;
            c.universal_referencias_anteriores=[...(c.universal_referencias_anteriores||[]),c.bko_ref];
            c.bko_ref=`BKO-${p.id}-${randomBytes(8).toString('hex')}`.toUpperCase();
            c.bko_reply_ids=[];
            const chave='reanalise:'+cpf;
            if(!(c.universal_acoes||[]).some(a=>a.chave===chave))(c.universal_acoes||=[]).push({chave,alvo:'bko',estado:'pendente',texto:`🔄 Pedido #${p.id}: cliente informou outro CPF para reanálise: ${cpf}. Conferir e atualizar os dados/documentos do novo titular antes de concluir a contratação.\n🔖 #${c.bko_ref}`,criado_em:new Date().toISOString()});
            await salvarEntrega(atual,c,{cpf,status_venda:'AGUARDANDO AUDITORIA'});
        });
        await executar(p.id);
        return {mensagem:'Recebi o novo CPF e atualizei o pedido para reanálise. ✅ A equipe vai conferir os dados e documentos do titular antes de concluir a contratação.'};
    }
    async function pendentes() {
        if(rodando)return;rodando=true;
        try {
            const r=await db.from('proposta').select('id').eq('workspace_id',workspace).eq('dados_customizados->>universal_v1','SIM').eq('dados_customizados->>universal_pos_pendente','SIM').order('updated_at',{ascending:true}).limit(100);if(r.error)throw r.error;
            const ids=new Set((r.data||[]).map(p=>p.id));
            // Reconcilia também retornos antigos e alterações de status que chegaram fora do handler.
            if(alternativaNio)for(let inicio=0;;inicio+=100){const antigas=await db.from('proposta').select('id,operadora,status_venda,dados_customizados').eq('workspace_id',workspace).eq('dados_customizados->>universal_v1','SIM').eq('status_venda','SEM DISPONIBILIDADE').in('operadora',['Vero','VERO','vero']).order('id',{ascending:true}).range(inicio,inicio+99);if(antigas.error)throw antigas.error;for(const p of antigas.data||[])if(alternativaNio.precisaConferir(p,p.dados_customizados))ids.add(p.id);if((antigas.data||[]).length<100)break;}
            for(const id of ids)await executar(id);
        }
        finally {rodando=false;}
    }
    async function interceptarAlternativa(canal,numero,texto,enviar){
        if(!alternativaNio||!String(texto||'').trim())return false;
        const q=await db.from('proposta').select('*').eq('workspace_id',workspace).eq('canal_id',Number(canal)).eq('dados_customizados->>numero_origem_whatsapp',String(numero)).eq('dados_customizados->>universal_migracao_nio_pendente','SIM').limit(2);if(q.error)throw q.error;if(q.data?.length!==1)return false;
        if((await ctx.verificarBloqueioManualBot?.(workspace,canal,numero))?.bloqueado)return true;
        const at=await db.from('atendimentos').select('status,atendente,bloqueado_ia,bloqueado_fluxo').eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).order('updated_at',{ascending:false}).limit(1);if(at.error)throw at.error;const a=at.data?.[0];if(!a||a.status==='resolvido'||a.atendente!=='BOT'||a.bloqueado_ia||a.bloqueado_fluxo)return true;
        const r=await cliente(q.data[0],texto);if(!r)return false;await enviar(r.mensagem);return true;
    }
    return {tratar,cliente,pendentes,executar,interceptarAlternativa};
};
module.exports.lerRetorno=lerRetorno;
module.exports.prepararAcoes=prepararAcoes;
