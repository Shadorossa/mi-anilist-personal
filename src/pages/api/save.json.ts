export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();

        // CASO 1: ACTUALIZAR DATABASE.JSON (Favoritos y Mensuales)
        if (data.type === 'update_db') {
            const dbPath = path.join(process.cwd(), 'src', 'content', 'database.json');

            // Leer estado actual
            let currentDb = { favorites: [], monthlyPicks: [] };
            try {
                const file = await fs.readFile(dbPath, 'utf-8');
                currentDb = JSON.parse(file);
            } catch (e) {
                // Si no existe, se crea
            }

            // Actualizar datos
            if (data.favorites) currentDb.favorites = data.favorites;
            if (data.monthlyPicks) currentDb.monthlyPicks = data.monthlyPicks;

            // Escribir
            await fs.writeFile(dbPath, JSON.stringify(currentDb, null, 2));
            console.log("✅ Database actualizada:", Object.keys(data));
            return new Response(JSON.stringify({ success: true }));
        }

        // CASO 2: GUARDAR PERFIL
        if (data.type === 'profile_config') {
            const filePath = path.join(process.cwd(), 'src', 'content', 'config.json');
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return new Response(JSON.stringify({ success: true }));
        }

        // CASO 3: GUARDAR OBRA INDIVIDUAL
        const { type, title, id } = data;
        if (!type || !title) throw new Error("Datos incompletos");

        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fileName = `${id || safeTitle}.json`;
        const dirPath = path.join(process.cwd(), 'src', 'content', type);

        await fs.mkdir(dirPath, { recursive: true });

        // Guardamos datos de la obra (sin metadatos globales)
        const fileContent = {
            title: data.title,
            cover: data.cover,
            status: data.status,
            score: Number(data.score),
            year: data.year,
            id: data.id
        };

        await fs.writeFile(path.join(dirPath, fileName), JSON.stringify(fileContent, null, 2));
        console.log("✅ Obra guardada:", title);

        return new Response(JSON.stringify({ success: true }));

    } catch (e: any) {
        console.error("❌ Error API:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}