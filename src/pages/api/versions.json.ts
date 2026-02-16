import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

let igdbToken: { value: string | null; expires: number } = { value: null, expires: 0 };

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

async function getGamesByIds(ids: number[]) {
    const token = await getIgdbToken();
    const clientId = import.meta.env.IGDB_CLIENT_ID;

    if (ids.length === 0) return [];

    const response = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
        },
        body: `fields id, name, cover.url, first_release_date; where id = (${ids.join(',')}); limit ${ids.length};`,
    });

    if (!response.ok) {
        console.error("IGDB API Error:", await response.text());
        throw new Error("La búsqueda por IDs en IGDB falló.");
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
        // version_type will be added later
    }));
}

export const GET: APIRoute = async ({ url }) => {
    const mainId = url.searchParams.get("main_id");

    if (!mainId) {
        return new Response(JSON.stringify({ error: "El parámetro 'main_id' es requerido" }), { status: 400 });
    }

    try {
        const { data: versions, error } = await supabase
            .from('game_versions')
            .select('edition_igdb_id, version_type')
            .eq('main_igdb_id', mainId);

        if (error) throw error;

        if (!versions || versions.length === 0) {
            return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const idToTypeMap = new Map(versions.map(v => [v.edition_igdb_id, v.version_type]));
        const editionIds = versions.map(v => v.edition_igdb_id);
        const editionsData = await getGamesByIds(editionIds);

        const editionsWithTypes = editionsData.map(edition => ({
            ...edition,
            version_type: idToTypeMap.get(edition.id) || 'unknown'
        }));

        return new Response(JSON.stringify(editionsWithTypes), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};