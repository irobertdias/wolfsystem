import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Só atua na raiz "/" do subdomínio app.*
  if (host.startsWith("app.") && pathname === "/") {
    // 🆕 Verifica se há sessão Supabase ativa via cookie
    // Supabase v2 salva o token em cookie no formato: sb-<project-ref>-auth-token
    // (cookies tipo "-code-verifier" são do fluxo OAuth e não significam logado)
    const cookies = request.cookies.getAll();
    const temSessao = cookies.some(c =>
      c.name.startsWith("sb-") &&
      c.name.endsWith("-auth-token") &&
      c.value &&
      c.value.length > 10
    );

    if (temSessao) {
      // Tá logado → vai direto pro painel
      return NextResponse.rewrite(new URL("/crm", request.url));
    } else {
      // Não tá logado → vai pro login
      return NextResponse.rewrite(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.png).*)"],
};