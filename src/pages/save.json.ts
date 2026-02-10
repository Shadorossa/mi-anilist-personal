export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { exec } from 'child_process';

// Función auxiliar para descargar imágenes
async function downloadImage(url: string, folder: string, filename: string) {
    if (!url || url.includes('placehold.co')) return '/img/no-cover.jpg';

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error descargando imagen: ${response.statusText}`);

    const extension = path.extname(url).split('?')[0] || '.jpg';
    const localFileName = `${filename}${extension}`;
    const savePath = path.join(process.cwd(), 'public', 'img', folder, localFileName);

    // Asegurar carpeta
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileStream = fs.createWriteStream(savePath);
    // @ts-ignore
    await pipeline(response.body, fileStream);

    return `/img/${folder}/${localFileName}`;
}

export const POST: APIRoute = async ({ request }) => {
    const data = await request.json();

    // MODO 1: Guardar Configuración de Perfil
    if (data.type === 'profile_config') {
        const bannerPath = await downloadImage(data.bannerUrl, 'profile', 'banner');
        const avatarPath = await downloadImage(data.avatarUrl, 'profile', 'avatar');

        const configData = {
            username: data.username,
            bio: data.bio,
            banner: bannerPath,
            avatar: avatarPath
        };

        fs.writeFileSync(path.join(process.cwd(), 'src/content/config.json'), JSON.stringify(configData, null, 2));
        return new Response(JSON.stringify({ success: true }));
    }

    // MODO 2: Guardar Juego/Anime
    const { type, title, cover, ...rest } = data; // type: 'games' | 'anime'
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Descargar la carátula
    const localCoverPath = await downloadImage(cover, 'covers', slug);

    const fileData = { title, cover: localCoverPath, ...rest };
    const filePath = path.join(process.cwd(), 'src/content', type, `${slug}.json`);

    // Crear carpeta si no existe
    if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));

    // GIT COMMIT AUTOMÁTICO
    exec('git add . && git commit -m "Update: Library content" && git push');

    return new Response(JSON.stringify({ success: true }));
}