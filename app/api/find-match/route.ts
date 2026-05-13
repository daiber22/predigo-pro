import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    return NextResponse.json({
      ok: false,
      error: "find-match funcionando, falta conectar la búsqueda real",
      recibido: body,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "No pude leer el body en find-match",
      },
      { status: 400 }
    );
  }
}
