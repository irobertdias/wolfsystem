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

  // Subdomínio do escritório (ex.: clickconsultoria.wolfgyn.com.br): serve só o link
  // da proposta (/p/<token>) e as APIs que essa página chama. O resto vai para o app.
  if (HOSTS_PROPOSTA.has(host.split(":")[0])) {
    if (pathname.startsWith("/p/")) return NextResponse.rewrite(new URL(`/revisional${pathname}`, request.url));
    if (pathname.startsWith("/api/") || pathname.startsWith("/revisional/p/")) return NextResponse.next();
    return NextResponse.redirect(new URL(pathname === "/" ? "/" : pathname + request.nextUrl.search, "https://app.wolfgyn.com.br"));
  }

  return NextResponse.next();
}

/** Mesmos hosts de SUBDOMINIO_PROPOSTA (app/api/revisional/_shared.ts). */
const HOSTS_PROPOSTA = new Set(["clickconsultoria.wolfgyn.com.br", "aproveconsultoria.wolfgyn.com.br"]);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.png).*)"],
};