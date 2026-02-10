export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type');

    // 1. LEER VARIABLES (Y CHIVARSE SI FALTAN)
    const CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
    const TOKEN = import.meta.env.IGDB_ACCESS_TOKEN;

    console.log(`🔍 Buscando: "${query}" en modo [${type}]`);

    if (type === 'game') {
        if (!CLIENT_ID || !TOKEN) {
            console.error("❌ ERROR FATAL: No se encuentran las variables de entorno.");
            console.error("   IGDB_CLIENT_ID es:", CLIENT_ID);
            console.error("   IGDB_ACCESS_TOKEN es:", TOKEN ? "Oculto (existe)" : "INDEFINIDO");
            return new Response(JSON.stringify({ error: "Faltan las API KEYS en el .env" }), { status: 500 });
        }
    }

    try {
        let results = [];

        // --- MODO JUEGOS ---
        if (type === 'game') {
            console.log("📡 Conectando con IGDB...");
            const response = await fetch('https://api.igdb.com/v4/games', {
                method: 'POST',
                headers: {
                    'Client-ID': CLIENT_ID,
                    'Authorization': `Bearer ${TOKEN}`,
                },
                body: `search "${query}"; fields name, cover.url, total_rating, first_release_date; limit 6;`
            });

            if (!response.ok) {
                // SI FALLA, LEEMOS EL ERROR REAL DE IGDB
                const textError = await response.text();
                console.error("❌ ERROR IGDB:", response.status, textError);
                return new Response(JSON.stringify({ error: `IGDB dice: ${textError}` }), { status: 500 });
            }

            const data = await response.json();
            console.log("✅ Datos recibidos de IGDB:", data.length, "resultados.");

            results = data.map((g: any) => ({
                id: g.id,
                title: g.name,
                cover: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : 'https://placehold.co/400x600?text=No+Cover',
                score: g.total_rating ? Math.round(g.total_rating / 10) : 0,
                year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : 'N/A'
            }));
        }

        // --- MODO ANIME/MANGA ---
        else {
            console.log("📡 Conectando con Anilist...");
            const isManga = type === 'manga';
            const queryAL = `
      query ($search: String, $type: MediaType) {
        Page(perPage: 6) {
          media(search: $search, type: $type) {
            title { romaji }
            coverImage { large }
            averageScore
            seasonYear
            startDate { year }
          }
        }
      }
      `;

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryAL, variables: { search: query, type: isManga ? 'MANGA' : 'ANIME' } })
            });

            const data = await response.json();
            if (data.errors) throw new Error(data.errors[0].message);

            results = data.data.Page.media.map((a: any) => ({
                title: a.title.romaji,
                cover: a.coverImage.large,
                score: a.averageScore ? Math.round(a.averageScore / 10) : 0,
                year: a.seasonYear || a.startDate.year || 'N/A'
            }));
        }

        return new Response(JSON.stringify(results));

    } catch (e: any) {
        console.error("❌ EXCEPCIÓN DEL SERVIDOR:", e.message);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}