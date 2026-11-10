"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { MolduraAuth, CampoA2, OlhoSenha, BotaoA2, AvisoA2, inputA2 } from "../_a2";

function NovaSenhaConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [primeiroAcesso, setPrimeiroAcesso] = useState(params.get("primeiro") === "1");

  // Login criado pelo administrador ainda com a senha provisória.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.trocar_senha === true) setPrimeiroAcesso(true);
    });
  }, []);

  const handleSalvar = async () => {
    setErro("");
    if (!senha || !confirmar) { setErro("Preencha os dois campos!"); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem!"); return; }
    if (senha.length < 6) { setErro("Senha deve ter pelo menos 6 caracteres!"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha, data: { trocar_senha: false } });
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      setErro(msg.includes("different") || msg.includes("same") ? "Escolha uma senha diferente da provisória." : "Erro ao atualizar senha!");
      return;
    }
    try { sessionStorage.removeItem("wolf_sessao_validada"); } catch {}
    if (primeiroAcesso) {
      // Primeiro acesso: já entra no sistema com a senha nova.
      window.location.href = window.location.host.startsWith("rev.") ? "/" : "/crm";
      return;
    }
    alert("Senha atualizada com sucesso!");
    router.push("/");
  };

  return (
    <MolduraAuth
      titulo={primeiroAcesso ? "Crie sua senha" : "Criar nova senha"}
      sub={primeiroAcesso
        ? "Este é o seu primeiro acesso. Troque a senha provisória por uma senha só sua."
        : "Escolha uma senha nova para entrar no Wolf System."}>
      {erro && <AvisoA2>{erro}</AvisoA2>}
      <CampoA2 rotulo="Nova senha" icone="cadeado" direita={<OlhoSenha visivel={ver} onClick={() => setVer(!ver)} />}>
        <input type={ver ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={senha} autoComplete="new-password"
          onChange={(e) => setSenha(e.target.value)} style={{ ...inputA2, paddingLeft: 42, paddingRight: 48 }} />
      </CampoA2>
      <CampoA2 rotulo="Confirmar nova senha" icone="cadeado"
        dica={confirmar && senha !== confirmar ? <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 700 }}>As senhas não são iguais</span> : null}>
        <input type={ver ? "text" : "password"} placeholder="Repita a senha" value={confirmar} autoComplete="new-password"
          onChange={(e) => setConfirmar(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSalvar()}
          style={{ ...inputA2, paddingLeft: 42 }} />
      </CampoA2>
      <div style={{ marginTop: 4 }}>
        <BotaoA2 onClick={handleSalvar} carregando={loading}>{loading ? "Salvando…" : primeiroAcesso ? "Salvar e entrar" : "Salvar nova senha"}</BotaoA2>
      </div>
      {primeiroAcesso && (
        <p style={{ textAlign: "center", fontSize: 12.5, color: "#94A3B8", margin: 0 }}>
          Depois de salvar, use sempre essa senha para entrar.
        </p>
      )}
    </MolduraAuth>
  );
}

export default function NovaSenha() {
  return (
    <Suspense fallback={null}>
      <NovaSenhaConteudo />
    </Suspense>
  );
}
