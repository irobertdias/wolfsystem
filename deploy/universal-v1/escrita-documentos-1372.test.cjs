'use strict';
// Cada caso usa uma mensagem distinta e exige avanço real dos dois motores,
// com extração de IA vazia: o acerto não é fornecido pelo mock.
const {test}=require('node:test'),a=require('node:assert/strict');
const {inicial,avancar}=require('./conversa.cjs'),gen=require('./generico.cjs');
const {planosDaCidade}=require('./planos-grupoprime.cjs');
const {documentoDoTexto}=require('./normalizacao-entrada.cjs');
const separadores=[' ','.','-','_','/','\n',' — '],prefixos=['','CPF: ','meu cpf eh ','c.p.f = '],vistos=new Set();
for(const prefixo of prefixos)for(const x of separadores)for(const y of separadores)for(const z of separadores){
 const texto=prefixo+'529'+x+'982'+y+'247'+z+'25';a.ok(!vistos.has(texto));vistos.add(texto);
 test('CPF define PF e mostra planos sem repetir modalidade: '+JSON.stringify(texto),async()=>{
  const s=inicial();s.apresentou=true;s.etapa='tipo_pessoa';s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',numero:'12'};
  const r=await avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:async()=>({dados:{}}),consultar:async()=>({status:'disponivel_na_base',cep:'74480150',resultados:[{logradouro:'RUA A',numero:'12',bairro:'CENTRO'}]}),catalogo:planosDaCidade});
  a.equal(r.estado.dados.cpf,'52998224725');a.equal(r.estado.dados.tipo_pessoa,'PF');a.equal(r.tipo,'ofertas');a.match(r.mensagem,/600 Mega/);a.doesNotMatch(r.mensagem,/CPF ou CNPJ|Só falta confirmar|pode esclarecer/);a.equal(r.estado.plano,undefined);
  const g=await gen.avancar({estado:{dados:{},historico:[],documentos:{},anexos:[],pendencias:[],apresentou:true,pendente:'cliente_tipo_pessoa'},texto,numero:'5500000000000',nicho:{coleta:[{variavel:'cliente_tipo_pessoa',tipo:'texto',etapa:'antes_oferta',obrigatorio:true},{variavel:'titular_documento',tipo:'cpf',obrigatorio:true}],exigir_oferta:true,catalogo:[{id:'pf',nome:'Plano configurado',preco:50}],documentos_config:[]},assistente:{},vars:{},extrair:async()=>({dados:[]})});
  a.equal(g.estado.dados.cliente_tipo_pessoa,'PF');a.equal(g.estado.dados.titular_documento,'52998224725');a.match(g.mensagem,/Plano configurado/);a.equal(g.estado.oferta,undefined);
 });
}
a.equal(vistos.size,1372);
test('número truncado, telefone, preço e CPF com dígito inventado não definem modalidade',()=>{for(const t of ['5299822472','5511999999999','R$ 110,00','5299822472O','529 982 abc 247 25'])a.equal(documentoDoTexto(t),null);});
test('CNPJ informado na modalidade preenche PJ e documento sem pedir CPF/CNPJ novamente',async()=>{const {dadosContextuais}=require('./normalizacao-entrada.cjs');for(const t of ['12.345.678/0001-90','CNPJ: 12_345_678_0001_90','meu cnpj eh 12 345 678 0001 90']){const d=dadosContextuais([{variavel:'tipo_pessoa'},{variavel:'empresa_documento',tipo:'cnpj'}],'tipo_pessoa',t);a.equal(d.tipo_pessoa,'PJ');a.equal(d.empresa_documento,'12345678000190');}});
for(const texto of ['fizica','fisica','pessoa física','pesssoa fisica','no cpf','c p f','c.p.f','vai ser CPF','PF'])test('modalidade informal '+texto,()=>a.equal(require('./normalizacao-entrada.cjs').modalidadeDoTexto(texto),'PF'));
