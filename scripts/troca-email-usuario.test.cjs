const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../app/lib/troca-email-usuario.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: modulo.exports });
const { trocarEmailUsuarioComVinculos } = modulo.exports;
const antigo = 'gustavo_teste@empresa.com', novo = 'jose@empresa.com';
const entrada = { workspaceId:'ws', usuarioId:116, authId:'auth-id', emailAntigo:antigo, emailNovo:novo, dadosUsuario:{ nome:'José Carlos', canais_acesso:[134] } };
function montar({ falharTabela, falharLeitura, quantidade = 3 } = {}) {
  const tabelas = {
    atendimentos: Array.from({ length:quantidade }, (_, i) => ({ id:i+1, workspace_id:'ws', atendente:antigo, atendente_finalizou:i % 2 ? antigo : null, status:i % 2 ? 'resolvido' : 'aberto' })),
    proposta:[{id:1,workspace_id:'ws',vendedor:antigo}],
    roleta_config:[{id:1,workspace_id:'ws',usuarios:[antigo,novo,'outro@empresa.com']}],
    usuarios_workspace:[{id:116,workspace_id:'ws',user_id:'auth-id',email:antigo,nome:'Gustavo',canais_acesso:[134]}],
  };
  tabelas.atendimentos.push({id:99999,workspace_id:'outro',atendente:antigo,atendente_finalizou:antigo});
  const usuario = { email:antigo, user_metadata:{nome:'Gustavo',foto_url:'foto-preservada'} };
  let falhou = false, escritas = 0, authWrites = 0;
  const db = { auth:{admin:{ getUserById:async()=>({data:{user:structuredClone(usuario)},error:null}), updateUserById:async(id,patch)=>{
    assert.equal(id,'auth-id');authWrites++;Object.assign(usuario,structuredClone(patch));return{error:null};
  }}},from(tabela){
    let filtros=[], inicio=0, fim=Infinity, patch=null, unico=false;
    const q={ select(){return q;},eq(k,v){filtros.push(r=>r[k]===v);return q;},
      ilike(k,v){ assert.ok(!v.includes('_') || v.includes('\\_')); const literal=v.replace(/\\([\\%_])/g,'$1'); filtros.push(r=>String(r[k]||'').toLowerCase()===literal.toLowerCase());return q;},
      in(k,ids){filtros.push(r=>ids.includes(r[k]));return q;},order(){return q;},range(a,b){inicio=a;fim=b;return q;},single(){unico=true;return q;},
      update(p){patch=p;return q;},then(resolve){
        if ((!patch && tabela===falharLeitura) || (patch && tabela===falharTabela && !falhou)) {falhou=true;return Promise.resolve(resolve({data:null,error:{message:'falha simulada'}}));}
        const rows=tabelas[tabela].filter(r=>filtros.every(fn=>fn(r))).slice(inicio,fim+1);
        if(patch){escritas++;rows.forEach(r=>Object.assign(r,structuredClone(patch)));}
        return Promise.resolve(resolve({data:unico?structuredClone(rows[0]||null):structuredClone(rows),error:null}));
      }};return q;
  }};
  return{db,tabelas,usuario,stats:()=>({escritas,authWrites})};
}
test('troca e-mail conserva atendimentos abertos/finalizados, CRM, roleta e UUID sem atingir outro workspace',async()=>{
  const b=montar();const resultado=await trocarEmailUsuarioComVinculos(b.db,entrada);
  assert.equal(b.tabelas.atendimentos[0].atendente,novo);
  assert.equal(b.tabelas.atendimentos[1].atendente_finalizou,novo);
  assert.equal(b.tabelas.atendimentos[1].status,'resolvido');
  assert.equal(b.tabelas.atendimentos.at(-1).atendente,antigo);
  assert.equal(b.tabelas.proposta[0].vendedor,novo);
  assert.equal(b.tabelas.roleta_config[0].usuarios.join(),[novo,'outro@empresa.com'].join());
  assert.equal(b.tabelas.usuarios_workspace[0].email,novo);
  assert.equal(b.tabelas.usuarios_workspace[0].user_id,'auth-id');
  assert.equal(b.usuario.user_metadata.nome,'José Carlos');
  assert.equal(b.usuario.user_metadata.foto_url,'foto-preservada');
  assert.ok(resultado.referenciasAtualizadas>0);
});
test('migra todos os atendimentos mesmo acima do limite de 1000 registros',async()=>{
  const b=montar({quantidade:1101});await trocarEmailUsuarioComVinculos(b.db,entrada);
  assert.equal(b.tabelas.atendimentos.filter(r=>r.workspace_id==='ws'&&r.atendente===novo).length,1101);
});
test('falha no CRM ou no cadastro restaura login e referencias ja alteradas',async()=>{
  for(const falharTabela of ['proposta','usuarios_workspace']){
    const b=montar({falharTabela});const antes=structuredClone(b.tabelas);
    await assert.rejects(trocarEmailUsuarioComVinculos(b.db,entrada),/cancelada/);
    assert.deepEqual(b.tabelas,antes);assert.equal(b.usuario.email,antigo);assert.equal(b.usuario.user_metadata.nome,'Gustavo');
  }
});
test('falha ao conferir referencias nao muda login nem dados',async()=>{
  const b=montar({falharLeitura:'proposta'});await assert.rejects(trocarEmailUsuarioComVinculos(b.db,entrada),/conferir/);
  assert.equal(b.stats().authWrites,0);assert.equal(b.stats().escritas,0);
});
