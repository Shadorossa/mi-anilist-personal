import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { updates } = body; // Espera un array de {id: string, cover_offset_y: number}

        if (!Array.isArray(updates) || updates.length === 0) {
            return new Response(JSON.stringify({ error: "Datos no válidos: se requiere un array 'updates'." }), { status: 400 });
        }

        // Nos aseguramos de que solo se actualicen los campos deseados
        const cleanUpdates = updates.map(u => ({
            id: u.id,
            cover_offset_y: u.cover_offset_y,
            // Pasamos los campos NOT NULL para evitar errores en caso de que upsert intente un INSERT
            title: u.title,
            category: u.category
        }));

        const { error } = await supabase.from('characters').upsert(cleanUpdates);

        if (error) {
            throw new Error(`Error de Supabase: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, message: `${updates.length} offsets de personajes actualizados.` }), { status: 200 });

    } catch (error) {
        console.error("Error en API de actualización masiva de offsets:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};