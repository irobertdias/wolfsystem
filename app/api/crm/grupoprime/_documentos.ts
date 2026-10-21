import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarCpf } from '../../../lib/recuperacao-cpf-grupoprime';
import { REGRAS_DOCUMENTOS_GRUPOPRIME } from '../../../lib/documentos-grupoprime';

function falhar(message: string, statusCode = 422): never { throw Object.assign(new Error(message), { statusCode }); }
export type DocumentoPrivado = { url: string; nome: string; tipo: string; tamanho: number; privado: true; categoria: string; regra_id: string; enviado_em: string };

export async function documentosDaSessaoGrupoPrime(db: SupabaseClient, numeroEntrada: unknown, cpfEsperado: string, propostaId?: number, fluxoVero=false) {
  const numero = typeof numeroEntrada === 'string' ? numeroEntrada.replace(/\D/g, '') : '';
  if (!/^\d{10,15}$/.test(numero)) falhar('Atendimento inválido.');
  let fluxoId=27;
  if(fluxoVero){const {data:f,error}=await db.from('fluxos').select('id,nos').eq('workspace_id','grupoprime').eq('id',28).single();if(error||!f||!f.nos?.some((n:{id:string;dados?:{perfil_vendedor?:string}})=>n.id==='prime_vendedor'&&n.dados?.perfil_vendedor==='vero-v1'))falhar('Fluxo Vero não encontrado.',409);fluxoId=f.id;}
  let query = db.from('fluxo_sessoes').select('id,canal_id,numero,variaveis,updated_at,expira_em')
    .eq('workspace_id', 'grupoprime').eq('fluxo_id', fluxoId).eq('status', 'ativo').in('numero', [numero, `+${numero}`]);
  if (propostaId) query = query.eq('variaveis->>proposta_id', String(propostaId));
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(2);
  if (error) throw error;
  if (!data?.length) falhar('Sessão de coleta dos documentos não encontrada.');
  if (data.length !== 1) falhar('Mais de um atendimento ativo. Encaminhe ao BKO para conferência.', 409);
  const sessao = data[0];
  const vars = sessao.variaveis || {};
  if (sessao.expira_em && new Date(sessao.expira_em) < new Date()) falhar('Sessão de coleta expirada.');
  cpfEsperado = cpfEsperado || normalizarCpf(vars.cpf);
  if (!cpfEsperado || normalizarCpf(vars.cpf) !== cpfEsperado) falhar('Os documentos devem ser do titular informado.');
  // O CEP extraído do comprovante é informativo e não bloqueia a conclusão.
  const clienteHash = createHash('sha256').update(`grupoprime:${sessao.canal_id}:${sessao.numero}`).digest('hex').slice(0, 24);
  const documentos: Record<string, DocumentoPrivado[]> = {};
  const caminhos = new Set<string>();
  const fotos = new Set<string>();
  for (const regra of REGRAS_DOCUMENTOS_GRUPOPRIME) {
    if (vars[`${regra.variavel}_validado`] !== 'SIM') falhar(`Documento obrigatório pendente: ${regra.nome}.`);
    let lista;
    try { lista = typeof vars[regra.variavel] === 'string' ? JSON.parse(vars[regra.variavel]) : vars[regra.variavel]; } catch { falhar(`Arquivo inválido: ${regra.nome}.`); }
    if (!Array.isArray(lista) || lista.length !== 1) falhar(`Envie o arquivo obrigatório: ${regra.nome}.`);
    const arquivo = lista[0];
    let url: URL;
    try { url = new URL(arquivo.url, 'https://app.wolfgyn.com.br'); } catch { falhar('Referência de documento inválida.'); }
    const path = url!.searchParams.get('path') || '';
    if (url!.origin !== 'https://app.wolfgyn.com.br' || url!.pathname !== '/api/documentos-clientes/arquivo'
      || url!.searchParams.get('workspaceId') !== 'grupoprime' || path.includes('..') || !path.startsWith(`grupoprime/${clienteHash}/arquivos/${regra.variavel}/`)
      || arquivo.privado !== true || arquivo.regra_id !== regra.id || caminhos.has(path)) falhar(`Documento não pertence a este atendimento: ${regra.nome}.`);
    caminhos.add(path);
    const { data: objeto, error: erroObjeto } = await db.storage.from('documentos-clientes').info(path);
    if (erroObjeto || !objeto) falhar(`O arquivo ${regra.nome} não está salvo. Envie novamente.`);
    const meta = (objeto.metadata || {}) as Record<string, unknown>;
    const mime = String(objeto.contentType || meta.mimetype || '');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime) && !(regra.variavel === 'comprovante_endereco' && mime === 'application/pdf')) falhar(`Formato inválido para ${regra.nome}.`);
    const tamanho = Number(objeto.size || meta.size || 0);
    if (!tamanho || tamanho > 15 * 1024 * 1024) falhar(`Arquivo vazio ou muito grande: ${regra.nome}.`);
    if (regra.variavel.startsWith('rg_')) {
      const fingerprint = String(objeto.etag || '');
      if (fingerprint && fotos.has(fingerprint)) falhar('Envie fotos diferentes da frente e do verso do RG.');
      if (fingerprint) fotos.add(fingerprint);
      // Coleta sem comparação de nome, CPF ou RG por OCR.
      // Origem privada, existência e duas fotos continuam obrigatórias.
    }
    documentos[regra.variavel] = [{ url: `${url!.pathname}${url!.search}`, nome: String(arquivo.nome || regra.nome), tipo: mime,
      tamanho, privado: true, categoria: regra.nome, regra_id: regra.id, enviado_em: String(arquivo.enviado_em || '') }];
  }
  return { documentos, sessao, variaveis: vars };
}
