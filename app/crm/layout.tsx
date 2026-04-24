"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { usePermissao } from "../hooks/usePermissao";

const ADMIN_EMAIL = "robert.dias@live.com";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { permissoes, isDono, perfil } = usePermissao();
  const [userEmail, setUserEmail] = useState("");
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [cadastrosCount, setCadastrosCount] = useState(0);
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [limiteUsuarios, setLimiteUsuarios] = useState(9999);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");
      const admin = user.email === ADMIN_EMAIL;
      setIsAdmin(admin);

      // ═══ Dono do workspace ═══
      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ws) {
        setWorkspaceNome(ws.nome);
        const wsId = ws.username;
        if (wsId) {
          const { count } = await supabase.from("usuarios_workspace").select("*", { count: "exact", head: true }).eq("workspace_id", wsId);
          setUsuariosCount(count || 0);
        }
        if (!admin) {
          const { data: cadastro } = await supabase.from("cadastros").select("usuarios_liberados").eq("email", user.email).maybeSingle();
          if (cadastro) setLimiteUsuarios(cadastro.usuarios_liberados || 1);
        }
      } else {
        // ═══ Sub-usuário — busca workspace pelo usuarios_workspace ═══
        const { data: usuarioWs } = await supabase
          .from("usuarios_workspace")
          .select("workspace_id")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usuarioWs?.workspace_id) {
          // ✅ Busca por username (padrão novo)
          const { data: wsData } = await supabase
            .from("workspaces")
            .select("nome")
            .eq("username", usuarioWs.workspace_id)
            .maybeSingle();

          if (wsData) {
            setWorkspaceNome(wsData.nome);
          } else if (/^\d+$/.test(usuarioWs.workspace_id)) {
            // Fallback: se workspace_id for numérico (dados legados), busca por id
            const { data: wsLegado } = await supabase
              .from("workspaces")
              .select("nome")
              .eq("id", parseInt(usuarioWs.workspace_id))
              .maybeSingle();
            if (wsLegado) setWorkspaceNome(wsLegado.nome);
          }
        }
      }

      if (admin) {
        const { count } = await supabase.from("cadastros").select("*", { count: "exact", head: true });
        setCadastrosCount(count || 0);
      }
    };
    init();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  // Monta menu baseado nas permissões
  const menuItems = [
    ...(permissoes.dashboard ? [{ path: "/crm/dashboard", icon: "📊", label: "Dashboard" }] : []),
    ...(permissoes.vendas_proprio || permissoes.vendas_equipe ? [{ path: "/crm/funil", icon: "🎯", label: "Funil de Vendas" }] : []),
    ...(permissoes.vendas_proprio || permissoes.vendas_equipe ? [{ path: "/crm/vendas", icon: "💰", label: "Vendas" }] : []),
    ...(isAdmin ? [{ path: "/crm/clientes", icon: "👥", label: "Clientes Wolf", badge: cadastrosCount }] : []),
    ...(!isAdmin && (permissoes.chat_proprio || permissoes.chat_todos) ? [{ path: "/crm/contatos", icon: "👥", label: "Contatos", badge: 0 }] : []),
    ...(permissoes.configuracoes_workspace ? [{ path: "/crm/configuracoes", icon: "⚙️", label: "Configurações", badge: 0 }] : []),
  ];

  const isActive = (path: string) => pathname === path;

  // 🆕 Só dono ou admin vê Telefonia (gerencia credenciais sensíveis do provedor VOIP)
  const podeVerTelefonia = isDono || perfil === "Administrador";

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>
      <div style={{ width: 220, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", padding: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 36, filter: "brightness(0) invert(1)" }} />
          <div>
            <span style={{ color: "white", fontWeight: "bold", fontSize: 13, display: "block" }}>Wolf CRM</span>
            <span style={{ color: "#16a34a", fontSize: 10 }}>{workspaceNome || "Carregando..."}</span>
          </div>
        </div>

        <div style={{ background: "#1f2937", borderRadius: 8, padding: "8px 12px", marginBottom: 4 }}>
          <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 2px" }}>Logado como</p>
          <p style={{ color: "white", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p>
          <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>
            {isDono ? "👑 Dono" : perfil === "Supervisor" ? "🔍 Supervisor" : perfil === "Administrador" ? "👔 Administrador" : "👤 Atendente"}
          </p>
        </div>

        {/* Só mostra limite se for dono e não for admin do sistema */}
        {isDono && !isAdmin && (
          <div style={{ background: "#1f293788", borderRadius: 8, padding: "8px 12px", marginBottom: 4 }}>
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 2px" }}>Plano</p>
            <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold" }}>👥 {usuariosCount}/{limiteUsuarios} usuários</span>
          </div>
        )}

        {menuItems.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isActive(item.path) ? "#16a34a22" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: isActive(item.path) ? "#16a34a" : "#9ca3af", fontSize: 13, fontWeight: isActive(item.path) ? "bold" : "normal", textAlign: "left" }}>
            <span>{item.icon}</span>
            {item.label}
            {(item as any).badge > 0 && <span style={{ background: "#16a34a", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: "auto" }}>{(item as any).badge}</span>}
          </button>
        ))}

        <div style={{ borderTop: "1px solid #1f2937", marginTop: 8, paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => router.push("/chatbot")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#3b82f622", border: "1px solid #3b82f633", borderRadius: 8, cursor: "pointer", color: "#3b82f6", fontSize: 13, fontWeight: "bold", textAlign: "left", width: "100%" }}>
            <span>💬</span> Chatbot
          </button>

          {/* 🆕 Botão Telefonia VOIP — só visível pra dono/admin */}
          {podeVerTelefonia && (
            <button onClick={() => router.push("/crm/telefonia")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isActive("/crm/telefonia") ? "#16a34a33" : "#16a34a22", border: `1px solid ${isActive("/crm/telefonia") ? "#16a34a" : "#16a34a33"}`, borderRadius: 8, cursor: "pointer", color: "#16a34a", fontSize: 13, fontWeight: "bold", textAlign: "left", width: "100%" }}>
              <span>📞</span> Telefonia
            </button>
          )}
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid #1f2937", paddingTop: 8 }}>
          <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#dc262622", border: "1px solid #dc262633", borderRadius: 8, cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: "bold", textAlign: "left", width: "100%" }}>
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        {children}
      </div>
    </div>
  );
}