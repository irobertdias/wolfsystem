import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_URL ||
  "https://api.wolfgyn.com.br";

const SUPER_ADMIN = "robert.dias@live.com";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function autenticarDocumentoCRM(request: NextRequest, workspaceId: string) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Não autenticado"), { statusCode: 401 });
  const token = authorization.slice(7).trim();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) throw Object.assign(new Error("Sessão inválida"), { statusCode: 401 });
  const email = user.email.toLowerCase();
  if (email === SUPER_ADMIN) return;

  const { data: workspace } = await supabaseAdmin.from("workspaces")
    .select("username,owner_id").eq("username", workspaceId).maybeSingle();
  if (!workspace) throw Object.assign(new Error("Workspace não encontrado"), { statusCode: 404 });
  if (workspace.owner_id === user.id) return;

  const { data: vinculo } = await supabaseAdmin.from("usuarios_workspace")
    .select("perfil,grupo_id").eq("workspace_id", workspaceId).ilike("email", user.email).maybeSingle();
  if (!vinculo) throw Object.assign(new Error("Workspace não autorizado"), { statusCode: 403 });
  if (vinculo.perfil === "Administrador") return;

  const { data: grupo } = vinculo.grupo_id
    ? await supabaseAdmin.from("grupos_permissao").select("permissoes").eq("id", vinculo.grupo_id).maybeSingle()
    : { data: null };
  const permissoes = (grupo?.permissoes || {}) as Record<string, boolean>;
  if (permissoes.crm_acessar !== true || (permissoes.vendas_proprio !== true && permissoes.vendas_equipe !== true)) {
    throw Object.assign(new Error("Sem permissão para visualizar documentos de vendas"), { statusCode: 403 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
    const storagePath = request.nextUrl.searchParams.get("path") || "";
    const nome = request.nextUrl.searchParams.get("nome") || "documento";
    if (!workspaceId || !storagePath || storagePath.includes("..")) {
      return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
    }

    await autenticarDocumentoCRM(request, workspaceId);
    const segredo = process.env.WOLF_SIGNATURE_PROXY_SECRET || "";
    if (segredo.length < 32) throw new Error("Proxy seguro dos documentos não configurado");

    const query = new URLSearchParams({ workspaceId, path: storagePath, nome });
    const response = await fetch(`${BACKEND}/documentos-clientes/arquivo?${query.toString()}`, {
      cache: "no-store",
      headers: { "X-Wolf-Signature-Proxy": segredo, Accept: "*/*" },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Documento indisponível" }));
      return NextResponse.json(
        { success: false, error: data.error || "Documento indisponível" },
        { status: response.status }
      );
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": response.headers.get("content-disposition") || `inline; filename="${nome.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const falha = error as { message?: string; statusCode?: number };
    const status = Number(falha.statusCode || 500);
    return NextResponse.json(
      { success: false, error: falha.message || "Erro interno" },
      { status: status >= 400 && status <= 599 ? status : 500 }
    );
  }
}
