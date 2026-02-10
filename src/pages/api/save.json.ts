export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const dbPath = path.join(process.cwd(), 'src', 'content', 'database.json');

    // --- ACTUALIZAR DATABASE.JSON ---
    if (data.type === 'update_db') {
      let currentDb = { favorites: [], monthlyPicks: [], characters: [], monthlyChars: [] };
      try {
        const file = await fs.readFile(dbPath, 'utf-8');
        currentDb = JSON.parse(file);
      } catch (e) {}

      if (data.favorites !== undefined) currentDb.favorites = data.favorites;
      if (data.monthlyPicks !== undefined) currentDb.monthlyPicks = data.monthlyPicks;
      if (data.characters !== undefined) currentDb.characters = data.characters;
      // NUEVO: Guardar historial personajes
      if (data.monthlyChars !== undefined) currentDb.monthlyChars = data.monthlyChars;

      await fs.writeFile(dbPath, JSON.stringify(currentDb, null, 2));
      return new Response(JSON.stringify({ success: true }));
    }

    // --- GUARDAR PERFIL ---
    if (data.type === 'profile_config') {
      const configPath = path.join(process.cwd(), 'src', 'content', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({ success: true }));
    }

    // --- GUARDAR OBRA INDIVIDUAL ---
    const { type, title, id } = data;
    // Si es personaje, NO guardamos archivo individual, se gestiona en database.json
    if (type === 'character') return new Response(JSON.stringify({ success: true }));

    if (!type || !title) throw new Error("Datos incompletos");

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fileName = `${id || safeTitle}.json`;
    const dirPath = path.join(process.cwd(), 'src', 'content', type);

    await fs.mkdir(dirPath, { recursive: true });

    const fileContent = {
      title: data.title,
      cover: data.cover,
      status: data.status,
      score: Number(data.score),
      year: data.year,
      id: data.id
    };

    await fs.writeFile(path.join(dirPath, fileName), JSON.stringify(fileContent, null, 2));
    return new Response(JSON.stringify({ success: true }));

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}