const REFERENCIAS = [
  ["atendimentos", "atendente"],
  ["atendimentos", "atendente_finalizou"],
  ["proposta", "vendedor"],
] as const;
const igual = (a: unknown, b: string) => String(a || "").trim().toLowerCase() === b.toLowerCase();
const escaparLike = (email: string) => email.replace(/[\\%_]/g, "\\$&");
type Operacao = { tabela: string; coluna: string; ids: number[]; antes: any; depois: any };

// As referências são alteradas apenas dentro do workspace. Os IDs/valores
// anteriores permitem desfazer somente as linhas realmente alteradas em falha.
export async function trocarEmailUsuarioComVinculos(banco: any, entrada: {
  workspaceId: string; usuarioId: number; authId: string; emailAntigo: string;
  emailNovo: string; dadosUsuario: Record<string, unknown>;
}) {
  const { workspaceId, usuarioId, authId, emailAntigo, emailNovo, dadosUsuario } = entrada;
  if (!workspaceId || !authId || !usuarioId || igual(emailAntigo, emailNovo)) throw new Error("Troca de e-mail não identificada.");
  const { data: auth, error: erroAuth } = await banco.auth.admin.getUserById(authId);
  if (erroAuth || !auth.user || !igual(auth.user.email, emailAntigo)) throw new Error("O login não corresponde ao usuário que será alterado.");
  const operacoes: Operacao[] = [];
  for (const [tabela, coluna] of REFERENCIAS) {
    const porValor = new Map<string, number[]>();
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await banco.from(tabela).select(`id,${coluna}`).eq("workspace_id", workspaceId)
        .ilike(coluna, escaparLike(emailAntigo)).order("id", { ascending: true }).range(inicio, inicio + 999);
      if (error) throw new Error(`Não foi possível conferir os vínculos em ${tabela}: ${error.message}`);
      for (const linha of data || []) {
        if (!igual(linha[coluna], emailAntigo)) continue;
        const valor = linha[coluna];
        porValor.set(valor, [...(porValor.get(valor) || []), linha.id]);
      }
      if ((data || []).length < 1000) break;
    }
    for (const [antes, ids] of porValor) {
      for (let i = 0; i < ids.length; i += 100) operacoes.push({ tabela, coluna, antes, depois: emailNovo, ids: ids.slice(i, i + 100) });
    }
  }
  const { data: roletas, error: erroRoleta } = await banco.from("roleta_config").select("id,usuarios").eq("workspace_id", workspaceId);
  if (erroRoleta) throw new Error(`Não foi possível conferir a roleta: ${erroRoleta.message}`);
  for (const r of roletas || []) {
    if (!Array.isArray(r.usuarios) || !r.usuarios.some((v: string) => igual(v, emailAntigo))) continue;
    operacoes.push({ tabela: "roleta_config", coluna: "usuarios", ids: [r.id], antes: r.usuarios, depois: [...new Set(r.usuarios.map((v: string) => igual(v, emailAntigo) ? emailNovo : v))] });
  }
  const { data: usuario, error: erroUsuario } = await banco.from("usuarios_workspace").select("*")
    .eq("workspace_id", workspaceId).eq("id", usuarioId).eq("user_id", authId).single();
  if (erroUsuario || !usuario || !igual(usuario.email, emailAntigo)) throw new Error("O vínculo do usuário foi alterado. Atualize a página antes de tentar novamente.");
  const nome = typeof dadosUsuario.nome === "string" ? dadosUsuario.nome.trim() : "";
  const { error: erroLogin } = await banco.auth.admin.updateUserById(authId, {
    email: emailNovo, email_confirm: true,
    ...(nome ? { user_metadata: { ...auth.user.user_metadata, nome } } : {}),
  });
  if (erroLogin) throw new Error(`Falha ao atualizar login: ${erroLogin.message}`);

  const aplicadas: Operacao[] = [];
  try {
    for (const op of operacoes) {
      let q = banco.from(op.tabela).update({ [op.coluna]: op.depois }).eq("workspace_id", workspaceId).in("id", op.ids);
      if (!Array.isArray(op.antes)) q = q.eq(op.coluna, op.antes);
      const { data, error } = await q.select("id");
      if (error) throw new Error(`${op.tabela}: ${error.message}`);
      aplicadas.push({ ...op, ids: (data || []).map((r: { id: number }) => r.id) });
    }
    const { data: atualizado, error } = await banco.from("usuarios_workspace").update({ ...dadosUsuario, email: emailNovo })
      .eq("workspace_id", workspaceId).eq("id", usuarioId).eq("email", usuario.email).select("id").single();
    if (error || !atualizado) throw new Error(error?.message || "O usuário foi alterado durante a operação.");
    return { referenciasAtualizadas: aplicadas.reduce((total, op) => total + op.ids.length, 0) };
  } catch (error) {
    const falhas: string[] = [];
    const antes = Object.fromEntries(Object.keys(dadosUsuario).map(k => [k, usuario[k]]));
    const { error: erroUsuarioRestaurar } = await banco.from("usuarios_workspace").update({ ...antes, email: usuario.email }).eq("workspace_id", workspaceId).eq("id", usuarioId).eq("email", emailNovo);
    if (erroUsuarioRestaurar) falhas.push("usuário");
    for (const op of [...aplicadas].reverse()) {
      if (!op.ids.length) continue;
      let q = banco.from(op.tabela).update({ [op.coluna]: op.antes }).eq("workspace_id", workspaceId).in("id", op.ids);
      if (!Array.isArray(op.depois)) q = q.eq(op.coluna, op.depois);
      const { error: erro } = await q;
      if (erro) falhas.push(op.tabela);
    }
    const { error: erroRestaurar } = await banco.auth.admin.updateUserById(authId, { email: auth.user.email, email_confirm: true, user_metadata: auth.user.user_metadata || {} });
    if (erroRestaurar) falhas.push("login");
    throw new Error(falhas.length
      ? `Falha na troca de e-mail; a recuperação precisa de conferência em: ${falhas.join(", ")}.`
      : `A troca de e-mail foi cancelada e os vínculos anteriores foram restaurados: ${error instanceof Error ? error.message : String(error)}`);
  }
}
