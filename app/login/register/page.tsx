"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function Register() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [form, setForm] = useState({
    nome: "", empresa: "", cnpj: "", cpf: "",
    email: "", whatsapp: "", senha: "", confirmarSenha: "",
    username: "", plano: "",
  });

  const validarUsername = (value: string) => {
    const limpo = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setForm(prev => ({ ...prev, username: limpo }));
    if (limpo.length === 0) {
      setUsernameError("");
      setUsernameStatus("idle");
      return;
    }
    if (limpo.length < 3) {
      setUsernameError("Mínimo 3 caracteres");
      setUsernameStatus("invalid");
    } else if (limpo.length > 30) {
      setUsernameError("Máximo 30 caracteres");
      setUsernameStatus("invalid");
    } else {
      setUsernameError("");
      setUsernameStatus("checking");
    }
  };

  // ✅ Verificação em tempo real com debounce 500ms
  useEffect(() => {
    if (usernameStatus !== "checking" || !form.username || form.username.length < 3) return;

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("username")
          .ilike("username", form.username)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          // Erro de rede ou consulta — mostra como inválido por precaução
          setUsernameStatus("invalid");
          setUsernameError("Erro ao verificar. Tente novamente.");
          return;
        }

        if (data) {
          setUsernameStatus("taken");
          setUsernameError("Este nome de usuário já está em uso");
        } else {
          setUsernameStatus("available");
          setUsernameError("");
        }
      } catch {
        setUsernameStatus("invalid");
        setUsernameError("Erro ao verificar");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.username, usernameStatus]);

  const handleSubmit = async () => {
    if (form.senha !== form.confirmarSenha) { alert("As senhas não coincidem!"); return; }
    if (!form.nome || !form.email || !form.whatsapp || !form.senha || !form.username || !form.plano) {
      alert("Preencha todos os campos obrigatórios!"); return;
    }
    if (usernameStatus !== "available") {
      alert("Verifique o nome de usuário — precisa estar disponível!");
      return;
    }
    if (form.senha.length < 6) { alert("A senha deve ter pelo menos 6 caracteres!"); return; }

    setLoading(true);

    try {
      // ✅ CHECAGEM FINAL server-side antes de enviar — previne race condition
      const { data: existe } = await supabase
        .from("workspaces")
        .select("username")
        .ilike("username", form.username)
        .maybeSingle();

      if (existe) {
        setUsernameStatus("taken");
        setUsernameError("Este nome de usuário já está em uso");
        alert("O nome de usuário foi tomado enquanto você preenchia. Escolha outro!");
        setLoading(false);
        return;
      }

      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await resp.json();

      if (!result.success) {
        if (result.error === "email_exists") {
          alert("Este e-mail já está cadastrado!");
        } else if (result.error === "username_exists") {
          setUsernameStatus("taken");
          setUsernameError("Este nome de usuário já está em uso");
          alert("Este nome de usuário já está em uso!");
        } else {
          alert("Erro ao cadastrar: " + result.error);
        }
        setLoading(false);
        return;
      }

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome, empresa: form.empresa, whatsapp: form.whatsapp, email: form.email, plano: form.plano, username: form.username }),
      }).catch(() => {});

      setLoading(false);
      alert("✅ Cadastro enviado! Aguarde a autorização do administrador.");
      router.push("/");
    } catch (e) {
      setLoading(false);
      alert("Erro ao enviar cadastro. Tente novamente!");
    }
  };

  const inputStyle = {
    width: "100%", border: "1px solid #d1d5db", borderRadius: 10,
    padding: "12px 16px", fontSize: 14, background: "white",
    boxSizing: "border-box" as const, color: "#111",
  };

  const planos = [
    { value: "", label: "Selecione um plano *" },
    { value: "Básico - R$ 544,34/mês", label: "🐺 Plano Básico — R$ 544,34/mês (até 7 usuários)" },
    { value: "Intermediário - R$ 844,34/mês", label: "⭐ Plano Intermediário — R$ 844,34/mês (até 15 usuários)" },
    { value: "Ultra - R$ 1.099,99/mês", label: "🚀 Plano Ultra — R$ 1.099,99/mês (até 50 usuários)" },
  ];

  // ✅ Borda do input username muda conforme status
  const usernameBorderColor =
    usernameStatus === "taken" || usernameStatus === "invalid" ? "#dc2626" :
    usernameStatus === "available" ? "#16a34a" :
    usernameStatus === "checking" ? "#f59e0b" :
    "#d1d5db";

  const submitDisabled = loading || usernameStatus !== "available";

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>

      {/* ESQUERDA */}
      <div style={{ width: "40%", background: "linear-gradient(160deg, #064e3b, #000)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", gap: "32px" }}>
        <img src="/logo1.png" alt="Wolf System" style={{ width: 300, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {["Integração com Claude, ChatGPT e Typebot", "CRM completo para sua equipe", "Conexão com WhatsApp e API Meta", "Teste grátis sem cartão de crédito"].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ background: "#16a34a", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
              <p style={{ color: "#d1fae5", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DIREITA */}
      <div style={{ width: "60%", background: "white", overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 60px" }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <h2 style={{ fontSize: 26, fontWeight: "bold", color: "#111", margin: 0 }}>Crie sua conta grátis</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>Preencha os dados abaixo para começar</p>
          </div>

          <input placeholder="Nome completo *" value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />

          <input placeholder="Nome da empresa" value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })} style={inputStyle} />

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="CNPJ" value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="CPF" value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <input placeholder="E-mail *" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="WhatsApp *" value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input placeholder="Senha *" type={showPassword ? "text" : "password"} value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <input placeholder="Confirmar senha *" type={showConfirm ? "text" : "password"} value={form.confirmarSenha}
                onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: 13, color: "#9ca3af", fontSize: 14, pointerEvents: "none" }}>@</span>
              <input
                placeholder="Nome de usuário * (ex: minha_empresa)"
                value={form.username}
                onChange={(e) => validarUsername(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 28, paddingRight: 44, borderColor: usernameBorderColor, borderWidth: 2 }}
              />
              {/* ÍCONE DE STATUS */}
              <span style={{ position: "absolute", right: 14, top: 14, fontSize: 16 }}>
                {usernameStatus === "checking" && "⏳"}
                {usernameStatus === "available" && "✅"}
                {usernameStatus === "taken" && "❌"}
                {usernameStatus === "invalid" && "⚠️"}
              </span>
            </div>

            {/* MENSAGEM DE STATUS */}
            {usernameStatus === "checking" && (
              <p style={{ color: "#f59e0b", fontSize: 11, margin: "4px 0 0 4px", fontWeight: "bold" }}>
                ⏳ Verificando disponibilidade...
              </p>
            )}
            {usernameStatus === "available" && (
              <p style={{ color: "#16a34a", fontSize: 11, margin: "4px 0 0 4px", fontWeight: "bold" }}>
                ✅ Disponível! Pode usar este nome
              </p>
            )}
            {usernameStatus === "taken" && (
              <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0 4px", fontWeight: "bold" }}>
                ❌ Este nome já está em uso. Escolha outro
              </p>
            )}
            {usernameStatus === "invalid" && usernameError && (
              <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0 4px", fontWeight: "bold" }}>
                ⚠️ {usernameError}
              </p>
            )}
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0 4px" }}>Apenas letras minúsculas, números e _ (underline) — 3 a 30 caracteres</p>
          </div>

          <select
            value={form.plano}
            onChange={(e) => setForm({ ...form, plano: e.target.value })}
            style={{ ...inputStyle, cursor: "pointer", color: form.plano ? "#111" : "#9ca3af" }}
          >
            {planos.map((p) => (
              <option key={p.value} value={p.value} disabled={p.value === ""}>{p.label}</option>
            ))}
          </select>

          <button onClick={handleSubmit} disabled={submitDisabled} style={{
            width: "100%", background: submitDisabled ? "#86efac" : "#16a34a", color: "white", border: "none",
            borderRadius: 10, padding: 14, fontSize: 14, fontWeight: "bold",
            cursor: submitDisabled ? "not-allowed" : "pointer", letterSpacing: 1, textTransform: "uppercase",
            opacity: submitDisabled ? 0.6 : 1,
          }}>
            {loading ? "Enviando..." : usernameStatus === "checking" ? "Verificando username..." : usernameStatus !== "available" && form.username ? "Corrija o username" : "Enviar cadastro"}
          </button>

          <button onClick={() => router.push("/")} style={{
            width: "100%", background: "white", color: "#9ca3af",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, fontSize: 14, cursor: "pointer"
          }}>
            Já tenho conta? Fazer login
          </button>

        </div>
      </div>
    </div>
  );
}