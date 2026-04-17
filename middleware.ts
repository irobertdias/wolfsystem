import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Se acessar app.wolfgyn.com.br e não estiver em /login, /crm, /chatbot, /register, /nova-senha
  if (host.startsWith("app.")) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Se acessar www.wolfgyn.com.br e tentar acessar /login diretamente, deixa passar
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.png).*)"],
};