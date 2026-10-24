'use strict';
// Synthetic conversation, real AI and read-only coverage; no CRM or WhatsApp writes.
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const dir=process.argv[2]||__dirname,{avancar}=require(path.join(dir,'conversa.cjs')),{criarConsulta}=require(path.join(dir,'vtal.cjs')),{criarInterpretador}=require(path.join(dir,'interpretacao.cjs')),{planosDaCidade}=require(path.join(dir,'planos-grupoprime.cjs'));
const ia=criarInterpretador({...JSON.parse(fs.readFileSync(path.join(dir,'credencial.json'))),catalogo:planosDaCidade}),q=criarConsulta({diretorio:path.join(dir,'indice-vtal')});
(async()=>{let s;
for(const [texto,esperado]of [['Oi','localidade'],['Goiânia GO','cep'],['Rua VM B quadra 4 lote 9 bairro Vila Mutirão I','tipo_pessoa'],['CPF','plano'],['110 pode ser esse','nome'],['Maria Exemplo','cpf'],['52998224725','data_nascimento'],['23 janeiro 2002','nome_mae'],['Ana Exemplo','email'],['maria@example.com','confirmar_endereco'],['tudo certo','telefone1'],['esse mesmo','vencimento'],['20','forma_pagamento'],['boleto','confirmacao'],['tudo ok','documentos']]){
 const r=await avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:ia.extrair,consultar:q,catalogo:planosDaCidade});s=r.estado;console.log(JSON.stringify({etapa:s.etapa,esperado}));if(s.etapa!==esperado)console.log(JSON.stringify({mensagem:r.mensagem,dados:s.dados}));a.equal(s.etapa,esperado);
}
a.equal(s.dados.cep,'74480150');const r=await avancar({estado:s,entrada:'Já enviei os três arquivos',numero:'5500000000000',extrair:ia.extrair,consultar:q,catalogo:planosDaCidade,anexos:[{path:'fixture/rg-frente',categorias:['rg_frente']},{path:'fixture/rg-verso',categorias:['rg_verso']},{path:'fixture/conta',categorias:['comprovante_endereco']}]});a.equal(r.acao,'registrar');console.log('NIO_COMPLETO_SEM_CEP_E_SEM_REPETIR_ENDERECO_OK_SEM_ESCRITA');
})().catch(e=>{console.error(e.message);process.exitCode=1});
