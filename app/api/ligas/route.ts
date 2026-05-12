import { NextResponse } from 'next/server';

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Falta API_FOOTBALL_KEY.' }, { status: 500 });
  }

  try {
    const response = await fetch(`${API_BASE}/leagues?current=true&type=league`, {
      headers: {
        'x-apisports-key': API_KEY,
      },
      cache: 'no-store',
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.message || 'No se pudieron cargar las ligas.' },
        { status: response.status }
      );
    }

    const leagues = (payload?.response || []).map((item: any) => ({
      key: String(item.league?.id || ''),
      label: item.league
