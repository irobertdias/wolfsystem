import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario, autenticarWorkspace, respostaErroAcesso, WOLF_SESSION_COOKIE } from "../_auth";

export async function POST(request: NextRequest) {
  try {
    const identidade = await autenticarUsuario(request);
    if (!identidade.isSuperAdmin) await autenticarWorkspace(request);
    const token = (request.headers.get("authorization") || "").slice(7).trim();
    if (!token) return NextResponse.json({ error: "Token ausente" }, { status: 401 });
    const response = NextResponse.json({ success: true });
    response.cookies.set(WOLF_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
    return response;
  } catch (error) {
    const item = respostaErroAcesso(error);
    return NextResponse.json({ error: item.message }, { status: item.status });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(WOLF_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
