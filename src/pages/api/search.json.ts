export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');
  const type = url.searchParams.get('type');

  if (!query) return new Response(JSON.stringify([]));

  const IGDB_ID = import.meta.env.IGDB_CLIENT_ID;
  const IGDB_SECRET = import.meta.env.IGDB_CLIENT_SECRET;
  const GB_KEY = import.meta.env.GIANTBOMB_API_KEY;

  try {
    let results = [];

    if (type === 'game') {
      const auth = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${IGDB_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`, { method: 'POST' });
      const authData = await auth.json();
      const res = await fetch("https://api.igdb.com/v4/games", {
        method: 'POST',
        headers: { 'Client-ID': IGDB_ID, 'Authorization': `Bearer ${authData.access_token}`, 'Content-Type': 'text/plain' },
        body: `search "${query}"; fields name, cover.url, first_release_date, total_rating, category, platforms, total_rating_count, aggregated_rating_count, hypes, follows; limit 50; where cover != null;`
      });
      const games = await res.json();

      const mobilePlatformIds = [34, 39]; // 34: Android, 39: iOS
      const legacyMobileId = 22; // Legacy Mobile Device

      const excludedCategories = [1, 2, 3, 4, 5, 6, 7, 13, 14]; // Excluye: DLC, Expansión, Bundle, Standalone, Mod, Episode, Season, Pack, Update

      // Mapear, filtrar bundles y ordenar por prioridad
      results = games
        .filter((g: any) => !excludedCategories.includes(g.category)) // Excluir DLCs, expansiones, bundles, etc.
        .filter((g: any) => {
          // Filtro condicional por palabras clave y popularidad
          const lowerCaseName = g.name.toLowerCase();
          const keywords = [
            'dlc', 'pack', 'edition', 'expansion pass', 'set', 'uniform', 'costume',
            'limited', 'suit', 'pachinko', 'bundle', 'box', 'complete'
          ];
          const hasForbiddenKeyword = keywords.some(keyword => lowerCaseName.includes(keyword));

          if (hasForbiddenKeyword) {
            const totalRatingCount = g.total_rating_count || 0;
            const aggregatedRatingCount = g.aggregated_rating_count || 0;
            const follows = g.follows || 0; // Proxy for "played"
            const interactionScore = totalRatingCount + aggregatedRatingCount + follows;

            if (interactionScore < 3) return false; // Ocultar si tiene palabra clave y baja interacción
          }
          return true; // Mostrar en los demás casos
        })
        .filter((g: any) => {
          // Ocultar si tiene "Legacy Mobile Device"
          if (g.platforms && g.platforms.includes(legacyMobileId)) {
            return false;
          }
          // Si no tiene plataformas, lo dejamos pasar.
          if (!g.platforms || g.platforms.length === 0) return true;
          // Si TODAS sus plataformas son móviles, lo ocultamos.
          const isMobileOnly = g.platforms.every(p => mobilePlatformIds.includes(p));
          return !isMobileOnly;
        })
        .map((g: any) => ({
          id: g.id,
          title: g.name,
          cover: "https:" + g.cover.url.replace("t_thumb", "t_cover_big"),
          year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear().toString() : 'N/A',
          score: g.total_rating || 0,
          category: g.category, // Conservar para ordenar
          first_release_date: g.first_release_date
        }))
        .sort((a: any, b: any) => {
          const getPriority = (category) => (category === 0 || category === 8 ? 1 : category === 9 || category === 10 ? 2 : 3);
          const priorityA = getPriority(a.category);
          const priorityB = getPriority(b.category);
          if (priorityA !== priorityB) return priorityA - priorityB;
          // Ordenar por fecha de lanzamiento exacta (timestamp) si la prioridad es la misma
          return (a.first_release_date || Infinity) - (b.first_release_date || Infinity);
        });
    }

    else if (type === 'character') {
      const queryAnilist = `
        query ($search: String) {
          Page (perPage: 40) {
            characters (search: $search) {
              id
              name { full }
              image { large }
              # CAMBIO: Añadido sort: [START_DATE] para pillar la obra original
              media (sort: [START_DATE], page: 1, perPage: 1) {
                nodes {
                  title { romaji }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: queryAnilist, variables: { search: query } })
      });

      const json = await response.json();

      if (json.data && json.data.Page.characters) {
        results = json.data.Page.characters.map((c: any) => ({
          id: c.id,
          title: c.name.full,
          cover: c.image.large,
          source: c.media.nodes[0]?.title.romaji || 'Anime/Manga'
        }));
      }
    }

    else if (type === 'anime' || type === 'manga') {
      const res = await fetch(`https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(query)}&limit=25`);
      const data = await res.json();
      if (data.data) {
        results = data.data.map((i: any) => ({
          id: i.mal_id,
          title: i.title,
          cover: i.images?.jpg?.large_image_url || i.images?.jpg?.image_url,
          year: i.year || (i.aired?.from ? i.aired.from.split('-')[0] : 'N/A'),
          score: i.score ? i.score * 10 : 0
        }));
      }
    }

    return new Response(JSON.stringify(results), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify([]), { status: 200 });
  }
}