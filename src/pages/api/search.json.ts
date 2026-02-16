import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

// --- Caches en memoria para tokens ---
let spotifyToken: { value: string | null; expires: number } = { value: null, expires: 0 };
let igdbToken: { value: string | null; expires: number } = { value: null, expires: 0 };

// --- Lógica de Spotify ---
async function getSpotifyToken(): Promise<string> {
  if (spotifyToken.value && spotifyToken.expires > Date.now()) {
    return spotifyToken.value;
  }

  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciales de la API de Spotify no configuradas.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Fallo al obtener el token de Spotify.");
  }

  const data = await response.json();

  spotifyToken = {
    value: data.access_token,
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };

  return spotifyToken.value;
}

async function searchSpotify(query: string) {
  const token = await getSpotifyToken();
  const searchUrl = new URL("https://api.spotify.com/v1/search");
  searchUrl.searchParams.append('q', query);
  searchUrl.searchParams.append('type', 'track');
  searchUrl.searchParams.append('market', 'ES');
  searchUrl.searchParams.append('limit', '50');

  const response = await fetch(searchUrl.href, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    console.error("Spotify API Error:", await response.text());
    throw new Error("La búsqueda en Spotify falló.");
  }

  const data = await response.json();
  return data.tracks.items.map((track: any) => ({
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(", "),
    cover: track.album.images[0]?.url || "https://placehold.co/300x300?text=No+Cover",
    year: track.album.release_date ? new Date(track.album.release_date).getFullYear() : null,
    album: track.album.name,
    type: "music",
  }));
}

// --- Lógica de IGDB (Juegos) ---
async function getIgdbToken(): Promise<string> {
  if (igdbToken.value && igdbToken.expires > Date.now()) {
    return igdbToken.value;
  }

  const clientId = import.meta.env.IGDB_CLIENT_ID;
  const clientSecret = import.meta.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciales de la API de IGDB no configuradas.");
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("Fallo al obtener el token de IGDB.");
  }

  const data = await response.json();
  igdbToken = {
    value: data.access_token,
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };
  return igdbToken.value;
}

async function searchIgdb(query: string) {
  const token = await getIgdbToken();
  const clientId = import.meta.env.IGDB_CLIENT_ID;

  // Sanitizar la consulta para escapar las comillas dobles y evitar errores de sintaxis.
  const sanitizedQuery = query.replace(/"/g, '\\"');

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    // Se relaja la consulta: se eliminó `version_parent = null` que era muy restrictivo
    // y se añadió la categoría de expansiones standalone (4) para obtener más resultados relevantes.
    // Se elimina el filtro 'where' para que la búsqueda sea más amplia, como ha solicitado el usuario.
    body: `search "${sanitizedQuery}"; fields id, name, cover.url, first_release_date; limit 50;`,
  });

  if (!response.ok) {
    console.error("IGDB API Error:", await response.text());
    throw new Error("La búsqueda en IGDB falló.");
  }

  const data = await response.json();
  return data.map((game: any) => ({
    id: game.id,
    title: game.name,
    cover: game.cover?.url
      ? game.cover.url.replace("t_thumb", "t_cover_big")
      : "https://placehold.co/300x400?text=No+Cover",
    year: game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear()
      : null,
    type: "games",
  }));
}

// --- Lógica de Anilist (Anime, Manga, Personajes) ---
const anilistApiUrl = "https://graphql.anilist.co";

async function searchAnilistMedia(query: string, type: 'ANIME' | 'MANGA') {
  const graphqlQuery = `
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 50) {
        media(search: $search, type: $type, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          coverImage { extraLarge }
          startDate { year }
          format
        }
      }
    }
  `;
  const variables = { search: query, type: type };
  const response = await fetch(anilistApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: graphqlQuery, variables }),
  });

  if (!response.ok) {
    console.error("Anilist Media API Error:", await response.text());
    throw new Error("La búsqueda de media en Anilist falló.");
  }

  const data = await response.json();
  return data.data.Page.media.map((item: any) => ({
    title: item.title.english || item.title.romaji,
    cover: item.coverImage.extraLarge,
    year: item.startDate.year,
    type: type.toLowerCase(),
    format: item.format,
  }));
}

async function searchAnilistCharacter(query: string) {
  const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 50) {
        characters(search: $search, sort: SEARCH_MATCH) {
          id
          name { full }
          image { large }
          media(sort: POPULARITY_DESC, perPage: 1) {
            nodes {
              id
              title { romaji english }
            }
          }
        }
      }
    }
  `;
  const variables = { search: query };
  const response = await fetch(anilistApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: graphqlQuery, variables }),
  });

  if (!response.ok) {
    console.error("Anilist Character API Error:", await response.text());
    throw new Error("La búsqueda de personajes en Anilist falló.");
  }

  const data = await response.json();
  return data.data.Page.characters.map((char: any) => ({
    id: char.id,
    title: char.name.full,
    cover: char.image.large,
    source: char.media.nodes[0]?.title.english || char.media.nodes[0]?.title.romaji || 'Unknown',
    sourceId: char.media.nodes[0]?.id,
    type: 'character',
  }));
}

// --- Endpoint principal ---
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q");
  const type = url.searchParams.get("type");
  const includeEditions = url.searchParams.get("include_editions") === 'true';

  if (!query) {
    return new Response(JSON.stringify({ error: "El parámetro 'q' es requerido" }), { status: 400 });
  }

  try {
    let results = [];
    switch (type) {
      case "music":
        results = await searchSpotify(query);
        break;
      case "game":
        results = await searchIgdb(query);
        if (!includeEditions) {
          // Fetch all edition IDs from the game_versions table to hide them from general search
          const { data: versionsData, error: versionsError } = await supabase
              .from('game_versions')
              .select('edition_igdb_id');
          
          if (versionsError) console.error("Error fetching game versions to filter search:", versionsError.message);

          const editionIds = new Set(versionsData?.map(v => v.edition_igdb_id) || []);
          results = results.filter(game => !editionIds.has(game.id));
        }
        break;
      case "anime":
        results = await searchAnilistMedia(query, 'ANIME');
        break;
      case "manga":
        results = await searchAnilistMedia(query, 'MANGA');
        break;
      case "character":
        results = await searchAnilistCharacter(query);
        break;
      default:
        return new Response(JSON.stringify({ error: `Tipo de búsqueda no soportado: ${type}` }), { status: 400 });
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(`Error en la búsqueda de tipo '${type}':`, errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};