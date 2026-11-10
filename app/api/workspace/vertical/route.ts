import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tipo de negócio do workspace (workspaces.vertical). Sub-usuários não leem a
// tabela workspaces por causa da RLS, então o front pergunta aqui.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({ vertical: null }, { status: 401 });
  const { data: u, error: eu } = await supabase.auth.getUser(auth.substring(7));
  if (eu || !u.user) return NextResponse.json({ vertical: null }, { status: 401 });

  const ws = String(new URL(req.url).searchParams.get("ws") || "").trim();
  if (!ws) return NextResponse.json({ vertical: null });
  const { data, error } = await supabase.from("workspaces").select("vertical").ilike("username", ws).limit(1).maybeSingle();
  // Coluna ainda não criada no banco: o front segue com o tipo padrão.
  if (error) return NextResponse.json({ vertical: null });
  return NextResponse.json({ vertical: (data as any)?.vertical ?? null }, { headers: { "Cache-Control": "no-store" } });
}
