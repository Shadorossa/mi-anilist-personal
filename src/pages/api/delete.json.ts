// src/pages/api/delete.json.ts
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { type, id, title } = body; // title es pasado desde el cliente

        if (!type || !id) {
            return new Response(JSON.stringify({ error: "Datos no válidos: se requieren 'type' y 'id'." }), { status: 400 });
        }

        let tableName = '';
        if (type === 'music') {
            tableName = 'music';
        } else if (['games', 'anime', 'manga'].includes(type)) {
            tableName = 'works';
        } else {
            return new Response(JSON.stringify({ error: `Tipo de medio no soportado para eliminación: ${type}` }), { status: 400 });
        }

        const promises = [];

        // Si es una obra, también la eliminamos de favoritos y picks mensuales
        if (tableName === 'works' && title) {
            // Para mangas, comprobamos el título con y sin el sufijo " -M"
            const mangaTitleWithSuffix = title.endsWith(' -M') ? title : `${title} -M`;
            const mangaTitleWithoutSuffix = title.endsWith(' -M') ? title.slice(0, -3) : title;

            promises.push(supabase.from('favorites').delete().in('title', [mangaTitleWithSuffix, mangaTitleWithoutSuffix]));
            promises.push(supabase.from('monthly_picks').delete().eq('work_title', mangaTitleWithoutSuffix));
        }

        // Ejecutamos la limpieza primero
        if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            results.forEach(result => {
                if (result.status === 'rejected') console.error("Error durante la limpieza de datos relacionados:", result.reason);
            });
        }

        // Finalmente, eliminamos el registro principal
        const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id);

        if (deleteError) {
            if (deleteError.code === '23503') { // Violación de clave foránea
                let message = `No se puede eliminar. El registro está siendo referenciado por otros datos`;
                if (tableName === 'works') {
                    message += ` (posiblemente como obra de origen de un personaje).`;
                }
                throw new Error(message);
            }
            throw new Error(`Error de Supabase: ${deleteError.message}`);
        }

        return new Response(JSON.stringify({ success: true, message: `Registro ${id} eliminado.` }), { status: 200 });

    } catch (error) {
        console.error("Error en API de eliminación:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
