"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { MolduraAuth, CampoA2, OlhoSenha, BotaoA2, AvisoA2, inputA2 } from "../_a2";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleSalvar = async () => {
    if (!senha || !confirmar) { setErro("Preencha os dois campos!"); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem!"); return; }
    if (senha.length < 6) { setErro("Senha deve ter pelo menos 6 caracteres!"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) { setErro("Erro ao atualizar senha!"); return; }
    alert("Senha atualizada com sucesso!");
    router.push("/");
  };

  return (
    <MolduraAuth titulo="Criar nova senha" sub="Escolha uma senha nova para entrar no Wolf System.">
      {erro && <AvisoA2>{erro}</AvisoA2>}
      <CampoA2 rotulo="Nova senha" icone="cadeado" direita={<OlhoSenha visivel={ver} onClick={() => setVer(!ver)} />}>
        <input type={ver ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={senha} autoComplete="new-password"
          onChange={(e) => setSenha(e.target.value)} style={{ ...inputA2, paddingLeft: 42, paddingRight: 48 }} />
      </CampoA2>
      <CampoA2 rotulo="Confirmar nova senha" icone="cadeado">
        <input type={ver ? "text" : "password"} placeholder="Repita a senha" value={confirmar} autoComplete="new-password"
          onChange={(e) => setConfirmar(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSalvar()}
          style={{ ...inputA2, paddingLeft: 42 }} />
      </CampoA2>
      <div style={{ marginTop: 4 }}>
        <BotaoA2 onClick={handleSalvar} carregando={loading}>{loading ? "Salvando…" : "Salvar nova senha"}</BotaoA2>
      </div>
    </MolduraAuth>
  );
}
