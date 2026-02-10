export const prerender = false; // Importante: Esto se ejecuta en el servidor
import type { APIRoute } from 'astro';

const IGDB_CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
const IGDB_TOKEN = import.meta.env.IGDB_ACCESS_TOKEN; // Necesitas un Bearer token válido

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type'); // 'game' o 'anime'

    if (!query) return new Response(JSON.stringify([]), { status: 400 });

    let results = [];

    if (type === 'game') {
        // Buscar en IGDB
        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': IGDB_CLIENT_ID,
                'Authorization': `Bearer ${IGDB_TOKEN}`,
            },
            body: `search "${query}"; fields name, cover.url, total_rating; limit 10;`
        });
        const data = await response.json();
        results = data.map((g: any) => ({
            title: g.name,
            cover: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : '',
            score: g.total_rating ? Math.round(g.total_rating / 10) : 0,
            id: g.id
        }));

    } else {
        // Buscar en Anilist (GraphQL)
        const queryAL = `
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME) {
          title { romaji }
          coverImage { large }
          averageScore
        }
      }
    }
    `;
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryAL, variables: { search: query } })
        });
        const data = await response.json();
        results = data.data.Page.media.map((a: any) => ({
            title: a.title.romaji,
            cover: a.coverImage.large,
            score: a.averageScore ? Math.round(a.averageScore / 10) : 0
        }));
    }

    return new Response(JSON.stringify(results));
}