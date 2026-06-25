"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════
// 👤 /meu-perfil — Tela do próprio usuário pra editar seu cadastro
// ───────────────────────────────────────────────────────────────────────────
// Acesso: qualquer usuário logado (dono OR sub-usuário).
// Permite editar: nome, telefone, foto de perfil, senha.
// NÃO permite editar: email (só admin pode), perfil/grupo/equipe (idem).
//
// Foto: upload pro Supabase Storage (bucket `avatares`, public). URL salva
// em usuarios_workspace.foto_url (ou em auth.users.user_metadata pro dono).
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

export default function MeuPerfilPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Dados do usuário
  const [userId, setUserId] = useState<string>("");
  const [workspaceId, setWorkspaceId] = useState<string>("");  // 🔒 multi-tenant
  const [email, setEmail] = useState<string>("");
  const [nome, setNome] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const [perfil, setPerfil] = useState<string>("");
  const [workspaceNome, setWorkspaceNome] = useState<string>("");

  // Troca de senha
  const [senhaAtual, setSenhaAtual] = useState<string>("");
  const [novaSenha, setNovaSenha] = useState<string>("");
  const [confirmaSenha, setConfirmaSenha] = useState<string>("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  // Upload de foto
  const [uploadando, setUploadando] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);

  // ─── Carrega dados do usuário ───
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setEmail(user.email || "");

      // É dono de algum workspace?
      const { data: wsDono } = await supabase.from("workspaces")
        .select("nome, username, owner_email")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (wsDono) {
        setPerfil("Dono do Workspace");
        setWorkspaceId(wsDono.username || "");   // 🔒 multi-tenant
        setNome((user.user_metadata as any)?.nome || user.email?.split("@")[0] || "");
        setFotoUrl((user.user_metadata as any)?.foto_url || "");
        setTelefone((user.user_metadata as any)?.telefone || "");
        setWorkspaceNome(wsDono.nome || "");
      } else {
        // Sub-usuário
        const { data: usr } = await supabase.from("usuarios_workspace")
          .select("nome, perfil, telefone, foto_url, workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usr) {
          setWorkspaceId(usr.workspace_id || "");   // 🔒 multi-tenant
          setNome(usr.nome || "");
          setPerfil(usr.perfil || "Atendente");
          setTelefone(usr.telefone || "");
          setFotoUrl(usr.foto_url || "");

          const { data: ws } = await supabase.from("workspaces")
            .select("nome")
            .eq("username", usr.workspace_id)
            .maybeSingle();
          if (ws) setWorkspaceNome(ws.nome);
        }
      }

      setLoading(false);
    })();
  }, [router]);

  // ─── Upload da foto ───
  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    // Validações
    if (arquivo.size > 5 * 1024 * 1024) {
      alert("⚠️ Arquivo muito grande. Máximo 5 MB.");
      return;
    }
    if (!arquivo.type.startsWith("image/")) {
      alert("⚠️ Selecione uma imagem (PNG, JPG, JPEG ou WebP).");
      return;
    }

    setUploadando(true);
    try {
      const ext = arquivo.name.split(".").pop()?.toLowerCase() || "png";
      const caminho = `${userId}/avatar.${ext}`;

      // Upload com upsert (sobrescreve se já existir)
      const { error: uploadErr } = await supabase.storage
        .from("avatares")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

      if (uploadErr) {
        alert("❌ Falha ao subir foto: " + uploadErr.message);
        return;
      }

      // Pega URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("avatares")
        .getPublicUrl(caminho);

      // Adiciona cache-buster pra forçar reload
      const urlComCache = `${publicUrl}?t=${Date.now()}`;
      setFotoUrl(urlComCache);
    } catch (e: any) {
      alert("❌ Erro: " + e.message);
    } finally {
      setUploadando(false);
    }
  }

  // ─── Remover foto atual ───
  async function removerFoto() {
    if (!fotoUrl) return;
    if (!confirm("Tem certeza que quer remover sua foto de perfil?")) return;

    setRemovendoFoto(true);
    try {
      // Apaga TODOS os arquivos do path do user (avatar.png, avatar.jpg, etc)
      // Multi-tenant não se aplica aqui — o Storage usa user_id como namespace.
      const { data: arquivos } = await supabase.storage.from("avatares").list(userId);
      if (arquivos && arquivos.length > 0) {
        const paths = arquivos.map(a => `${userId}/${a.name}`);
        await supabase.storage.from("avatares").remove(paths);
      }

      // Limpa do state — o salvar() vai mandar foto_url="" pra API limpar do banco
      setFotoUrl("");

      // Persiste imediatamente (não precisa esperar clicar em Salvar)
      const { data: { session } } = await supabase.auth.getSession();
      if (session && workspaceId) {
        await fetch("/api/atualizar-usuario", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            modo: "proprio",
            workspace_id: workspaceId,
            foto_url: "",  // string vazia → API trata como null e limpa
          }),
        });
      }

      alert("✅ Foto removida!");
    } catch (e: any) {
      alert("❌ Erro ao remover foto: " + e.message);
    } finally {
      setRemovendoFoto(false);
    }
  }

  // ─── Salvar mudanças ───
  async function salvar() {
    // Validações de senha (se preencheu)
    if (novaSenha || confirmaSenha || senhaAtual) {
      if (!senhaAtual) {
        alert("⚠️ Informe sua senha atual pra trocar de senha");
        return;
      }
      if (!novaSenha) {
        alert("⚠️ Informe a nova senha");
        return;
      }
      if (novaSenha.length < 6) {
        alert("⚠️ Nova senha deve ter no mínimo 6 caracteres");
        return;
      }
      if (novaSenha !== confirmaSenha) {
        alert("⚠️ Confirmação de senha não bate com a nova senha");
        return;
      }
    }

    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("⚠️ Sessão expirou. Faça login novamente.");
        return;
      }

      if (!workspaceId) {
        alert("⚠️ Workspace não identificado. Recarregue a página.");
        return;
      }

      const resp = await fetch("/api/atualizar-usuario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          modo: "proprio",
          workspace_id: workspaceId,   // 🔒 isolamento multi-tenant
          senha_atual: senhaAtual || undefined,
          nova_senha: novaSenha || undefined,
          nome: nome || undefined,
          telefone: telefone || undefined,
          foto_url: fotoUrl,  // sempre envia (mesmo "" — API trata como remover)
        }),
      });

      const data = await resp.json();
      if (!data.success) {
        alert("❌ " + (data.error || "Falha ao salvar"));
        return;
      }

      // Limpa campos de senha
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmaSenha("");

      alert("✅ Perfil atualizado!");

      // Se trocou senha, faz logout pra forçar novo login com a senha nova
      if (novaSenha) {
        await supabase.auth.signOut();
        router.push("/login");
      }
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#6b7280", fontSize: 14 }}>⏳ Carregando...</p>
      </div>
    );
  }

  // ─── Render ───
  const iniciais = (nome || email || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      padding: "32px 16px",
    }}>
      <div style={{
        maxWidth: 640, margin: "0 auto",
        background: "#fff", borderRadius: 18,
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* Header roxo */}
        <div style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          padding: "28px 32px 60px",
          position: "relative",
        }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "rgba(255,255,255,0.2)", color: "#fff",
              border: "none", borderRadius: 8, padding: "6px 14px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              marginBottom: 12,
            }}>
            ← Voltar
          </button>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>
            Meu Perfil
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "4px 0 0" }}>
            Edite suas informações pessoais e troque sua senha
          </p>
        </div>

        {/* Avatar (sobreposto ao header) */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: -50, marginBottom: 8 }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 110, height: 110, borderRadius: "50%",
              background: fotoUrl ? `url(${fotoUrl}) center/cover` : "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
              border: "5px solid #fff",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 38, fontWeight: 800,
            }}>
              {!fotoUrl && iniciais}
            </div>
            {/* Botão de trocar foto */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadando}
              style={{
                position: "absolute", bottom: 4, right: 4,
                width: 34, height: 34, borderRadius: "50%",
                background: "#fff", border: "2px solid #6366f1",
                cursor: uploadando ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
              title="Trocar foto">
              {uploadando ? "⏳" : "📷"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleUploadFoto}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* Link "Remover foto" — só aparece quando o user TEM foto */}
        {fotoUrl && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: -2, marginBottom: 8 }}>
            <button
              onClick={removerFoto}
              disabled={removendoFoto}
              style={{
                background: "transparent", border: "none",
                color: "#ef4444", fontSize: 11.5, fontWeight: 600,
                cursor: removendoFoto ? "wait" : "pointer",
                textDecoration: "underline",
                padding: "4px 8px",
              }}
              title="Remover foto de perfil">
              {removendoFoto ? "⏳ Removendo..." : "🗑️ Remover foto de perfil"}
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div style={{ padding: "8px 32px 32px" }}>

          {/* Workspace + Perfil (info) */}
          <div style={{
            display: "flex", gap: 8, justifyContent: "center",
            marginBottom: 24, flexWrap: "wrap",
          }}>
            {workspaceNome && (
              <span style={{
                background: "#f3f4f6", color: "#4b5563",
                padding: "5px 12px", borderRadius: 999,
                fontSize: 11, fontWeight: 700,
              }}>
                🏢 {workspaceNome}
              </span>
            )}
            <span style={{
              background: "#ede9fe", color: "#7c3aed",
              padding: "5px 12px", borderRadius: 999,
              fontSize: 11, fontWeight: 700,
            }}>
              👤 {perfil}
            </span>
          </div>

          {/* ──────── DADOS PESSOAIS ──────── */}
          <h2 style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
            📋 Dados Pessoais
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 24 }}>
            <Campo label="Nome Completo">
              <input value={nome} onChange={e => setNome(e.target.value)} style={INPUT_STYLE} />
            </Campo>

            <Campo label="E-mail (não pode ser alterado)">
              <input
                type="email"
                value={email}
                disabled
                style={{ ...INPUT_STYLE, background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" }}
              />
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0", fontStyle: "italic" }}>
                💡 Pra trocar de e-mail, fale com o administrador do seu workspace.
              </p>
            </Campo>

            <Campo label="Telefone">
              <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(62) 99999-9999" style={INPUT_STYLE} />
            </Campo>
          </div>

          {/* ──────── SENHA ──────── */}
          <h2 style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            🔒 Trocar Senha
            <span style={{ color: "#9ca3af", fontWeight: 500, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
              (opcional — deixe em branco pra não trocar)
            </span>
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 24 }}>
            <Campo label="Senha Atual">
              <input
                type={mostrarSenhas ? "text" : "password"}
                value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                placeholder="Digite sua senha atual"
                style={INPUT_STYLE}
                autoComplete="current-password"
              />
            </Campo>

            <Campo label="Nova Senha">
              <input
                type={mostrarSenhas ? "text" : "password"}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={INPUT_STYLE}
                autoComplete="new-password"
              />
            </Campo>

            <Campo label="Confirmar Nova Senha">
              <input
                type={mostrarSenhas ? "text" : "password"}
                value={confirmaSenha}
                onChange={e => setConfirmaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                style={INPUT_STYLE}
                autoComplete="new-password"
              />
            </Campo>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
              <input type="checkbox" checked={mostrarSenhas} onChange={e => setMostrarSenhas(e.target.checked)} />
              Mostrar senhas
            </label>

            {novaSenha && (
              <div style={{
                background: "#fef3c7", border: "1px solid #fde68a",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 11.5, color: "#92400e",
              }}>
                ⚠️ Após trocar a senha, você será deslogado e precisará fazer login de novo com a nova senha.
              </div>
            )}
          </div>

          {/* ──────── BOTÕES ──────── */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => router.back()}
              style={{
                background: "#fff", color: "#6b7280",
                border: "1px solid #e5e7eb", borderRadius: 10,
                padding: "11px 20px", fontSize: 13, fontWeight: 700,
                cursor: "pointer",
              }}>
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              style={{
                background: salvando ? "#a5b4fc" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "11px 26px", fontSize: 13, fontWeight: 800,
                cursor: salvando ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}>
              {salvando ? "Salvando..." : "💾 Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos / helpers ───────────────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 13.5,
  background: "#fff",
  color: "#1f2937",
  outline: "none",
  fontFamily: "inherit",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700,
        color: "#374151", textTransform: "uppercase",
        letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}