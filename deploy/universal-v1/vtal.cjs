'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const normalizar = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const estados = { AC: 'ACRE', AL: 'ALAGOAS', AP: 'AMAPA', AM: 'AMAZONAS', BA: 'BAHIA', CE: 'CEARA', DF: 'DISTRITO FEDERAL', ES: 'ESPIRITO SANTO', GO: 'GOIAS', MA: 'MARANHAO', MT: 'MATO GROSSO', MS: 'MATO GROSSO DO SUL', MG: 'MINAS GERAIS', PA: 'PARA', PB: 'PARAIBA', PR: 'PARANA', PE: 'PERNAMBUCO', PI: 'PIAUI', RJ: 'RIO DE JANEIRO', RN: 'RIO GRANDE DO NORTE', RS: 'RIO GRANDE DO SUL', RO: 'RONDONIA', RR: 'RORAIMA', SC: 'SANTA CATARINA', SP: 'SAO PAULO', SE: 'SERGIPE', TO: 'TOCANTINS' };
const ufSigla = v => { const n = normalizar(v); return estados[n] ? n : Object.entries(estados).find(([, nome]) => nome === n)?.[0] || n; };
const numero = v => /^\d+$/.test(String(v).trim()) ? String(Number(v)) : normalizar(v);
function parte(texto, tipo) {
    const marcas = { quadra: '(?:QUADRA|QU|QD|QA|Q[A-Z]{0,7}(?=\\s)|Q)', lote: '(?:LOTE|LT|L)', casa: '(?:CASA|CA)', apartamento: '(?:APARTAMENTO|APTO|APT|AP)', bloco: '(?:BLOCO|BL)' };
    const valor = tipo === 'quadra' || tipo === 'bloco' ? '([0-9]+[A-Z]?|[A-Z])' : '(\\d+[A-Z]?)';
    const m = normalizar(texto).match(new RegExp('(?:^|[ ,;/])' + (tipo==='quadra'?'(?!QUERO\\b|QUAL\\b|QUANDO\\b|QUANTO\\b|QUEM\\b|QUE\\b)':'') + marcas[tipo] + '\\s*[-.:]?\\s*' + valor + '(?=$|[^A-Z0-9])'));
    return m ? numero(m[1]) : '';
}
function interpretarEndereco(texto) {
    const t = normalizar(texto), cep = t.match(/\b\d{5}[- .]?\d{3}\b/);
    const r = { cep: cep ? cep[0].replace(/\D/g, '') : '', quadra: parte(t, 'quadra'), lote: parte(t, 'lote'), casa: parte(t, 'casa'), apartamento: parte(t, 'apartamento'), bloco: parte(t, 'bloco'), numero: '', logradouro: '' };
    const resto = t.replace(/\b\d{5}[- .]?\d{3}\b/g, '').replace(/(?:CEP)\s*:?/g, '').trim();
    const n = resto.match(/(?:NUMERO|N[º°.]?|FACHADA)\s*:?\s*(\d+[A-Z]?)/) || (!r.quadra && !r.lote && resto.match(/^\s*(\d+[A-Z]?)\s*$/));
    if (n)
        r.numero = numero(n[1]);
    if (/\b(?:RUA|R|AVENIDA|AV|TRAVESSA|ALAMEDA|ESTRADA|RODOVIA|PRACA)\.?\s/.test(resto)) {
        r.logradouro = resto.split(/[,;]|\b(?:CEP|BAIRRO|NUMERO|N[º°])\b/)[0].trim();
        const fachada = r.logradouro.match(/\s+(\d+[A-Z]?)\s+(?:QUADRA|QU|QD|QA|Q)\s*[-.:]?\s*(?:\d+[A-Z]?|[A-Z])\b/);
        if (fachada) r.numero = r.numero || numero(fachada[1]);
        r.logradouro = r.logradouro.replace(/\s+(?:QUADRA|QU|QD|QA|Q|LOTE|LT|CASA|CA|BLOCO|BL)\s*[-.:]?\s*(?:\d+[A-Z]?|[A-Z])\b.*$/, '').trim();
        if (fachada) r.logradouro = r.logradouro.replace(/\s+\d+[A-Z]?$/, '').trim();
        if (!r.quadra && !r.lote) {
            const fim = r.logradouro.match(/\s+(\d+)$/);
            if (fim && !/^(?:RUA|R)\.?\s+[A-Z]\s+\d+$/.test(r.logradouro) && (/[,;]/.test(resto) || r.logradouro.split(/\s+/).length >= 3)) {
                r.numero = r.numero || numero(fim[1]);
                r.logradouro = r.logradouro.slice(0, fim.index).trim();
            }
        }
        if (!r.numero && !r.quadra && !r.lote) {
            const m = resto.match(/[,;]\s*(\d+[A-Z]?)(?:\b|$)/);
            if (m)
                r.numero = numero(m[1]);
        }
    }
    return r;
}
function ruaBase(v) { return normalizar(v).replace(/^(?:RUA|R|AVENIDA|AV|TRAVESSA|ALAMEDA)\.?\s+/, '').replace(/(?:^|\s)(?:QUADRA|QU|QD|QA|Q|LOTE|LT|L|CASA|CA|APARTAMENTO|APTO|AP|BLOCO|BL)\s*(?:\d+[A-Z]?|[A-Z])\b/g, '').replace(/\s+/g, ' ').trim(); }
function similaridade(a, b) {
    a = ruaBase(a); b = ruaBase(b);
    if(b.length>=5&&!b.includes(' ')&&a.includes(' '))return Math.max(...a.split(' ').filter(t=>t.length>=4).map(t=>similaridade(t,b)))*0.95;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j-1] + 1, prev + (a[i-1] === b[j-1] ? 0 : 1)); prev = old; } }
    return 1 - row[b.length] / Math.max(a.length, b.length, 1);
}
function ruaCompativel(real, pedido) { const a = ruaBase(real), b = ruaBase(pedido); return !b || a === b; }
function corresponde(r, e) {
    const comps = [r.complemento1, r.complemento2, r.complemento3].join(' ');
    if (e.logradouro && !ruaCompativel(r.logradouro, e.logradouro))
        return false;
    if (e.numero && numero(r.numero) !== numero(e.numero))
        return false;
    for (const k of ['quadra', 'lote', 'casa', 'apartamento', 'bloco'])
        if (e[k] && parte(k === 'quadra' ? r.logradouro + ' ' + comps : comps, k) !== numero(e[k]))
            return false;
    return true;
}
function viavel(r) { return normalizar(r.situacao) === 'VIAVEL' && normalizar(r.comercial) === 'SIM'; }
function criarConsulta({ fetcher = fetch, diretorio = path.join(__dirname, 'indice-vtal') } = {}) {
    const descoberta=require('./descoberta-vtal.cjs').criarDescoberta({diretorio,fetcher});
    const cachePaginas=new Map();
    async function pagina(cep, filtros = {}, page = 1) {
        const p = new URLSearchParams({ cep, page: String(page), ...filtros });
        const cached=cachePaginas.get(p.toString());if(cached&&Date.now()-cached.em<60000)return cached.dados;
        const r = await fetcher('https://vtal.wolfgyn.com.br/api/cep?' + p, { signal: AbortSignal.timeout(20000) });
        if (!r.ok)
            throw Error('VTAL indisponível: ' + r.status);
        const j = await r.json();
        if (!Array.isArray(j.results) || !j.facets || !Number.isSafeInteger(j.total))
            throw Error('Resposta VTAL incompleta');
        if(cachePaginas.size>=100)cachePaginas.delete(cachePaginas.keys().next().value);cachePaginas.set(p.toString(),{em:Date.now(),dados:j});
        return j;
    }
    async function porCepExato(e) {
        const inicial = await pagina(e.cep);
        const locais = inicial.locations || [];
        if (e.cidade || e.uf) {
            const certos = locais.filter(l => { const [c, u] = l.split(' / '); return (!e.cidade || normalizar(c) === normalizar(e.cidade)) && (!e.uf || normalizar(u) === normalizar(e.uf)); });
            if (!certos.length && inicial.cepTotal) {
                const municipio=locais.length===1?locais[0].split(' / '):null;
                const bairroInformado=inicial.results.some(r=>normalizar(r.bairro)===normalizar(e.cidade));
                if(municipio&&bairroInformado&&(!e.uf||normalizar(municipio[1])===normalizar(e.uf)))e={...e,bairro:e.cidade,cidade:municipio[0],uf:municipio[1]};
                else return { status: 'localidade_divergente', cep: e.cep, localidades: locais, resultados: [] };
            }
        }
        if (!inicial.cepTotal)
            return { status: 'nao_localizado', cep: e.cep, resultados: [] };
        const bairros=[...new Set(inicial.results.map(r=>r.bairro).filter(Boolean))];
        if(e.logradouro&&bairros.some(b=>normalizar(b)===normalizar(e.logradouro))&&(inicial.facets.logradouro||[]).length===1)e={...e,bairro:e.logradouro,logradouro:inicial.facets.logradouro[0]};
        if (!e.numero && !e.lote && !e.casa && !e.apartamento)
            return { status: 'complemento_necessario', cep: e.cep, localidades: locais, cidade:e.cidade,uf:e.uf,resultados: [], logradouros: inicial.facets.logradouro, bairro:bairros.length===1?bairros[0]:'' };
        const consultas = [];
        const ruas = (inicial.facets.logradouro || []).filter(l => ruaCompativel(l, e.logradouro));
        if(!ruas.length&&e.logradouro&&(inicial.facets.logradouro||[]).length>=500)ruas.push(e.logradouro);
        if (!ruas.length && e.logradouro) {
            const sugestoes = (inicial.facets.logradouro || []).map(logradouro => ({ logradouro, similaridade: similaridade(logradouro, e.logradouro) })).filter(s => s.similaridade >= 0.6).sort((a,b) => b.similaridade-a.similaridade).slice(0,3);
            if (sugestoes.length) return { status: 'confirmar_logradouro', cep: e.cep, resultados: [], sugestoes };
        }
        for (const l of ruas) {
            const base = { logradouro: l };
            if (e.numero) {
                for (const n of inicial.facets.numero || [])
                    if (numero(n) === numero(e.numero))
                        consultas.push({ ...base, numero: n });
                if(!consultas.some(c=>c.logradouro===l&&numero(c.numero)===numero(e.numero)))consultas.push({...base,numero:numero(e.numero)});
                continue;
            }
            const qs = [];
            if (!e.quadra || parte(l, 'quadra') === numero(e.quadra))
                qs.push(base);
            else
                for (const k of ['complemento1', 'complemento2', 'complemento3'])
                    for (const v of inicial.facets[k] || [])
                        if (parte(v, 'quadra') === numero(e.quadra))
                            qs.push({ ...base, [k]: v });
            for (const q of qs) {
                if (!e.lote) {
                    consultas.push(q);
                    continue;
                }
                for (const k of ['complemento1', 'complemento2', 'complemento3'])
                    for (const v of inicial.facets[k] || [])
                        if (parte(v, 'lote') === numero(e.lote) && (!q[k] || q[k] === v))
                            consultas.push({ ...q, [k]: v });
            }
        }
        const unicas = [...new Map(consultas.map(c => [JSON.stringify(c), c])).values()];
        if (unicas.length > 50)
            return { status: 'endereco_ambiguo', cep: e.cep, resultados: [], mensagem: 'Precisamos identificar a rua para localizar o imóvel.' };
        let encontrados = [], incompleto = false;
        for (const filtro of unicas) {
            let j = await pagina(e.cep, filtro);
            let paginas = Math.ceil(j.total / j.pageSize);
            if (paginas > 20) {
                incompleto = true;
                paginas = 20;
            }
            encontrados.push(...j.results);
            for (let p = 2; p <= paginas; p++)
                encontrados.push(...(await pagina(e.cep, filtro, p)).results);
        }
        encontrados = [...new Map(encontrados.filter(r => corresponde(r, e) && (!e.cidade || normalizar(r.cidade) === normalizar(e.cidade)) && (!e.uf || normalizar(r.uf) === normalizar(e.uf))).map(r => [r.id, r])).values()];
        if (incompleto)
            return { status: 'consulta_inconclusiva', cep: e.cep, resultados: [] };
        // Linhas repetidas da planilha não representam unidades diferentes.
        // Inclui a situação na chave para não ocultar divergências de viabilidade.
        encontrados = [...new Map(encontrados.map(r => [JSON.stringify(['uf','cidade','bairro','logradouro','numero','complemento1','complemento2','complemento3','situacao','comercial'].map(k=>normalizar(r[k]))),r])).values()];
        if (!encontrados.length)
            return { status: !unicas.length&&Object.values(inicial.facets).some(v => v.length >= 500) ? 'consulta_inconclusiva' : 'endereco_nao_localizado', cep: e.cep, resultados: [],logradouros:inicial.facets.logradouro,bairro:bairros.length===1?bairros[0]:'',numero:e.numero||e.casa||'' };
        if (encontrados.length > 1)
            return { status: 'endereco_ambiguo', cep: e.cep, resultados: encontrados.slice(0, 15) };
        return { status: viavel(encontrados[0]) ? 'disponivel_na_base' : 'sem_disponibilidade_na_base', cep: e.cep, resultados: encontrados, origem: 'VTAL · planilhas fornecidas (2024/2025)', confirmacao_tecnica_necessaria: true };
    }
    async function porCep(entrada){
        const e={...entrada};for(const k of ['casa','apartamento','lote','quadra','bloco'])if(e[k]&&!/^(?:\d+[A-Z]?|[A-Z])$/.test(normalizar(e[k])))delete e[k];
        const r=await porCepExato(e);
        if(r.status!=='endereco_nao_localizado')return r;
        const variantes=[];
        if(e.casa&&e.numero&&numero(e.casa)===numero(e.numero))variantes.push({...e,casa:''});
        if(e.casa&&!e.numero&&!e.lote)variantes.push({...e,casa:'',numero:e.casa});
        if(e.numero&&!e.casa&&!e.lote&&!e.quadra)variantes.push({...e,numero:'',casa:e.numero});
        for(const v of variantes){const outro=await porCepExato(v);if(['disponivel_na_base','sem_disponibilidade_na_base','endereco_ambiguo'].includes(outro.status))return {...outro,enderecoInterpretado:v};}
        return r;
    }
    return async function consultarEndereco(entrada) {

        const e = { ...interpretarEndereco(entrada.texto || ''), ...Object.fromEntries(Object.entries(entrada).filter(([, v]) => v !== '' && v !== undefined && v !== null)) };
        e.cep = String(e.cep || '').replace(/\D/g, '');
        e.uf = ufSigla(e.uf || '');
        try {
            if(e.cep&&!/^\d{8}$/.test(e.cep)){if(e.logradouro&&e.cidade&&e.uf)e.cep='';else return {status:'cep_incompleto',resultados:[]};}
            if (!e.cep) {
                const encontrado = await descoberta.buscar(e);
                const ceps=encontrado.ceps;
                if(encontrado.sugestoes?.length)return {status:'confirmar_logradouro',resultados:[],sugestoes:encontrado.sugestoes};
                if(!ceps.length)return {status:'logradouro_nao_localizado',resultados:[],logradouro:e.logradouro};
                if(encontrado.fonte==='indice_local'&&!e.numero&&!e.lote&&!e.casa&&!e.apartamento)return {status:'complemento_necessario',resultados:[],ceps,logradouros:encontrado.logradouros};
                if(ceps.length>50)return {status:'endereco_ambiguo',resultados:[],pedir:'bairro',logradouros:encontrado.logradouros};
                let resultados = [],pendente,negativo,foraDaBase=0;
                const respostas=[];
                for(let i=0;i<ceps.length;i+=4)respostas.push(...await Promise.all(ceps.slice(i,i+4).map(async cep=>({cep,r:await porCep({...e,cep})}))));
                for (const {cep,r} of respostas) {
                    if (['consulta_inconclusiva', 'localidade_divergente'].includes(r.status))
                        return r;
                    if(r.status==='complemento_necessario')pendente=r;
                    if(r.status==='endereco_nao_localizado')negativo=r;
                    if(r.status==='nao_localizado')foraDaBase++;
                    resultados.push(...r.resultados.map(l => ({ ...l, cep })));
                }
                if(!resultados.length&&pendente)return pendente;
                if(foraDaBase===ceps.length)return {status:'sem_disponibilidade_na_base',resultados:[],ceps,cep:ceps.length===1?ceps[0]:''};
                if(!resultados.length&&negativo)return {...negativo,ceps};
                if (resultados.length !== 1)
                    return { status: resultados.length ? 'endereco_ambiguo' : 'endereco_nao_localizado', resultados: resultados.slice(0, 15) };
                return { status: viavel(resultados[0]) ? 'disponivel_na_base' : 'sem_disponibilidade_na_base', cep: resultados[0].cep, resultados, confirmacao_tecnica_necessaria: true };
            }
            const r=await porCep(e);
            if(r.status==='localidade_divergente'&&e.logradouro){const alternativo=await consultarEndereco({...e,cep:''});if(alternativo.status!=='consulta_inconclusiva')return {...alternativo,cepCorrigido:e.cep};}
            return r;
        }
        catch (error) {
            return { status: 'consulta_inconclusiva', resultados: [], erro: error.message };
        }
    };
}
module.exports = { normalizar, ufSigla, numero, parte, interpretarEndereco, corresponde, viavel, criarConsulta, similaridade, ruaBase };
