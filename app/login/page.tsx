"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

import Icone from "../components/a2/Icone";
import { MolduraAuth, CampoA2, OlhoSenha, BotaoA2, AvisoA2, Divisor, inputA2 } from "./_a2";
export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  // No subdomínio rev.* (módulo Revisional) o login volta para o painel do consultor.
  const irParaInicio = async () => {
    // Login criado pelo administrador: primeiro acesso cria a própria senha.
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.trocar_senha === true) { router.push("/login/nova-senha?primeiro=1"); return; }
    if (window.location.host.startsWith("rev.")) { window.location.href = "/"; return; }
    router.push("/crm");
  };

  const handleLogin = async () => {
    if (!email || !password) { setErro("Preencha e-mail e senha!"); return; }
    setLoading(true);
    setErro(""); setAviso("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErro("E-mail ou senha incorretos!"); return; }
    if (data.user) {
      // 1. Verifica se é dono de workspace
      const { data: workspace } = await supabase.from("workspaces").select("id, ativo").eq("owner_id", data.user.id).single();
      if (workspace) {
        if (workspace.ativo !== true) { setErro("Seu acesso ainda não foi autorizado pelo administrador!"); await supabase.auth.signOut(); return; }
        irParaInicio(); return;
      }

      // 2. Verifica se é usuário de algum workspace
      const { data: usuarioWs } = await supabase.from("usuarios_workspace").select("workspace_id").eq("email", email).single();
      if (usuarioWs) { irParaInicio(); return; }

      // 3. Verifica se está autorizado no cadastro
      const { data: cadastro } = await supabase.from("cadastros").select("autorizado").eq("email", email).single();
      if (cadastro && !cadastro.autorizado) {
        setErro("Seu acesso ainda não foi autorizado pelo administrador!");
        await supabase.auth.signOut();
        return;
      }

      irParaInicio();
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) { setErro("Digite seu e-mail primeiro!"); return; }
    setErro(""); setAviso("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app.wolfgyn.com.br/login/nova-senha",
    });
    if (error) { setErro("Erro ao enviar e-mail!"); }
    else { setAviso("Enviamos um e-mail para redefinir a senha. Confira sua caixa de entrada."); }
  };

  return (
    <MolduraAuth titulo="Bem-vindo de volta" sub="Entre na sua conta e continue de onde parou.">
      {erro && <AvisoA2>{erro}</AvisoA2>}
      {aviso && <AvisoA2 tipo="ok">{aviso}</AvisoA2>}

      <CampoA2 rotulo="E-mail" icone="email">
        <input
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={{ ...inputA2, paddingLeft: 42 }}
        />
      </CampoA2>

      <CampoA2 rotulo="Senha" icone="cadeado"
        extra={<button type="button" onClick={handleEsqueciSenha} className="a2-auth-link" style={{ background: "none", border: 0, padding: 0, color: "#059669", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Esqueceu a senha?</button>}
        direita={<OlhoSenha visivel={showPassword} onClick={() => setShowPassword(!showPassword)} />}>
        <input
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={{ ...inputA2, paddingLeft: 42, paddingRight: 48 }}
        />
      </CampoA2>

      <div style={{ marginTop: 4 }}>
        <BotaoA2 onClick={handleLogin} carregando={loading}>
          {loading ? "Entrando…" : <>Entrar <Icone nome="seta" tamanho={17} espessura={2.3} /></>}
        </BotaoA2>
      </div>

      <Divisor texto="Ainda não tem conta?" />

      <BotaoA2 variante="claro" onClick={() => router.push("/login/register")}>
        Criar meu teste grátis
      </BotaoA2>

      <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", margin: "6px 0 0", lineHeight: 1.5 }}>
        Ao entrar você concorda com os Termos de uso e a Política de privacidade.
      </p>
    </MolduraAuth>
  );
}
