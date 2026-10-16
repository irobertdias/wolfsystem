// Recebe a chave pela entrada padrão, sem gravá-la em arquivo ou registrá-la.
const { createClient } = require('@supabase/supabase-js');
async function main() {
  let entrada = '';
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  console.log('Entrada protegida pronta');
  for await (const trecho of process.stdin) {
    entrada += trecho;
    if (/[\r\n]/.test(entrada)) break;
  }
  const chave = entrada.trim();
  entrada = '';
  if (!/^sk-[A-Za-z0-9_-]+$/.test(chave)) throw Error('Formato de chave inválido');
  const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Responda apenas OK.' }], max_tokens: 4, temperature: 0 }),
  });
  const teste = await resposta.json();
  if (!resposta.ok) throw Error(`OpenAI HTTP ${resposta.status}: ${teste.error?.code || teste.error?.type || 'erro na validação'}`);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: workspace, error: erroWs } = await db.from('workspaces').select('owner_email,ativo').eq('username', 'grupoprime').single();
  if (erroWs || !workspace?.ativo) throw Error('Workspace não encontrado ou inativo');
  const { data: fluxo, error: erroFluxo } = await db.from('fluxos').select('id,nos').eq('workspace_id', 'grupoprime').eq('id', 27).single();
  if (erroFluxo) throw Error('Vendedor não encontrado');
  const nos = fluxo.nos.map(no => no.tipo === 'fluxo_ia' ? { ...no, dados: { ...no.dados, apiKey: chave } } : no);
  const { error: erroSalvar } = await db.from('fluxos').update({ nos }).eq('workspace_id', 'grupoprime').eq('id', fluxo.id);
  if (erroSalvar) throw Error('Falha ao configurar chave no vendedor');
  const { error: erroModulo } = await db.from('cadastros').update({ modulo_vendedor_ia: true }).ilike('email', workspace.owner_email);
  if (erroModulo) throw Error('Chave salva, mas não foi possível habilitar o módulo');
  console.log(JSON.stringify({ openai: 'validada', modelo: teste.model, vendedor: fluxo.id, chave_configurada: true, modulo_vendedor_ia: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
