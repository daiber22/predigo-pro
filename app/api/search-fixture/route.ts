import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Ruta vieja desactivada",
    },
    { status: 410 }
  );
}
