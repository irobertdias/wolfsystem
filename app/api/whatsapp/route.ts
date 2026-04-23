import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rota = searchParams.get("rota") || "status";
  const extraParams = new URLSearchParams();
  searchParams.forEach((v, k) => { if (k !== "rota") extraParams.set(k, v); });
  const queryStr = extraParams.toString();
  const url = `${WHATSAPP_URL}/${rota}${queryStr ? "?" + queryStr : ""}`;

  try {
    const resp = await fetch(url, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`[proxy GET] ${rota} → ${resp.status}:`, text.slice(0, 500));
      return NextResponse.json({ status: "erro", error: `VPS ${resp.status}: ${text.slice(0, 300)}` }, { status: 200 });
    }
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ status: "erro", error: "VPS não-JSON: " + text.slice(0, 200) }, { status: 200 });
    }
  } catch (error: any) {
    console.error(`[proxy GET] ${rota} catch:`, error.message);
    return NextResponse.json({ status: "desconectado", error: "Servidor offline: " + error.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rota = searchParams.get("rota") || "status";
  const body = await req.json().catch(() => ({}));

  try {
    const resp = await fetch(`${WHATSAPP_URL}/${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`[proxy POST] ${rota} → ${resp.status}:`, text.slice(0, 500));
      return NextResponse.json({ success: false, error: `VPS ${resp.status}: ${text.slice(0, 300)}` }, { status: 200 });
    }
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ success: false, error: "VPS não-JSON: " + text.slice(0, 200) }, { status: 200 });
    }
  } catch (error: any) {
    console.error(`[proxy POST] ${rota} catch:`, error.message);
    return NextResponse.json({ success: false, error: "Servidor offline: " + error.message }, { status: 200 });
  }
}