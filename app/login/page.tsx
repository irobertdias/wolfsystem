"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setErro("Preencha e-mail e senha!"); return; }
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErro("E-mail ou senha incorretos!"); return; }
    if (data.user) {
      // 1. Verifica se é dono de workspace
      const { data: workspace } = await supabase.from("workspaces").select("id, ativo").eq("owner_id", data.user.id).single();
      if (workspace) { router.push("/crm"); return; }

      // 2. Verifica se é usuário de algum workspace
      const { data: usuarioWs } = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", email).single();
      if (usuarioWs) { router.push("/crm"); return; }

      // 3. Verifica se está autorizado no cadastro
      const { data: cadastro } = await supabase.from("cadastros").select("autorizado").eq("email", email).single();
      if (cadastro && !cadastro.autorizado) {
        setErro("Seu acesso ainda não foi autorizado pelo administrador!");
        await supabase.auth.signOut();
        return;
      }

      router.push("/crm");
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) { setErro("Digite seu e-mail primeiro!"); return; }
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app.wolfgyn.com.br/login/nova-senha",
    });
    if (error) { setErro("Erro ao enviar e-mail!"); }
    else { alert("✅ E-mail de redefinição enviado! Verifique sua caixa de entrada."); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#0a0e1a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Animações CSS reutilizáveis */}
      <style>{`
        @keyframes floatBlob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.05); }
        }
        @keyframes floatBlob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 30px) scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .slide-up { animation: slideUp 0.6s ease-out backwards; }
        .slide-up-d1 { animation: slideUp 0.6s ease-out 0.1s backwards; }
        .slide-up-d2 { animation: slideUp 0.6s ease-out 0.2s backwards; }
        .slide-up-d3 { animation: slideUp 0.6s ease-out 0.3s backwards; }
        .slide-up-d4 { animation: slideUp 0.6s ease-out 0.4s backwards; }
        .wolf-input:focus {
          border-color: #22c55e !important;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15) !important;
          background: #ffffff !important;
        }
        .wolf-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 30px rgba(34, 197, 94, 0.45) !important;
        }
        .wolf-btn-secondary:hover {
          background: #f0fdf4 !important;
          border-color: #16a34a !important;
        }
        .wolf-link:hover {
          color: #16a34a !important;
        }
        @media (max-width: 900px) {
          .wolf-hero { display: none !important; }
          .wolf-form-side { width: 100% !important; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          LADO ESQUERDO — HERO TECH com gradient + blobs animados
          Mostra o produto, brand, features. Esconde no mobile.
          ═══════════════════════════════════════════════════════════════ */}
      <div className="wolf-hero" style={{
        flex: 1,
        background: "linear-gradient(135deg, #064e3b 0%, #065f46 35%, #0f172a 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "48px 56px",
        color: "#ffffff",
      }}>
        {/* Blob decorativo 1 — verde */}
        <div style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(34, 197, 94, 0.35) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(40px)",
          animation: "floatBlob 8s ease-in-out infinite",
        }} />
        {/* Blob decorativo 2 — verde escuro */}
        <div style={{
          position: "absolute",
          bottom: -150,
          left: -120,
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(50px)",
          animation: "floatBlob2 10s ease-in-out infinite",
        }} />
        {/* Padrão de pontos sutil no fundo */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.6,
        }} />

        {/* CONTEÚDO do hero */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logo no topo */}
          <div className="slide-up" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="Wolf System" style={{ height: 56, objectFit: "contain" }} />
          </div>

          {/* Headline central */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520 }}>
            <div className="slide-up-d1" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: 20,
              padding: "6px 14px",
              width: "fit-content",
              marginBottom: 28,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 12px #22c55e",
                animation: "pulseDot 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86efac", letterSpacing: 0.3 }}>
                Sistema 100% online — milhares de atendimentos por dia
              </span>
            </div>

            <h1 className="slide-up-d2" style={{
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1.1,
              margin: "0 0 20px",
              letterSpacing: -1.5,
            }}>
              Atendimento que <span style={{
                background: "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>converte</span> em vendas.
            </h1>

            <p className="slide-up-d3" style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "rgba(255, 255, 255, 0.75)",
              margin: "0 0 36px",
              maxWidth: 460,
            }}>
              CRM + Chatbot WhatsApp multi-canal pra sua equipe atender, qualificar e fechar lead sem perder ninguém pelo caminho.
            </p>

            {/* Features em pílulas */}
            <div className="slide-up-d4" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { icone: "💬", texto: "WhatsApp + Instagram + Messenger" },
                { icone: "🤖", texto: "Chatbot com IA" },
                { icone: "🎯", texto: "Roleta de distribuição" },
                { icone: "📊", texto: "Funil + Relatórios" },
              ].map((f, i) => (
                <div key={i} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backdropFilter: "blur(10px)",
                }}>
                  <span style={{ fontSize: 16 }}>{f.icone}</span>
                  <span style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.9)", fontWeight: 500 }}>
                    {f.texto}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer do hero — copyright + tag */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>
              © {new Date().getFullYear()} Wolf System
            </span>
            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", letterSpacing: 1, textTransform: "uppercase" }}>
              wolfgyn.com.br
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LADO DIREITO — FORMULÁRIO DE LOGIN limpo
          ═══════════════════════════════════════════════════════════════ */}
      <div className="wolf-form-side" style={{
        width: 520,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "48px 64px",
        position: "relative",
      }}>
        <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          {/* Logo mobile (só aparece quando hero está escondido) */}
          <div style={{ textAlign: "center", marginBottom: 32, display: "none" }} className="wolf-mobile-logo">
            <img src="/logo.png" alt="Wolf System" style={{ height: 56, objectFit: "contain" }} />
          </div>

          {/* Header do formulário */}
          <div className="slide-up" style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 8px",
              letterSpacing: -0.5,
            }}>
              Bem-vindo de volta 👋
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              Acesse sua conta e continue de onde parou.
            </p>
          </div>

          {/* Erro */}
          {erro && (
            <div className="slide-up" style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderLeft: "3px solid #dc2626",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <p style={{ color: "#991b1b", fontSize: 13, margin: 0, fontWeight: 500 }}>{erro}</p>
            </div>
          )}

          {/* Inputs */}
          <div className="slide-up-d1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 6,
                letterSpacing: 0.2,
              }}>
                E-MAIL
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  pointerEvents: "none",
                }}>📧</span>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="wolf-input"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 14px 12px 44px",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                    transition: "all 0.15s",
                  }}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}>
                <label style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  letterSpacing: 0.2,
                }}>
                  SENHA
                </label>
                <button
                  onClick={handleEsqueciSenha}
                  className="wolf-link"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#22c55e",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 0.15s",
                  }}
                >
                  Esqueceu?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  pointerEvents: "none",
                }}>🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="wolf-input"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 44px 12px 44px",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                    transition: "all 0.15s",
                    letterSpacing: showPassword ? "normal" : 2,
                  }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: 4,
                    color: "#94a3b8",
                  }}
                  type="button"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          </div>

          {/* Botão principal */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="wolf-btn-primary slide-up-d2"
            style={{
              width: "100%",
              marginTop: 24,
              background: loading
                ? "linear-gradient(135deg, #86efac 0%, #4ade80 100%)"
                : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 8px 20px rgba(34, 197, 94, 0.35)",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#ffffff",
                  borderRadius: "50%",
                  animation: "spinSlow 0.7s linear infinite",
                }} />
                ENTRANDO...
              </>
            ) : (
              <>ACESSAR <span style={{ fontSize: 16 }}>→</span></>
            )}
          </button>

          {/* Divisor */}
          <div className="slide-up-d3" style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "24px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5 }}>
              NÃO TEM CONTA?
            </span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {/* Botão secundário — criar conta */}
          <button
            onClick={() => router.push("/login/register")}
            className="wolf-btn-secondary slide-up-d4"
            style={{
              width: "100%",
              background: "#ffffff",
              color: "#16a34a",
              border: "2px solid #22c55e",
              borderRadius: 10,
              padding: "12px 20px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>🚀</span>
            CRIE SEU TESTE GRÁTIS
          </button>

          {/* Footer pequeno */}
          <p style={{
            textAlign: "center",
            fontSize: 11,
            color: "#94a3b8",
            marginTop: 32,
            lineHeight: 1.5,
          }}>
            Ao acessar você concorda com nossos<br />
            <span style={{ color: "#64748b", fontWeight: 500 }}>Termos</span> e <span style={{ color: "#64748b", fontWeight: 500 }}>Política de Privacidade</span>
          </p>
        </div>
      </div>
    </div>
  );
}