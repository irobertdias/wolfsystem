"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { PLANOS_WOLF, brlCurto } from "../../lib/precos-wolf";
import Icone from "../../components/a2/Icone";
import { MolduraAuth, CampoA2, OlhoSenha, BotaoA2, inputA2 } from "../_a2";

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
      alert("Cadastro enviado! Aguarde a autorização do administrador.");
      router.push("/");
    } catch (e) {
      setLoading(false);
      alert("Erro ao enviar cadastro. Tente novamente!");
    }
  };

  const planos = PLANOS_WOLF.map((p) => ({
    // o texto salvo continua o mesmo de antes (o administrador lê este valor)
    value: `${p.nome} - ${brlCurto(p.preco)}/mês`,
    nome: p.nome,
    preco: brlCurto(p.preco),
    usuarios: p.usuarios,
  }));

  const corStatus =
    usernameStatus === "taken" || usernameStatus === "invalid" ? "#DC2626" :
    usernameStatus === "available" ? "#059669" :
    usernameStatus === "checking" ? "#C2410C" : "";

  const submitDisabled = loading || usernameStatus !== "available";
  const duplo: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };

  return (
    <MolduraAuth
      titulo="Crie sua conta grátis"
      sub="Preencha os dados abaixo para começar o teste. Não pedimos cartão de crédito."
      larguraCartao={600}
      destaques={[
        { icone: "robo", texto: "Integração com Claude, ChatGPT e Typebot" },
        { icone: "funil", texto: "CRM completo para a sua equipe" },
        { icone: "whatsapp", texto: "Conexão com WhatsApp e a API oficial da Meta" },
        { icone: "check", texto: "Teste grátis, sem cartão de crédito" },
      ]}>
      <CampoA2 rotulo="Nome completo *" icone="usuario">
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome" autoComplete="name" style={{ ...inputA2, paddingLeft: 42 }} />
      </CampoA2>

      <CampoA2 rotulo="Nome da empresa" icone="predio">
        <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} placeholder="Como sua empresa se chama" autoComplete="organization" style={{ ...inputA2, paddingLeft: 42 }} />
      </CampoA2>

      <div style={duplo}>
        <CampoA2 rotulo="CNPJ" icone="documento">
          <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" inputMode="numeric" style={{ ...inputA2, paddingLeft: 42 }} />
        </CampoA2>
        <CampoA2 rotulo="CPF" icone="documento">
          <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" inputMode="numeric" style={{ ...inputA2, paddingLeft: 42 }} />
        </CampoA2>
      </div>

      <div style={duplo}>
        <CampoA2 rotulo="E-mail *" icone="email">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" autoComplete="email" style={{ ...inputA2, paddingLeft: 42 }} />
        </CampoA2>
        <CampoA2 rotulo="WhatsApp *" icone="whatsapp">
          <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(62) 99999-9999" inputMode="tel" autoComplete="tel" style={{ ...inputA2, paddingLeft: 42 }} />
        </CampoA2>
      </div>

      <div style={duplo}>
        <CampoA2 rotulo="Senha *" icone="cadeado" direita={<OlhoSenha visivel={showPassword} onClick={() => setShowPassword(!showPassword)} />}>
          <input type={showPassword ? "text" : "password"} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" autoComplete="new-password" style={{ ...inputA2, paddingLeft: 42, paddingRight: 48 }} />
        </CampoA2>
        <CampoA2 rotulo="Confirmar senha *" icone="cadeado" direita={<OlhoSenha visivel={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />}
          dica={form.confirmarSenha && form.senha !== form.confirmarSenha ? <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 700 }}>As senhas não são iguais</span> : null}>
          <input type={showConfirm ? "text" : "password"} value={form.confirmarSenha} onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })} placeholder="Repita a senha" autoComplete="new-password" style={{ ...inputA2, paddingLeft: 42, paddingRight: 48 }} />
        </CampoA2>
      </div>

      <CampoA2 rotulo="Nome de usuário *" erro={usernameStatus === "taken" || usernameStatus === "invalid"}
        direita={usernameStatus === "checking"
          ? <span style={{ width: 16, height: 16, marginRight: 8, borderRadius: "50%", border: "2px solid #FDBA74", borderTopColor: "#C2410C", animation: "spin .7s linear infinite" }} />
          : usernameStatus === "available" ? <span style={{ marginRight: 8, color: "#059669", display: "flex" }}><Icone nome="check" tamanho={18} espessura={2.6} /></span>
          : usernameStatus === "taken" || usernameStatus === "invalid" ? <span style={{ marginRight: 8, color: "#DC2626", display: "flex" }}><Icone nome="alerta" tamanho={18} /></span>
          : null}
        dica={
          <span style={{ fontSize: 12, fontWeight: corStatus ? 700 : 500, color: corStatus || "#94A3B8" }}>
            {usernameStatus === "checking" ? "Verificando se está livre…"
              : usernameStatus === "available" ? "Disponível, pode usar este nome"
              : usernameStatus === "taken" ? "Este nome já está em uso, escolha outro"
              : usernameStatus === "invalid" && usernameError ? usernameError
              : "Só letras minúsculas, números e _ (de 3 a 30 caracteres)"}
          </span>
        }>
        <span style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontWeight: 700, pointerEvents: "none" }}>@</span>
        <input value={form.username} onChange={(e) => validarUsername(e.target.value)} placeholder="minha_empresa" autoComplete="off"
          style={{ ...inputA2, paddingLeft: 34, paddingRight: 44, borderColor: corStatus || "#E6ECEA", boxShadow: corStatus ? `0 0 0 3px ${corStatus}1f` : "none" }} />
      </CampoA2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>Plano *</span>
        <div role="radiogroup" aria-label="Plano" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {planos.map((p) => {
            const sel = form.plano === p.value;
            return (
              <button key={p.value} type="button" role="radio" aria-checked={sel} onClick={() => setForm({ ...form, plano: p.value })}
                style={{
                  textAlign: "left", border: 0, cursor: "pointer", borderRadius: 16, padding: "14px 14px",
                  background: sel ? "#fff" : "#F7FAF9",
                  outline: sel ? "2px solid #059669" : "none",
                  boxShadow: sel ? "0 10px 24px -14px rgba(5,150,105,.55)" : "inset 0 0 0 1px #E6ECEA",
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{p.nome}</span>
                  {sel && <span style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: 6, background: "#059669", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="check" tamanho={12} espessura={2.8} /></span>}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#047857", letterSpacing: "-.01em" }}>{p.preco}<span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>/mês</span></span>
                <span style={{ fontSize: 12, color: "#64748B" }}>até {p.usuarios} usuários</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <BotaoA2 onClick={handleSubmit} disabled={submitDisabled} carregando={loading}>
          {loading ? "Enviando…" : usernameStatus === "checking" ? "Verificando o nome de usuário…" : usernameStatus !== "available" && form.username ? "Corrija o nome de usuário" : "Enviar cadastro"}
        </BotaoA2>
      </div>

      <p style={{ textAlign: "center", fontSize: 13.5, color: "#64748B", margin: 0 }}>
        Já tem conta?{" "}
        <button type="button" onClick={() => router.push("/")} className="a2-auth-link" style={{ background: "none", border: 0, padding: 0, color: "#059669", fontWeight: 800, cursor: "pointer", fontSize: 13.5 }}>Entrar</button>
      </p>
    </MolduraAuth>
  );
}
