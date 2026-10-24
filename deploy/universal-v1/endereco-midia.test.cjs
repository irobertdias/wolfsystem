'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {normalizarEnderecos,dadosDaMidia}=require('./endereco-midia.cjs');
const {inicial,avancar}=require('./conversa.cjs'),{criarConsulta,interpretarEndereco}=require('./vtal.cjs');
const {planosDaCidade}=require('./planos-grupoprime.cjs');
const {criarInterpretador}=require('./interpretacao.cjs');
const {recuperarCorpo,textoLocalizacao}=require('./midia-corpo.cjs');
const end=(papel,cep)=>({papel,trecho:'CEP '+cep,dados:[{campo:'cep',valor:cep,trecho:cep}]});
test('CEP de foto/PDF preenche consulta; CEP do emitente e dígitos inventados não são aproveitados',async()=>{
 const lista=normalizarEnderecos([end('emitente','60135-040'),end('destinatario','74480-150')]);
 a.deepEqual(dadosDaMidia([{enderecos:lista}],{}).dados,{cep:'74480150'});
 a.deepEqual(dadosDaMidia([{enderecos:[lista[0]]}],{}).dados,{});
 a.deepEqual(normalizarEnderecos([{...end('destinatario','74480-150'),dados:[{campo:'cep',valor:'74480151',trecho:'74480-150'}]}]),[]);
 const s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO'};let consultado;
 const r=await avancar({estado:s,entrada:'[img:conta.jpg]',numero:'5500000000000',anexos:[{path:'conta',enderecos:lista,categorias:[],leitura:'legivel'}],extrair:async()=>({dados:{}}),consultar:async e=>{consultado=e;return {status:'complemento_necessario'};},catalogo:planosDaCidade});
 a.equal(consultado.cep,'74480150');a.equal(r.estado.etapa,'complemento');a.equal(r.estado.documentos.rg_frente.length,0);
});
test('leitor de imagem e PDF retorna endereço extraído com evidência',async()=>{
 const payload={rg_frente:false,rg_verso:false,comprovante_endereco:false,texto_endereco:'CEP 74480-150',enderecos:[end('destinatario','74480-150')],leitura:'legivel'};
 const requests=[];const i=criarInterpretador({apiKey:'teste',catalogo:planosDaCidade,fetcher:async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>url.endsWith('/responses')?{output:[{content:[{type:'output_text',text:JSON.stringify(payload)}]}]}:{choices:[{message:{content:JSON.stringify(payload)}}]}};}});
 for(const mime of ['image/jpeg','application/pdf']){const r=await i.lerDocumento({buffer:Buffer.from('fixture'),mime,nome:'arquivo',pendente:'cep'});a.equal(r.enderecos[0].dados.cep,'74480150');}
 a.ok(requests.every(r=>r.store===false));
});
test('Petrolina sem índice pesquisa o endereço postal e cruza o CEP com a VTAL',async()=>{
 const chamadas=[];const q=criarConsulta({diretorio:require('node:path').join(__dirname,'indice-vtal'),fetcher:async url=>{chamadas.push(url);if(url.startsWith('https://viacep.com.br/'))return {ok:true,json:async()=>[{localidade:'Petrolina',uf:'PE',logradouro:'Rua Mar Cáspio',bairro:'Antônio Cassimiro',cep:'56321-470'}]};return {ok:true,json:async()=>({total:0,cepTotal:0,pageSize:30,results:[],locations:[],facets:{logradouro:[],numero:[],complemento1:[],complemento2:[],complemento3:[]}})};}});
 const c=await q({cidade:'Petrolina',uf:'PE',logradouro:'Rua Mar Cáspio',numero:'441'});a.equal(c.status,'sem_disponibilidade_na_base');a.equal(c.cep,'56321470');a.equal(chamadas.length,2);a.match(chamadas[0],/viacep/);a.match(chamadas[1],/cep=56321470/);
});
test('conflito Fortaleza/Juazeiro nunca vira pergunta genérica de complemento',async()=>{
 let s=inicial();s.apresentou=true;s.etapa='complemento';s.dados={cidade:'Juazeiro do Norte',estado:'CE',cep:'60135040',quadra:'E',logradouro:'Rua P 5'};s.enderecosMidia=[{papel:'emitente',dados:{cep:'60135040'}}];
 for(const texto of ['São Sebastião 2','quadra E','rua p 5']){const r=await avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:async()=>({dados:{}}),consultar:async()=>({status:'localidade_divergente',localidades:['FORTALEZA / CE']}),catalogo:planosDaCidade});s=r.estado;a.match(r.mensagem,/empresa que emitiu/);a.match(r.mensagem,/FORTALEZA/);a.match(r.mensagem,/CEP da instalação/);a.doesNotMatch(r.mensagem,/dado que diferencia/);}
 a.equal(interpretarEndereco('rua p 5').logradouro,'RUA P 5');a.equal(interpretarEndereco('rua p 5').numero,'');
});
test('pedido para aguardar mantém dados e não repete pergunta',async()=>{
 const s=inicial();s.etapa='cep';s.dados={cidade:'Juazeiro do Norte',estado:'CE'};const r=await avancar({estado:s,entrada:'espela',extrair:async()=>{throw Error('Não precisa IA');}});a.equal(r.estado.etapa,'cep');a.match(r.mensagem,/vou aguardar/);a.doesNotMatch(r.mensagem,/CEP|\?/);
});
test('mídia base64 válida vira arquivo; conteúdo inválido não é decodificado; pin preserva coordenadas',()=>{
 const jpeg=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(600,1)]),raw=jpeg.toString('base64');a.equal(recuperarCorpo(raw).ext,'jpg');a.deepEqual(recuperarCorpo('data:image/jpeg;base64,'+raw).buffer,jpeg);
 a.equal(recuperarCorpo('A'.repeat(800)),null);a.equal(recuperarCorpo(raw+'%'),null);a.equal(recuperarCorpo('texto '+raw),null);
 const pin=textoLocalizacao({location:{latitude:-7.2322554,longitude:-39.2688788,description:''},body:raw});a.match(pin,/-7.2322554/);a.doesNotMatch(pin,/não processado|\/9j\//);
});
