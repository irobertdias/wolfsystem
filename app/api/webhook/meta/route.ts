import { NextRequest, NextResponse } from "next/server";

const VPS_URL = "http://2.24.210.200:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => params.append(key, value));
  const resp = await fetch(`${VPS_URL}/webhook/meta?${params}`);
  const text = await resp.text();
  return new NextResponse(text, { status: resp.status });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const resp = await fetch(`${VPS_URL}/webhook/meta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return new NextResponse(null, { status: 200 });
}