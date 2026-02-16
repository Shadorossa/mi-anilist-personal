export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const GET: APIRoute = async () => {
    try {
        // 1. Hacemos todas las peticiones a la vez para más eficiencia
        const [
            worksRes,
            charactersRes,
            sagasRes,
            monthlyPicksRes,
            monthlyCharsRes,
            musicRes,
            favoritesRes,
            configRes,
        ] = await Promise.all([
            supabase.from("works").select("*"),
            supabase.from("characters").select("*"),
            supabase.from("sagas").select("*"),
            supabase.from("monthly_picks").select("*"),
            supabase.from("monthly_chars").select("*"),
            supabase.from("music").select("*"),
            supabase.from("favorites").select("*").order("order"),
            supabase.from("config").select("*").single(),
        ]);

        // 2. Comprobamos errores (opcional pero recomendado)
        if (worksRes.error) throw new Error(`Works fetch failed: ${worksRes.error.message}`);
        // ... puedes añadir comprobaciones para las demás

        // 3. Estructuramos los datos en un solo objeto JSON
        const fullDatabaseExport = {
            works: worksRes.data,
            characters: charactersRes.data,
            sagas: sagasRes.data,
            monthlyPicks: monthlyPicksRes.data,
            monthlyChars: monthlyCharsRes.data,
            music: musicRes.data,
            favorites: favoritesRes.data,
            config: configRes.data,
        };

        // 4. Devolvemos el JSON como respuesta
        return new Response(JSON.stringify(fullDatabaseExport, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                // Este header sugiere al navegador que descargue el archivo
                "Content-Disposition": `attachment; filename="supabase_backup_${new Date().toISOString().split('T')[0]}.json"`,
            },
        });

    } catch (error) {
        console.error("Error exporting database:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};