# PrediGol Pro v9

Base web lista para conectar estadísticas, cuotas y ticket desde una sola app, ahora con **estado de conexión guardado** y **mapa de ligas validado** para cuotas reales.

## Qué incluye

- Búsqueda de partido por equipos, liga, país, temporada y fecha.
- Selector de liga rápido para cambiar entre ligas comunes sin tocar `.env.local`.
- Resolución automática de equipos y fixture con **API-Football**.
- Carga automática de goles del modelo sin escribirlos a mano.
- Selector de **casa de apuestas** dentro de la interfaz.
- Filtros de **mercados** dentro de la interfaz para 1X2, totales, ambos anotan y doble oportunidad.
- Generador automático de ticket **conservador / medio / agresivo** usando análisis recientes con cuotas.
- Conector de cuotas con **The Odds API** enlazado por equipos y hora del partido.
- Prueba de conexión desde la interfaz para validar las dos APIs antes de analizar.
- Estado de conexión guardado en el navegador para no perder el último diagnóstico.
- Validación masiva de ligas para marcar cuáles tienen cuotas reales disponibles, cuáles no tienen `sport key` y cuáles no están disponibles hoy.
- Motor de análisis con el modelo trasladado desde tu hoja de cálculo.
- Comparador de valor entre probabilidad del modelo y cuota.
- Ticket e historial guardados en `localStorage`.
- Demo fallback opcional con variable `ALLOW_DEMO_FALLBACK`.

## Estructura

- `app/` interfaz principal y rutas API internas.
- `app/api/test-connections/route.ts` prueba las conexiones reales.
- `app/api/league-status/route.ts` valida todas las ligas del proyecto contra The Odds API.
- `lib/model.ts` lógica del Poisson corregido y picks.
- `lib/api-football.ts` búsqueda automática de fixture y estadísticas.
- `lib/odds.ts` búsqueda de cuotas por partido real con soporte para `bookmakers` y mercados filtrados.
- `lib/api-connections.ts` validación de API-Football y The Odds API.
- `lib/league-options.ts` mapeo entre liga, país y `sport key`.
- `lib/odds-options.ts` lista de bookmakers y mercados del panel.
- `components/predigol-app.tsx` panel principal.

## Instalación local

```bash
npm install
npm run dev
```

## Variables de entorno

Copia `.env.example` a `.env.local` y completa tus llaves:

```bash
cp .env.example .env.local
```

Campos esperados:

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL`
- `ODDS_API_KEY`
- `ODDS_API_BASE_URL`
- `DEFAULT_LEAGUE`
- `DEFAULT_COUNTRY`
- `DEFAULT_SEASON`
- `ALLOW_DEMO_FALLBACK`
- `ODDS_API_SPORT_KEY` opcional como fallback global

## Flujo de uso

1. Elige una liga en el selector rápido.
2. Pulsa **Probar conexión API**.
3. Revisa si API-Football y The Odds API responden bien.
4. Pulsa **Validar ligas cuotas** para actualizar el mapa de ligas.
5. Escribe equipo local y visitante.
6. Busca el fixture.
7. La app intenta resolver IDs, liga y fecha automáticamente.
8. Trae las estadísticas base del partido.
9. Analiza el partido con el modelo.
10. Elige bookmaker y mercados dentro del panel de cuotas.
11. Busca cuotas del mismo cruce con el `sport key` asociado a la liga elegida.
12. Agrega el pick al ticket respetando el filtro activo.


## Modo app instalable (PWA)

Esta versión ya incluye:

- `app/manifest.ts` para que el navegador la reconozca como app instalable.
- `public/sw.js` para cachear la shell básica de la app.
- iconos en `public/icons/` para Android y iPhone.
- registro automático del service worker y botón de instalación cuando el navegador lo permite.

### Cómo instalarla en Android

1. Despliega la app en Vercel o Netlify.
2. Abre la URL desde Chrome en el teléfono.
3. Pulsa **Instalar ahora** cuando aparezca el aviso dentro de la app o usa el menú del navegador.
4. Se agregará a la pantalla de inicio como una app.

### Cómo instalarla en iPhone

1. Abre la URL desde Safari.
2. Toca **Compartir**.
3. Elige **Agregar a pantalla de inicio**.
4. Se abrirá como app independiente.

## Notas importantes

- Por defecto, la app está pensada para **usar APIs reales**. Si falta una llave, mostrará error claro.
- Si quieres permitir fallback a demo, activa `ALLOW_DEMO_FALLBACK=true`.
- Si eliges un bookmaker y no aparece para ese partido, la app intenta usar el primero disponible en la respuesta.
- Algunas ligas pueden no traer `sport key` configurado dentro del proyecto. En ese caso, la app te lo indicará.
- Si quieres cubrir una liga nueva, añade una entrada en `lib/league-options.ts`.
- Si quieres añadir más casas o cambiar etiquetas, edita `lib/odds-options.ts`.
- La precisión mejora mucho si llenas `fecha` cuando el nombre del equipo puede ser ambiguo.

## Despliegue

### Vercel

```bash
vercel --prod
```

### Netlify

Conecta el repositorio a Netlify y deja que detecte el proyecto Next.js. Si prefieres configurarlo a mano, usa el comando de build `npm run build`.
