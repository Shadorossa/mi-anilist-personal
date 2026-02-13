import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { ids, source_id } = body;

        if (!Array.isArray(ids) || ids.length === 0 || !source_id) {
            return new Response(JSON.stringify({ error: "Datos no válidos: se requieren 'ids' (array) y 'source_id' (string)." }), { status: 400 });
        }

        const { error } = await supabase
            .from('characters')
            .update({ source_id: source_id })
            .in('id', ids);

        if (error) {
            throw new Error(`Error de Supabase: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, message: `${ids.length} personajes actualizados.` }), { status: 200 });

    } catch (error) {
        console.error("Error en API de actualización masiva de personajes:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};