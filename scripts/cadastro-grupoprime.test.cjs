const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const mod={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/cadastro-grupoprime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod});
const grafo=mod.blocosCadastroGrupoPrime('teste');
function fixture(){return {nome:'Pessoa Teste',cpf:'52998224725',nome_mae:'Mae Teste',data_nascimento:'01/01/1990',email:'teste@example.com',endereco_completo:'Rua Teste 10, Centro, Goiânia GO',cep:'74480150',telefone1:'62999990001',telefone2:'6233330002',vencimento:'31',forma_pagamento:'CARTAO',plano_interesse:'pf-fibra-padrao',tipo_pessoa:'PF'};}
function confirmar(vars){const codigo=grafo.nos.find(n=>n.id==='prime_cadastro_confirmado').dados.codigo;new Function('variaveis','setVariable',codigo)(vars,(k,v)=>{vars[k]=v;});return vars;}
test('cadastro contém todos os dados do resumo e não aceita documentos antes da confirmação',()=>{
 const no=grafo.nos.find(n=>n.id==='prime_cadastro_ia');
 assert.deepEqual(Array.from(no.dados.variaveis,v=>v.nome),['nome','cpf','nome_mae','data_nascimento','email','endereco_completo','cep','telefone1','telefone2','vencimento','forma_pagamento']);
 assert.ok(no.dados.variaveis.every(v=>v.obrigatoria));assert.equal(no.dados.arquivos_salvar_regras,undefined);
 assert.match(no.dados.prompt,/resumo completo novamente/);
 assert.equal(grafo.conexoes.find(c=>c.de==='prime_cadastro_ia'&&c.saidaIndex===0).para,'prime_cadastro_confirmado');
 assert.equal(grafo.conexoes.find(c=>c.de==='prime_cadastro_liberado'&&c.saidaIndex===1).para,'prime_cadastro_ia');
});
test('confirmação isolada do endereço não libera cadastro; endereço proposto é preservado para nova confirmação',()=>{
 const vars={endereco_completo:'Rua Teste 10',cadastro_confirmado:'antigo'};
 new Function('variaveis','setVariable',grafo.nos[0].dados.codigo)(vars,(k,v)=>{vars[k]=v;});
 assert.equal(vars.endereco_proposto,'Rua Teste 10');assert.equal(vars.endereco_completo,undefined);assert.equal(vars.cadastro_confirmado,undefined);
 confirmar(vars);assert.equal(vars.cadastro_valido,'NAO');assert.equal(vars.cadastro_confirmado,undefined);
});
test('corrigir um dado exige nova confirmação e preserva os outros dados',()=>{
 const vars=confirmar(fixture());assert.equal(vars.cadastro_valido,'SIM');assert.equal(mod.conferirCadastroGrupoPrime(vars).vencimento,'31');
 vars.email='corrigido@example.com';assert.throws(()=>mod.conferirCadastroGrupoPrime(vars),e=>e.statusCode===422);
 confirmar(vars);assert.equal(mod.conferirCadastroGrupoPrime(vars).email,'corrigido@example.com');assert.equal(vars.nome,'Pessoa Teste');
});
test('vencimentos de 1 a 31, pagamento e dois números diferentes são obrigatórios antes dos documentos',()=>{
 for(const dia of [1,15,28,29,30,31]){const vars=confirmar({...fixture(),vencimento:String(dia)});assert.equal(mod.conferirCadastroGrupoPrime(vars).vencimento,String(dia));}
 for(const mudanca of [{email:'invalido'},{vencimento:'32'},{vencimento:'0'},{telefone2:'62999990001'},{telefone1:'123'},{forma_pagamento:'qualquer'}]){
  const vars=confirmar({...fixture(),...mudanca});assert.equal(vars.cadastro_valido,'NAO');assert.equal(vars.cadastro_confirmado,undefined);
 }
 for(const forma_pagamento of ['CARTAO','BOLETO','PIX'])assert.equal(mod.conferirCadastroGrupoPrime(confirmar({...fixture(),forma_pagamento})).forma_pagamento,forma_pagamento);
});
