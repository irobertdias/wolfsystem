// node --env-file=.env.local scripts/preparar-vendedor-grupoprime.cjs [--apply]
// Não ativa fluxos, não muda assinatura e não vincula uma conexão automaticamente.
const fs = require('node:fs');
const vm = require('node:vm');
const { createHmac } = require('node:crypto');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const exportsTemplate = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/vendedor-grupoprime.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsTemplate });

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: workspace, error: erroWs } = await db.from('workspaces').select('username,ativo,owner_email').eq('username', 'grupoprime').single();
  if (erroWs) throw erroWs;
  if (workspace.ativo !== true) throw Error('Workspace grupoprime desativado');
  const { data: cadastro, error: erroCadastro } = await db.from('cadastros').select('modulo_vendedor_ia').ilike('email', workspace.owner_email).maybeSingle();
  if (erroCadastro) throw erroCadastro;
  const { data: conexoes, error: erroConexoes } = await db.from('conexoes').select('id,nome,status').eq('workspace_id', 'grupoprime');
  if (erroConexoes) throw erroConexoes;
  const { data: existente, error: erroBusca } = await db.from('fluxos').select('id,nome,ativo').eq('workspace_id', 'grupoprime').eq('nome', exportsTemplate.NOME_VENDEDOR_GRUPOPRIME).limit(1).maybeSingle();
  if (erroBusca) throw erroBusca;
  console.log(JSON.stringify({ workspace: workspace.username, modulo_vendedor_ia: cadastro?.modulo_vendedor_ia === true, conexoes, existente }));
  if (!process.argv.includes('--apply') || existente) return;
  const segredo = process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw Error('Segredo ausente');
  const origem = process.env.WOLF_GRUPOPRIME_APP_ORIGIN || 'https://app.wolfgyn.com.br';
  if (new URL(origem).protocol !== 'https:') throw Error('Origem precisa usar HTTPS');
  const token = createHmac('sha256', segredo).update('wolf:viabilidade:grupoprime:v1').digest('hex');
  const fluxo = exportsTemplate.criarVendedorGrupoPrime(origem.replace(/\/$/, ''), token);
  const { data, error } = await db.from('fluxos').insert(fluxo).select('id,nome,ativo').single();
  if (error) throw error;
  console.log(JSON.stringify({ criado: data, pendencias: ['Publicar API no app', 'Configurar chave IA no bloco', 'Escolher fila e conexão do tráfego', 'Validar ponta a ponta e ativar'] }));
}
main().catch(error => { console.error(error.message || 'Falha ao preparar vendedor'); process.exitCode = 1; });
