'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {criarConsulta}=require('./vtal.cjs'),{inicial,avancar}=require('./conversa.cjs'),{planosDaCidade}=require('./planos-grupoprime.cjs');
const linha=(id,numero,casa='')=>({id,numero,logradouro:'RUA TESTE',uf:'GO',cidade:'GOIANIA',bairro:'CENTRO',complemento1:casa,complemento2:'',complemento3:'',situacao:'Viável',comercial:'Sim'});
test('correção Casa número 36 após CPF/CNPJ reconsulta a fachada e substitui o endereço antigo',async()=>{
 const s=inicial();s.apresentou=true;s.etapa='tipo_pessoa';s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',logradouro:'RUA TESTE',numero:'35',endereco:'RUA TESTE 35'};s.enderecoConfirmado=true;s.consulta={status:'disponivel_na_base',resultados:[linha('35','35')]};let consultado;
 const r=await avancar({estado:s,entrada:'Casa número 36',extrair:async()=>({dados:{casa:'36'}}),consultar:async d=>{consultado=d;return {status:'disponivel_na_base',cep:'74480150',resultados:[linha('36','36')]};},catalogo:planosDaCidade});
 a.equal(consultado.numero,'36');a.equal(consultado.casa,undefined);a.equal(r.estado.dados.numero,'36');a.match(r.estado.dados.endereco,/36/);a.doesNotMatch(r.estado.dados.endereco,/35/);a.equal(r.estado.etapa,'tipo_pessoa');a.match(r.mensagem,/CPF ou CNPJ/);
});
function api(rows){return async url=>{const p=new URL(url).searchParams,cols=['logradouro','numero','complemento1','complemento2','complemento3'];const base=rows.filter(r=>r.cep===p.get('cep')||!r.cep),filtrados=base.filter(r=>cols.every(k=>!p.get(k)||p.get(k)===r[k]));return {ok:true,json:async()=>({cepTotal:base.length,total:filtrados.length,pageSize:30,locations:base.length?['GOIANIA / GO']:[],results:filtrados.slice((+(p.get('page')||1)-1)*30,+(p.get('page')||1)*30),facets:Object.fromEntries(cols.map(k=>[k,[...new Set(base.map(r=>r[k]))]]))})};};}
test('linhas idênticas com IDs diferentes não pedem escolha; unidades ou situações diferentes continuam distintas',async()=>{
 const q=rows=>criarConsulta({fetcher:api(rows)})({cep:'74480150',numero:'36'});
 a.equal((await q([linha('1','36'),linha('2','36')])).status,'disponivel_na_base');
 a.equal((await q([linha('1','36','CA 1'),linha('2','36','CA 2')])).status,'endereco_ambiguo');
 a.equal((await q([linha('1','36'),{...linha('2','36'),situacao:'Inviável'}])).status,'endereco_ambiguo');
});
test('escolha de opção em atendimento antigo invalida consulta ambígua e avança sem repetir opções iguais',async()=>{
 const s=inicial();s.apresentou=true;s.etapa='complemento';s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',logradouro:'RUA TESTE',numero:'36'};
 s.consulta={status:'endereco_ambiguo',cep:'74480150',resultados:[linha('1','36'),linha('2','36')]};s.consultaChave=JSON.stringify(Object.fromEntries(['cidade','estado','cep','logradouro','quadra','lote','numero','casa','apartamento','bloco'].map(k=>[k,s.dados[k]||''])));
 let chamadas=0;const q=criarConsulta({fetcher:api(s.consulta.resultados)});const r=await avancar({estado:s,entrada:'2',extrair:async()=>({dados:{}}),consultar:async d=>{chamadas++;return q(d)},catalogo:planosDaCidade});a.equal(chamadas,1);a.equal(r.estado.etapa,'tipo_pessoa');a.doesNotMatch(r.mensagem,/mais de uma unidade/);
});
function indice(rows){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-endereco-index-'));fs.writeFileSync(path.join(dir,'GO-GOIANIA.json.gz'),zlib.gzipSync(JSON.stringify(rows)));return {dir,limpar:()=>fs.rmSync(dir,{recursive:true})};}
test('rua sem CEP localiza no índice e pede somente número, sem exigir CEP',async()=>{
 const f=indice([['RUA TESTE','74480150']]);let calls=0;try{const q=criarConsulta({diretorio:f.dir,fetcher:async()=>{calls++;throw Error('Não precisa API até obter número');}});const r=await q({cidade:'Goiânia',uf:'GO',logradouro:'Rua Teste'});a.equal(r.status,'complemento_necessario');a.equal(calls,0);
 const s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO',logradouro:'Rua Teste'};const p=await avancar({estado:s,entrada:'Rua Teste',extrair:async()=>({dados:{}}),consultar:q,catalogo:planosDaCidade});a.match(p.mensagem,/número do imóvel/);a.doesNotMatch(p.mensagem,/informar.*CEP|CEP completo/);
 }finally{f.limpar();}
});
test('endereço completo resolve CEP e após escolha inicia cadastro sem repetir endereço',async()=>{
 const f=indice([['RUA TESTE','74480150']]);try{const q=criarConsulta({diretorio:f.dir,fetcher:api([linha('1','12')])});const s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO',logradouro:'Rua Teste',numero:'12',bairro:'Centro'};
 const p=async(estado,texto,dados={})=>avancar({estado,entrada:texto,numero:'5500000000000',extrair:async()=>({dados}),consultar:q,catalogo:planosDaCidade});let r=await p(s,'Rua Teste 12');a.equal(r.estado.dados.cep,'74480150');a.equal(r.estado.etapa,'tipo_pessoa');r=await p(r.estado,'CPF');a.equal(r.estado.etapa,'plano');r=await p(r.estado,'110');a.equal(r.estado.etapa,'nome');a.match(r.mensagem,/iniciar seu cadastro/);a.doesNotMatch(r.mensagem,/confirme a rua|CEP completo/);
 }finally{f.limpar();}
});
test('CEP inválido legado não impede consulta de rua completa',async()=>{
 const f=indice([['RUA TESTE','74480150']]);try{const q=criarConsulta({diretorio:f.dir,fetcher:api([linha('1','885','CA 5')])});const r=await q({cidade:'Goiânia',uf:'GO',logradouro:'Rua Teste',numero:'885',casa:'5',cep:'033489803'});a.equal(r.status,'disponivel_na_base');a.equal(r.cep,'74480150');}finally{f.limpar();}
});
test('número sozinho após CEP filtra fachada; palavra Casa sem valor não bloqueia',async()=>{
 const q=criarConsulta({fetcher:api([linha('1','12')])});const r=await q({cidade:'Goiânia',uf:'GO',cep:'74480150',numero:'12',casa:'Casa'});a.equal(r.status,'disponivel_na_base');a.equal(r.resultados[0].numero,'12');
});
test('Casa 54 também pode ser fachada 54; duplicação do mesmo valor não exige unidade inexistente',async()=>{
 const q=criarConsulta({fetcher:api([linha('1','54')])});for(const dados of [{casa:'54'},{numero:'54',casa:'54'}]){const r=await q({cep:'74480150',...dados});a.equal(r.status,'disponivel_na_base');a.equal(r.resultados[0].numero,'54');}
});
test('número sem fachada só é aceito como casa se corresponder exatamente à unidade da base',async()=>{
 const q=criarConsulta({fetcher:api([linha('1','SN','CA 12'),linha('2','SN','LT 12')])});const r=await q({cep:'74480150',numero:'12'});a.equal(r.status,'disponivel_na_base');a.equal(r.resultados[0].id,'1');
});
test('logradouro escrito errado oferece correção e mantém número e casa para a nova consulta',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-endereco-typo-'));try{const q=criarConsulta({diretorio:dir,fetcher:async url=>{a.match(url,/viacep/);return {ok:true,json:async()=>url.includes('gerando')?[]:[{localidade:'Fortaleza',uf:'CE',logradouro:'Rua Major Gerardo Mendes',cep:'60850-725'}]};}});const r=await q({cidade:'Fortaleza',uf:'CE',logradouro:'Rua Major gerando Mendes',numero:'885',casa:'5'});a.equal(r.status,'confirmar_logradouro');a.equal(r.sugestoes[0].logradouro,'Rua Major Gerardo Mendes');}finally{fs.rmSync(dir,{recursive:true});}
});
test('cidade conhecida resolve UF e não volta a pedir a cidade inteira',async()=>{
 const r=await avancar({estado:inicial(),entrada:'Maricá',extrair:async()=>({dados:{cidade:'Maricá'}}),consultar:async()=>{throw Error('Sem endereço ainda');},catalogo:planosDaCidade});a.equal(r.estado.dados.estado,'RJ');a.equal(r.estado.etapa,'cep');a.doesNotMatch(r.mensagem,/qual cidade e estado/);
});
test('número ausente na base pede confirmação específica uma vez e não fica em ciclo de complemento',async()=>{
 let s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',numero:'12'};const q=criarConsulta({fetcher:api([linha('1','20')])});const p=async texto=>{const r=await avancar({estado:s,entrada:texto,extrair:async()=>({dados:{}}),consultar:q,catalogo:planosDaCidade});s=r.estado;return r;};let r=await p('12');a.match(r.mensagem,/RUA TESTE/);a.match(r.mensagem,/Confirma esse endereço/);a.doesNotMatch(r.mensagem,/dado que diferencia/);r=await p('sim');a.equal(r.estado.etapa,'encerrado');a.equal(r.inviavel,true);
});
test('bairro Campo Grande com UF RJ é reconhecido pela linha do CEP sem virar outra cidade',async()=>{
 const row={...linha('1','12'),cidade:'RIO DE JANEIRO',uf:'RJ',bairro:'CAMPO GRANDE'};
 const mock=api([row]);const q=criarConsulta({fetcher:async(...args)=>{const r=await mock(...args),j=await r.json();return {ok:true,json:async()=>({...j,locations:['RIO DE JANEIRO / RJ']})};}});
 let r=await q({cidade:'Campo Grande',uf:'RJ',cep:'23087300'});a.equal(r.status,'complemento_necessario');a.equal(r.cidade,'RIO DE JANEIRO');
 r=await q({cidade:'Campo Grande',uf:'RJ',cep:'23087300',numero:'12'});a.equal(r.status,'disponivel_na_base');a.equal(r.resultados[0].cidade,'RIO DE JANEIRO');
});
test('complementos informados são preservados também na rede própria municipal Vero',async()=>{
 const {criarVero}=require('./vero.cjs'),v=criarVero({consultaVtal:async()=>{throw Error('Rede própria não exige VTAL');}});
 const s=inicial();s.apresentou=true;s.dados={cidade:'Timóteo',estado:'MG',logradouro:'Rua Teste',numero:'52',casa:'3',bloco:'A',bairro:'Centro'};
 const r=await avancar({estado:s,entrada:'Rua Teste número 52 casa 3 bloco A',extrair:async()=>({dados:{}}),consultar:v.consultar,catalogo:v.catalogo});a.equal(r.estado.etapa,'tipo_pessoa');a.match(r.estado.dados.endereco,/Casa 3/);a.match(r.estado.dados.endereco,/Bloco A/);
});
test('Vero reconhece bairro no lugar de município antes de consultar a alternativa Nio',async()=>{
 const {criarVero}=require('./vero.cjs');let entrada;const v=criarVero({resolverCep:async()=>({cep:'23087300',localidade:'Rio de Janeiro',uf:'RJ',bairro:'Campo Grande'}),consultaVtal:async e=>{entrada=e;return {status:'disponivel_na_base',cep:'23087300',resultados:[{cidade:'Rio de Janeiro',uf:'RJ',bairro:'Campo Grande',logradouro:'Rua Teste',numero:'12'}]};}});
 const r=await v.consultar({cidade:'Campo Grande',uf:'RJ',cep:'23087300',numero:'12'});a.equal(entrada.cidade,'Rio de Janeiro');a.equal(r.operadora,'Nio');a.equal(r.status,'disponivel_na_base');
});
