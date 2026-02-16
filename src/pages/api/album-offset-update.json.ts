// src/pages/api/album-offset-update.json.ts
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { album, cover_offset_y } = body;

        if (!album || cover_offset_y === undefined) {
            return new Response(JSON.stringify({ error: "Datos no válidos: se requieren 'album' y 'cover_offset_y'." }), { status: 400 });
        }

        const { error } = await supabase
            .from('music')
            .update({ cover_offset_y: cover_offset_y })
            .eq('album', album);

        if (error) {
            throw new Error(`Error de Supabase: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, message: `Offset actualizado para el álbum ${album}.` }), { status: 200 });

    } catch (error) {
        console.error("Error en API de actualización de offset de álbum:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
