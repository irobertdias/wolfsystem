import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rota = searchParams.get("rota") || "status";

  try {
    const resp = await fetch(`${WHATSAPP_URL}/${rota}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ status: "desconectado", error: "Servidor offline" }, { status: 200 });
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
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: "Servidor offline" }, { status: 200 });
  }
}