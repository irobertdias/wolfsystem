import { exigirPermissao, supabaseServer, type AcessoWolf } from '../_auth';
export const NOME_CONFIG_VENDAS = '__wolf_configuracao_vendas__';
export async function exigirVendas(acesso: AcessoWolf, configurar = false) {
  exigirPermissao(acesso, configurar ? 'configuracoes_workspace' : 'vendas_proprio', ...(configurar ? [] : ['vendas_equipe', 'configuracoes_workspace']));
  if (acesso.isSuperAdmin) return;
  const {data:ws,error}=await supabaseServer.from('workspaces').select('owner_email,ia').eq('username',acesso.workspaceId).single();if(error)throw error;
  if(ws.owner_email?.toLowerCase()==='robert.dias@live.com')return;
  const {data:cad}=await supabaseServer.from('cadastros').select('ia').ilike('email',ws.owner_email).maybeSingle();
  const ia=String(cad?.ia||ws.ia||'').toLowerCase();
  if(!ia||['nao','não','false','0'].includes(ia))throw Object.assign(Error('O módulo de IA não está liberado para este workspace.'),{statusCode:403});
}
export async function lerConfiguracaoVendas(workspaceId: string) {
  const r=await supabaseServer.from('fluxos').select('id,nos').eq('workspace_id',workspaceId).eq('nome',NOME_CONFIG_VENDAS).maybeSingle();if(r.error)throw r.error;
  return r.data;
}
