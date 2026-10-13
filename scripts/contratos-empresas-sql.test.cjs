const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {PGlite}=require(process.env.WOLF_PGLITE_MODULE||'@electric-sql/pglite');
const anterior=fs.readFileSync('supabase/migrations/20260731_assinatura_wolf_envelopes.sql','utf8');
const base=anterior.slice(anterior.indexOf('create table if not exists public.assinatura_wolf_empresas'),anterior.indexOf('create table if not exists public.assinatura_wolf_signatarios'));
const migration=fs.readFileSync('supabase/migrations/20261013_contratos_multiplas_empresas.sql','utf8');
const empresa=(cnpj='12345678000190',nome='Empresa Alpha')=>({razao_social:nome,nome_fantasia:nome,cnpj,endereco_completo:'Rua das Empresas 123',email:'empresa@example.com',telefone:'11999999999'});
const rep=(nome='Representante Alpha')=>({nome,cpf:'12345678901',cargo:'Diretor',email:'rep@example.com',numero:'11999999999',padrao:true});
test('varias empresas por workspace com isolamento e salvamento atomico',async t=>{
 const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role;'+base);
 const legado=(await db.query("insert into assinatura_wolf_empresas(workspace_id,razao_social,cnpj,endereco_completo,email) values ('ws','Empresa Antiga','11111111000111','Endereco Antigo 123','antiga@example.com') returning id")).rows[0].id;
 await db.exec("create table historico_teste(empresa_snapshot jsonb); insert into historico_teste values ('{\"empresa_id\":\""+legado+"\",\"cnpj\":\"11111111000111\"}');");
 await db.exec(migration);
 const salvar=async(ws,id,emp,reps)=> (await db.query('select assinatura_wolf_salvar_empresa($1,$2,$3::jsonb,$4::jsonb) as cadastro',[ws,id,JSON.stringify(emp),JSON.stringify(reps)])).rows[0].cadastro;
 let a,b,c;
 await t.test('preserva empresa existente e permite dois CNPJs no mesmo workspace',async()=>{
  assert.equal((await db.query('select id from assinatura_wolf_empresas')).rows[0].id,legado);
  a=await salvar('ws',null,empresa(),[rep()]);b=await salvar('ws',null,empresa('22222222000122','Empresa Beta'),[rep('Representante Beta')]);
  assert.notEqual(a.empresa.id,b.empresa.id);assert.equal((await db.query("select count(*)::int as n from assinatura_wolf_empresas where workspace_id='ws'")).rows[0].n,3);
 });
 await t.test('editar uma empresa nao desativa representantes da outra',async()=>{
  a=await salvar('ws',a.empresa.id,{...empresa(),razao_social:'Empresa Alpha Editada'},[{...a.representantes[0],nome:'Representante Alpha Editado'}]);
  assert.equal((await db.query('select ativo from assinatura_wolf_representantes where id=$1',[b.representantes[0].id])).rows[0].ativo,true);
 });
 await t.test('CNPJ repetido no mesmo workspace nao cria cadastro parcial',async()=>{
  await assert.rejects(salvar('ws',null,empresa(),[rep()]),/unique|duplicate/i);
  assert.equal((await db.query("select count(*)::int as n from assinatura_wolf_empresas where workspace_id='ws'")).rows[0].n,3);
  c=await salvar('outro',null,empresa(),[rep()]);assert.ok(c.empresa.id);
 });
 await t.test('dados invalidos preservam empresa e representantes ativos',async()=>{
  await assert.rejects(salvar('ws',a.empresa.id,{...empresa(),razao_social:'Nome que nao pode ser salvo'},[{...a.representantes[0],email:'invalido'}]),/representante/i);
  assert.equal((await db.query('select razao_social from assinatura_wolf_empresas where id=$1',[a.empresa.id])).rows[0].razao_social,'Empresa Alpha Editada');
  assert.equal((await db.query('select ativo from assinatura_wolf_representantes where id=$1',[a.representantes[0].id])).rows[0].ativo,true);
 });
 await t.test('nao permite alterar empresa ou representante de outro workspace',async()=>{
  await assert.rejects(salvar('ws',c.empresa.id,empresa(),[rep()]),/workspace/);
  await assert.rejects(salvar('ws',a.empresa.id,empresa(),[c.representantes[0]]),/pertence/);
  await assert.rejects(salvar('ws',a.empresa.id,empresa(),[b.representantes[0]]),/pertence/);
 });
 await t.test('representante padrao respeita escolha do segundo representante',async()=>{
  const salvo=await salvar('ws',a.empresa.id,empresa(),[{...a.representantes[0],padrao:false},{...rep('Segundo Representante'),padrao:true}]);
  assert.equal(salvo.representantes.filter(r=>r.padrao).length,1);assert.equal(salvo.representantes.find(r=>r.padrao).nome,'Segundo Representante');
 });
 await t.test('snapshots dos contratos antigos nao mudam ao editar cadastros',async()=>{
  const snapshot=(await db.query('select empresa_snapshot from historico_teste')).rows[0].empresa_snapshot;
  assert.equal(snapshot.empresa_id,legado);assert.equal(snapshot.cnpj,'11111111000111');
 });
 await t.test('RPC exige service_role e migracao pode ser reaplicada',async()=>{
  await db.exec('set role authenticated');await assert.rejects(salvar('ws',null,empresa('33333333000133'),[rep()]),/permission denied/);
  await db.exec('reset role');await db.exec(migration);assert.equal((await db.query('select count(*)::int as n from assinatura_wolf_empresas')).rows[0].n,4);
 });
 await db.close();
});
