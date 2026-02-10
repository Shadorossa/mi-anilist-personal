export const prerender = false;
import type { APIRoute } from 'astro';

const IGDB_CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
const IGDB_TOKEN = import.meta.env.IGDB_ACCESS_TOKEN;

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type');

    if (!query) return new Response(JSON.stringify([]), { status: 400 });

    try {
        let results = [];

        if (type === 'game') {
            const response = await fetch('https://api.igdb.com/v4/games', {
                method: 'POST',
                headers: { 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_TOKEN}` },
                body: `search "${query}"; fields name, cover.url, total_rating, first_release_date; limit 6;`
            });
            const data = await response.json();
            results = data.map((g: any) => ({
                id: g.id,
                title: g.name,
                cover: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : 'https://placehold.co/400x600?text=No+Cover',
                score: g.total_rating ? Math.round(g.total_rating / 10) : 0,
                year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : 'N/A'
            }));
        } else {
            // Anilist Query
            const queryAL = `query ($search: String) { Page(perPage: 6) { media(search: $search, type: ANIME) { title { romaji } coverImage { large } averageScore seasonYear } } }`;
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryAL, variables: { search: query } })
            });
            const data = await response.json();
            results = data.data.Page.media.map((a: any) => ({
                title: a.title.romaji,
                cover: a.coverImage.large,
                score: a.averageScore ? Math.round(a.averageScore / 10) : 0,
                year: a.seasonYear || 'N/A'
            }));
        }
        return new Response(JSON.stringify(results));
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}