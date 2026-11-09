import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Subdomínio app.* na raiz "/" → vai pra página /redirect que decide
  // (logado vai pra /crm, deslogado vai pra /login).
  // A checagem real de sessão acontece no client (localStorage do Supabase).
  if (host.startsWith("app.") && pathname === "/") {
    return NextResponse.rewrite(new URL("/redirect", request.url));
  }

  // Subdomínio rev.* → módulo Revisional.
  //   rev.wolfgyn.com.br/          → painel do consultor (/revisional)
  //   rev.wolfgyn.com.br/p/<token> → proposta pública do cliente
  if (host.startsWith("rev.")) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/revisional", request.url));
    if (pathname.startsWith("/p/")) return NextResponse.rewrite(new URL(`/revisional${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.png).*)"],
};