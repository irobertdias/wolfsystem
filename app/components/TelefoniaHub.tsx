"use client";
import { useState } from "react";
import ConexoesVoipSection from "./ConexoesVoipSection";
import UraDiscadorSection from "./UraDiscadorSection";
import { usePermissao } from "../hooks/usePermissao";

export default function TelefoniaHub() {
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const podeConexoes = isDono || isSuperAdmin || !!permissoes.voip_conexoes;
  const podeCampanhas = isDono || isSuperAdmin || !!permissoes.voip_campanhas;
  const [aba, setAba] = useState<"conexoes" | "ura">(podeCampanhas ? "ura" : "conexoes");
  return <div style={{minHeight:"100vh",background:"#f6f8fc"}}>
    <div style={{display:"flex",gap:8,padding:"22px 32px 0"}}>
      {podeConexoes && <button onClick={()=>setAba("conexoes")} style={botao(aba==="conexoes")}>☎️ Conexões e ramais</button>}
      {podeCampanhas && <button onClick={()=>setAba("ura")} style={botao(aba==="ura")}>🤖 URA e campanhas</button>}
    </div>
    {aba === "conexoes" && podeConexoes ? <ConexoesVoipSection/> : podeCampanhas ? <UraDiscadorSection/> : null}
  </div>;
}
function botao(ativo:boolean):React.CSSProperties{return{border:ativo?"1px solid #16a34a":"1px solid #dbe2ea",background:ativo?"#ecfdf3":"#fff",color:ativo?"#15803d":"#475569",borderRadius:10,padding:"11px 16px",fontWeight:800,cursor:"pointer"}}