import type { APIRoute } from "astro";

// Un caché simple en memoria para el token de Spotify
let spotifyToken: {
  value: string | null;
  expires: number;
} = {
  value: null,
  expires: 0,
};

async function getSpotifyToken(): Promise<string> {
  // Si tenemos un token válido en caché, lo usamos
  if (spotifyToken.value && spotifyToken.expires > Date.now()) {
    return spotifyToken.value;
  }

  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Spotify API credentials are not configured.");
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

  // Guardamos en caché el nuevo token
  spotifyToken = {
    value: data.access_token,
    // Lo hacemos expirar 5 minutos antes para estar seguros
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };

  return spotifyToken.value;
}

async function searchSpotify(query: string) {
  const token = await getSpotifyToken();

  // Usamos el constructor URL para construir la URL de forma segura y robusta.
  // Esto evita problemas de codificación manual y es el método estándar.
  const searchUrl = new URL("https://api.spotify.com/v1/search");
  searchUrl.searchParams.append('q', query);
  searchUrl.searchParams.append('type', 'track');
  searchUrl.searchParams.append('market', 'ES');

  const response = await fetch(
    searchUrl.href,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    let errorDetails = `Status: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error && errorBody.error.message) {
        errorDetails = errorBody.error.message;
      }
    } catch (e) {
      // Ignorar si el cuerpo del error no es JSON, el status es suficiente.
    }
    console.error("Spotify API Error:", errorDetails);
    throw new Error(`La búsqueda en Spotify falló. Razón: ${errorDetails}`);
  }

  const data = await response.json();

  // Mapeamos la respuesta al formato que espera el frontend
  return data.tracks.items.map((track: any) => ({
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(", "),
    cover: track.album.images[0]?.url || "https://placehold.co/300x300?text=No+Cover",
    year: track.album.release_date ? new Date(track.album.release_date).getFullYear() : null,
    album: track.album.name,
    type: "music",
  }));
}

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q");
  const type = url.searchParams.get("type");

  if (!query) {
    return new Response(JSON.stringify({ error: "El parámetro 'q' es requerido" }), { status: 400 });
  }

  if (type === "music") {
    const results = await searchSpotify(query);
    return new Response(JSON.stringify(results), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // TODO: Implementar la lógica para otros tipos de búsqueda (game, anime, etc.)
  // Por ahora, devolvemos un array vacío para no romper el frontend.
  console.warn(`La búsqueda para el tipo '${type}' no está implementada. Se devuelven resultados vacíos.`);
  return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
};