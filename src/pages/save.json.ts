export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export const POST: APIRoute = async ({ request }) => {
    const data = await request.json();
    const { type, title, ...rest } = data; // type es 'games' o 'anime'

    // Limpiar título para nombre de archivo
    const fileName = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.json';
    const dirPath = path.join(process.cwd(), 'src/content', type);

    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    // Guardar archivo
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ title, ...rest }, null, 2));

    // Ejecutar GIT (Solo funciona si corres esto en local)
    exec('git add . && git commit -m "Update via Admin" && git push', (err, stdout) => {
        if (err) console.error(err);
        else console.log(stdout);
    });

    return new Response(JSON.stringify({ success: true }));
}