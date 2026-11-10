import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// "Acessar como cliente": gera um código de acesso de uso único para o login
// master de um cliente, para o super admin entrar no workspace e dar suporte
// sem precisar da senha. Só o super admin chama. Cada acesso fica registrado.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ADMIN_EMAIL = "robert.dias@live.com";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  const { data: quem, error: eQuem } = await supabase.auth.getUser(auth.substring(7));
  const adminEmail = quem?.user?.email?.toLowerCase() || "";
  if (eQuem || adminEmail !== ADMIN_EMAIL) return NextResponse.json({ success: false, error: "Acesso exclusivo do super administrador" }, { status: 403 });

  const { cadastroId } = await req.json().catch(() => ({}));
  if (!cadastroId) return NextResponse.json({ success: false, error: "Cliente não informado" }, { status: 400 });

  const { data: cad } = await supabase.from("cadastros").select("id, email, nome, username").eq("id", cadastroId).maybeSingle();
  if (!cad?.email) return NextResponse.json({ success: false, error: "Cliente não encontrado" }, { status: 404 });
  if (cad.email.toLowerCase() === ADMIN_EMAIL) return NextResponse.json({ success: false, error: "Esse é o seu próprio login" }, { status: 400 });

  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: cad.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return NextResponse.json({ success: false, error: error?.message || "Não foi possível gerar o acesso" }, { status: 400 });

  // Registro do acesso (a tabela é opcional: se não existir, fica só no log do servidor).
  console.log(`[acessar-cliente] ${adminEmail} gerou acesso para ${cad.email} (@${cad.username})`);
  await supabase.from("acessos_suporte").insert([{ admin_email: adminEmail, cliente_email: cad.email, workspace: cad.username }]).then(() => undefined, () => undefined);

  return NextResponse.json({ success: true, tokenHash, email: cad.email, nome: cad.nome, workspace: cad.username }, { headers: { "Cache-Control": "no-store" } });
}
