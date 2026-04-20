import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, workspace_id } = await req.json();

  if (!email || !workspace_id) {
    return NextResponse.json({ success: false, error: "Campos obrigatórios faltando" });
  }

  try {
    // 1. Busca o user_id pelo email
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    // 2. Remove da tabela usuarios_workspace
    await supabase.from("usuarios_workspace").delete().eq("email", email).eq("workspace_id", workspace_id);

    // 3. Remove do Auth se encontrou
    if (user) {
      await supabase.auth.admin.deleteUser(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}