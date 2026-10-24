export type ContatoBko = { nome: string; numero: string; canal_trafego_id?: number | null; fila_nome?: string; operadora?: string; canal_envio_id?: number | null };
export type RegraRetorno = { resposta: string; status: string; mensagem_cliente: string; solicitar_agenda?: boolean };
export type ConfigBko = { ativo: boolean; canal_id: number | null; contatos: ContatoBko[]; canal_trafego_id?: number | null; fila_nome?: string; modo?: 'por_canal'; mensagem_venda?: string; modo_retorno?: 'automatico'|'fluxos'; retornos?: RegraRetorno[] };
export function numeroBko(valor: unknown) {
  const n = String(valor ?? '').trim().replace(/[\s()+.-]/g, '');
  const local = /^55\d{10,11}$/.test(n) ? n.slice(2) : n;
  return /^[1-9]\d[2-9]\d{7,8}$/.test(local) ? `55${local}` : '';
}
export function validarConfigBko(raw: unknown): ConfigBko {
  const falhar = (mensagem: string): never => { throw Object.assign(new Error(mensagem), { statusCode: 422 }); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) falhar('Configuração inválida.');
  const r = raw as Record<string, unknown>;
  if (typeof r.ativo !== 'boolean' || !Array.isArray(r.contatos) || r.contatos.length > 5) falhar('Cadastre até cinco contatos BKO.');
  const contatos: ContatoBko[] = (r.contatos as Record<string, unknown>[]).map(c => {
    const nome = String(c?.nome ?? '').trim();
    const numero = numeroBko(c?.numero);
    if (!numero || !nome || nome.length > 80) falhar('Informe nome e WhatsApp com DDD para cada BKO.');
    if(r.modo==='por_canal'){
      const canal_trafego_id=c.canal_trafego_id==null||c.canal_trafego_id===''?null:Number(c.canal_trafego_id);
      const fila_nome=String(c.fila_nome??'').trim();
      if(canal_trafego_id!==null&&(!Number.isSafeInteger(canal_trafego_id)||canal_trafego_id<=0))falhar('Canal de entrada inválido na regra BKO.');
      if(fila_nome.length>150)falhar('Fila inválida na regra BKO.');
      if(r.ativo&&(!canal_trafego_id||!fila_nome))falhar('Selecione o canal e a fila de entrada de cada BKO.');
      const operadora=String(c.operadora||'').trim();if(operadora.length>80)falhar('Operadora inválida.');
      const canal_envio_id=c.canal_envio_id==null||c.canal_envio_id===''?null:Number(c.canal_envio_id);if(canal_envio_id!==null&&(!Number.isSafeInteger(canal_envio_id)||canal_envio_id<=0))falhar('Canal de envio inválido.');
      return {nome,numero,canal_trafego_id,fila_nome,...(operadora?{operadora}:{}),...(canal_envio_id?{canal_envio_id}:{})};
    }
    return { nome, numero };
  });
  if(r.modo==='por_canal'){
    const origens=contatos.filter(c=>c.canal_trafego_id).map(c=>`${c.canal_trafego_id}:${(c.operadora||'*').toUpperCase()}`);
    if(new Set(origens).size!==origens.length)falhar('Cada canal e operadora deve ter uma única regra BKO.');
  }else if (new Set(contatos.map(c => c.numero)).size !== contatos.length) falhar('Não repita o mesmo número BKO.');
  const canal_id = r.canal_id == null || r.canal_id === '' ? null : Number(r.canal_id);
  if (canal_id !== null && (!Number.isSafeInteger(canal_id) || canal_id <= 0)) falhar('Canal inválido.');
  if (r.ativo && (!contatos.length || !canal_id)) falhar('Escolha o canal e pelo menos um contato BKO.');
  const canal_trafego_id = r.canal_trafego_id == null || r.canal_trafego_id === '' ? null : Number(r.canal_trafego_id);
  if (canal_trafego_id !== null && (!Number.isSafeInteger(canal_trafego_id) || canal_trafego_id <= 0)) falhar('Canal de tráfego inválido.');
  const fila_nome = String(r.fila_nome ?? '').trim();
  if (fila_nome.length > 150) falhar('Fila inválida.');
  const mensagem_venda=String(r.mensagem_venda||'');if(mensagem_venda.length>16000)falhar('Mensagem de venda excede o limite.');
  const retornos=Array.isArray(r.retornos)?r.retornos.map((v:any)=>({resposta:String(v.resposta||'').trim(),status:String(v.status||'').trim(),mensagem_cliente:String(v.mensagem_cliente||''),solicitar_agenda:v.solicitar_agenda===true})):undefined;
  if(retornos&&(retornos.length>30||retornos.some(v=>!v.resposta||!v.status||v.resposta.length>100||v.status.length>100||v.mensagem_cliente.length>3000)))falhar('Confira as regras de retorno: resposta, status e mensagem.');
  return { ativo: r.ativo as boolean, canal_id, contatos, canal_trafego_id, fila_nome, ...(r.modo==='por_canal'?{modo:'por_canal' as const}:{}),mensagem_venda,modo_retorno:r.modo_retorno==='fluxos'?'fluxos':'automatico',...(retornos?{retornos}:{}) };
}
export const STATUS_BKO = ['CPF REPROVADO', 'APROVADA', 'GERADA', 'AGUARDANDO INSTALAÇÃO', 'INSTALADA', 'SEM DISPONIBILIDADE', 'CANCELADA'];
export function interpretarRetornoBko(texto: string) {
  const refs = [...texto.matchAll(/#?BKO-\d+-[a-f0-9]{16}\b/gi)].map(m => m[0].replace(/^#/, '').toUpperCase());
  if (new Set(refs).size > 1) return null;
  const linhas = texto.replace(/#?BKO-\d+-[a-f0-9]{16}\b/gi, '').trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const primeiro = normalizar(linhas.shift() || '');
  const mapa: Record<string, string> = { 'APROVADO': 'APROVADA', 'APROVADA': 'APROVADA', 'CPF REPROVADO': 'CPF REPROVADO', 'GERADA': 'GERADA', 'AGUARDANDO INSTALACAO': 'AGUARDANDO INSTALAÇÃO', 'INSTALADA': 'INSTALADA', 'SEM DISPONIBILIDADE': 'SEM DISPONIBILIDADE', 'CANCELADA': 'CANCELADA', 'CANCELADO': 'CANCELADA' };
  const status = mapa[primeiro];
  if (!status || linhas.length > 2) return null;
  let data_agendamento: string | undefined, periodo_instalacao: string | undefined;
  for (const linha of linhas) {
    const data = /^DATA:\s*(\d{2})\/(\d{2})\/(\d{4})$/i.exec(linha);
    if (data && !data_agendamento) {
      const [, dia, mes, ano] = data;
      const d = new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
      if (+ano < 2000 || +ano > 2100 || d.getUTCDate() !== +dia || d.getUTCMonth() + 1 !== +mes || d.getUTCFullYear() !== +ano) return null;
      data_agendamento = `${dia}/${mes}/${ano}`;
    } else if (/^PERIODO:\s*(MANHA|TARDE)$/.test(normalizar(linha)) && !periodo_instalacao) {
      periodo_instalacao = normalizar(linha).endsWith('MANHA') ? 'Manhã' : 'Tarde';
    } else return null;
  }
  if ((data_agendamento || periodo_instalacao) && !['APROVADA','GERADA','AGUARDANDO INSTALAÇÃO'].includes(status)) return null;
  return { status, referencia: refs[0] || '', ...(data_agendamento ? { data_agendamento } : {}), ...(periodo_instalacao ? { periodo_instalacao } : {}) };
}
export function transicaoBkoPermitida(anterior: string, novo: string) {
  const mapa: Record<string, string[]> = {
    'AGUARDANDO AUDITORIA': STATUS_BKO.filter(s => s !== 'INSTALADA'),
    'APROVADA': ['GERADA','AGUARDANDO INSTALAÇÃO','CANCELADA'],
    'GERADA': ['AGUARDANDO INSTALAÇÃO','CANCELADA'],
    'AGUARDANDO INSTALAÇÃO': ['INSTALADA','CANCELADA'],
  };
  return anterior === novo || (mapa[anterior] || []).includes(novo);
}
