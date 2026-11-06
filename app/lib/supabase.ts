import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ⚡ Desempenho: cada parte da tela (guarda de acesso, cabeçalho, permissões,
// módulos, softphone, a própria página...) chamava auth.getUser(), e cada chamada
// é uma ida ao servidor de login (300–500 ms). Agora as chamadas sem token
// explícito compartilham a mesma resposta por 60 s; qualquer mudança de sessão
// (login, logout, renovação de token) descarta o cache na hora.
if (typeof window !== "undefined") {
  const getUserOriginal = supabase.auth.getUser.bind(supabase.auth);
  let cache: { promessa: ReturnType<typeof getUserOriginal>; em: number } | null = null;
  supabase.auth.getUser = ((jwt?: string) => {
    if (jwt) return getUserOriginal(jwt);
    if (cache && Date.now() - cache.em < 60_000) return cache.promessa;
    const promessa = getUserOriginal().then(resposta => {
      if (resposta.error || !resposta.data?.user) cache = null;
      return resposta;
    }, erro => { cache = null; throw erro; });
    cache = { promessa, em: Date.now() };
    return promessa;
  }) as typeof supabase.auth.getUser;
  supabase.auth.onAuthStateChange(evento => {
    if (evento !== "INITIAL_SESSION") cache = null;
  });
}
