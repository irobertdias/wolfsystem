import { NextResponse, type NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 MIDDLEWARE DE AUTENTICAÇÃO — Wolf System
// ───────────────────────────────────────────────────────────────────────────
// Bloqueia acesso a TODAS as rotas exceto:
//   • Página inicial (login/cadastro) — "/"
//   • Páginas públicas listadas abaixo
//   • Assets estáticos do Next (_next, imagens, etc)
//
// Se vc tentar abrir /admin, /crm, /chatbot, /api/whatsapp sem cookie de
// sessão Supabase válido, redireciona pra "/" automaticamente.
//
// ⚠️ AVISO: Esta camada NÃO substitui RLS no Supabase. É uma proteção contra
// acesso casual via URL. Pra blindar de verdade, ATIVE RLS nas tabelas.
// ═══════════════════════════════════════════════════════════════════════════

// Rotas públicas (acessíveis sem login)
// 🔧 AJUSTE: se sua tela de login não for "/", adicione aqui
const ROTAS_PUBLICAS = new Set<string>([
  "/",              // página inicial (provavelmente login/cadastro)
  "/login",
  "/cadastro",
  "/registrar",
  "/recuperar-senha",
  "/esqueci-senha",
  "/reset-senha",
  "/confirmar-email",
  "/termos",
  "/privacidade",
]);

// APIs públicas (sem auth) — login, signup, webhook do WhatsApp/Meta, etc.
const ROTAS_API_PUBLICAS = [
  "/api/auth",       // qualquer endpoint de auth (login, signup, callback)
  "/api/webhook",    // webhooks externos (Meta, etc) que não tem session
  "/api/health",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Assets estáticos do Next sempre passam
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/imagens/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/static/") ||
    pathname.startsWith("/public/") ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|mjs|woff2?|ttf|otf|map|json|txt|xml|webmanifest)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Rotas públicas passam
  if (ROTAS_PUBLICAS.has(pathname)) {
    return NextResponse.next();
  }

  // 3. APIs públicas passam
  if (ROTAS_API_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + "/"))) {
    return NextResponse.next();
  }

  // 4. Verifica se existe cookie de sessão Supabase
  //    Padrão: sb-<projeto>-auth-token (ssr) ou supabase-auth-token (legacy)
  const cookies = request.cookies.getAll();
  const temSessaoSupabase = cookies.some(c =>
    (c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value && c.value !== "null" && c.value.length > 10) ||
    (c.name === "supabase-auth-token" && c.value && c.value.length > 10)
  );

  if (!temSessaoSupabase) {
    // Redireciona pra página inicial salvando pra onde queria ir (pra voltar depois do login)
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirect", pathname);
    console.log(`🔒 [middleware] BLOQUEADO ${pathname} → redirecionando pra /`);
    return NextResponse.redirect(url);
  }

  // Tem cookie de sessão → deixa passar (a verificação fina é feita no layout/page)
  return NextResponse.next();
}

export const config = {
  // Aplica em todas as rotas, exceto assets já filtrados no código acima.
  // O matcher abaixo é uma camada extra de performance — evita o middleware rodar
  // em /_next/static (assets buildados), /_next/image (otimização de imagem) e favicon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};