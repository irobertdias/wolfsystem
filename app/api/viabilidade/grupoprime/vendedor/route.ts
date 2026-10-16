import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirModulo, exigirPermissao, respostaErroAcesso, supabaseServer } from '../../../_auth';
import { criarVendedorGrupoPrime, NOME_VENDEDOR_GRUPOPRIME } from '../../../../lib/vendedor-grupoprime';
import { tokenConsultaGrupoPrime } from '../_auth';

export async function POST(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, 'grupoprime');
    exigirPermissao(acesso, 'configuracoes_workspace');
    await exigirModulo(acesso, 'modulo_vendedor_ia');
    const { data: existente, error: erroBusca } = await supabaseServer.from('fluxos').select('id').eq('workspace_id', 'grupoprime').eq('nome', NOME_VENDEDOR_GRUPOPRIME).limit(1).maybeSingle();
    if (erroBusca) throw erroBusca;
    if (existente) return NextResponse.json({ success: true, id: existente.id, criado: false });
    // Origem vem da própria implantação, nunca de um corpo fornecido pelo usuário.
    const fluxo = criarVendedorGrupoPrime(request.nextUrl.origin, tokenConsultaGrupoPrime());
    const { data, error } = await supabaseServer.from('fluxos').insert(fluxo).select('id').single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id, criado: true, pendencias: ['Configurar chave IA', 'Escolher fila humana', 'Vincular canal de tráfego e ativar'] }, { status: 201 });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: status === 500 ? 'Não foi possível preparar o vendedor.' : message }, { status });
  }
}
