import { NextRequest, NextResponse } from 'next/server';
import { consultarViabilidade } from '../../../lib/viabilidade-grupoprime';
import { respostaErroAcesso } from '../../_auth';
import { autenticarConsulta } from './_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await autenticarConsulta(request);
    const params = request.nextUrl.searchParams;
    const data = consultarViabilidade(params.get('cep'), params.get('cidade') || '', params.get('uf') || '');
    return NextResponse.json({ success: true, ...data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: status === 500 ? 'Falha ao consultar viabilidade.' : message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
