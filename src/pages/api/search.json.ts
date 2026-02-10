export const prerender = false;
import type { APIRoute } from 'astro';

const IGDB_CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
const IGDB_TOKEN = import.meta.env.IGDB_ACCESS_TOKEN;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const type = url.searchParams.get('type');

  if (!query) return new Response(JSON.stringify({ error: "Falta búsqueda" }), { status: 400 });

  try {
    let results = [];

    // ---------------------------------------------------------
    // CASO 1: PERSONAJES (ANILIST) - ¡AQUÍ ESTABA EL ERROR!
    // ---------------------------------------------------------
    if (type === 'character') {
      const queryChar = `
      query ($search: String) {
        Page(perPage: 20) {
          characters(search: $search) {
            name { full }
            image { large }
          }
        }
      }
      `;
      
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryChar, variables: { search: query } })
      });

      const data = await response.json();
      
      if (data.errors) throw new Error(data.errors[0].message);

      results = data.data.Page.characters.map((c: any) => ({
        title: c.name.full,       // Usamos 'title' para que sea compatible con tu frontend
        cover: c.image.large,     // Usamos 'cover' para que sea compatible
        type: 'character',
        year: 'Personaje'         // Placeholder para que no se rompa el diseño
      }));

    // ---------------------------------------------------------
    // CASO 2: JUEGOS (IGDB)
    // ---------------------------------------------------------
    } else if (type === 'game') {
      const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_TOKEN}` },
        body: `search "${query}"; fields name, cover.url, total_rating, first_release_date; limit 50;`
      });

      if (!response.ok) throw new Error(`IGDB Error: ${response.statusText}`);
      const data = await response.json();
      
      results = data.map((g: any) => ({
        title: g.name,
        cover: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : 'https://placehold.co/400x600/202020/FFF?text=No+Cover',
        score: g.total_rating ? Math.round(g.total_rating / 10) : 0,
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : 'N/A'
      }));

    // ---------------------------------------------------------
    // CASO 3: ANIME / MANGA (ANILIST MEDIA)
    // ---------------------------------------------------------
    } else {
      const isManga = type === 'manga';
      const queryAL = `
      query ($search: String, $type: MediaType) {
        Page(perPage: 50) {
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
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}