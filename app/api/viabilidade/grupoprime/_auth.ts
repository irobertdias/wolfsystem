import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { autenticarWorkspace, exigirPermissao } from '../../_auth';

// Credencial somente de leitura desta base. Não expõe a chave de serviço.
export function tokenConsultaGrupoPrime() {
  const segredo = process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw Object.assign(new Error('Consulta de viabilidade não configurada.'), { statusCode: 503 });
  return createHmac('sha256', segredo).update('wolf:viabilidade:grupoprime:v1').digest('hex');
}

export async function autenticarConsulta(request: NextRequest) {
  const token = request.headers.get('x-wolf-viabilidade-token');
  if (token !== null) {
    const esperado = tokenConsultaGrupoPrime();
    if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) {
      throw Object.assign(new Error('Credencial de consulta inválida.'), { statusCode: 401 });
    }
    return;
  }
  const acesso = await autenticarWorkspace(request, 'grupoprime');
  exigirPermissao(acesso, 'chat_proprio', 'chat_todos', 'proposta_criar');
}
