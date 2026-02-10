export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();

        // CASO 1: GUARDAR CONFIGURACIÓN MENSUAL O PERFIL
        if (data.type === 'monthly_config' || data.type === 'profile_config') {
            const fileName = data.type === 'monthly_config' ? 'monthly.json' : 'config.json';
            const filePath = path.join(process.cwd(), 'src', 'content', fileName);

            // Si es monthly, guardamos solo el array. Si es perfil, el objeto.
            const contentToSave = data.type === 'monthly_config' ? data.items : data;

            await fs.writeFile(filePath, JSON.stringify(contentToSave, null, 2));
            return new Response(JSON.stringify({ success: true }));
        }

        // CASO 2: GUARDAR OBRA INDIVIDUAL (Juego/Anime/Manga)
        const { type, title, id } = data;
        if (!type || !title) throw new Error("Datos incompletos");

        // Limpiar nombre de archivo
        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fileName = `${id || safeTitle}.json`;
        const dirPath = path.join(process.cwd(), 'src', 'content', type); // type = 'games', 'anime', etc.

        // Asegurar directorio
        await fs.mkdir(dirPath, { recursive: true });

        // Preparar datos limpios para guardar
        const fileContent = {
            title: data.title,
            cover: data.cover,
            status: data.status,
            score: Number(data.score),
            year: data.year,
            id: data.id,
            // Aseguramos que favorite sea booleano
            favorite: data.favorite === true,
            favIndex: data.favIndex || 999
        };

        await fs.writeFile(path.join(dirPath, fileName), JSON.stringify(fileContent, null, 2));

        return new Response(JSON.stringify({ success: true, message: "Guardado" }));

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}