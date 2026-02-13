export const prerender = false;
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '../../lib/supabase';

// Helper function to find an existing local image with flexible extension
async function findLocalImage(baseDir: string, slug: string): Promise<string | null> {
  const commonExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  for (const ext of commonExtensions) {
    const fullPath = path.join(baseDir, `${slug}${ext}`);
    try {
      await fs.access(fullPath);
      return `${slug}${ext}`;
    } catch {
      // file does not exist, continue
    }
  }
  return null;
}

const DEFAULT_IMAGE_EXTENSION = '.png'; // Prioritize saving as PNG

function romanToArabic(roman) {
  if (typeof roman !== 'string') return null;
  roman = roman.toUpperCase();
  const romanMap = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = romanMap[roman[i]];
    const next = romanMap[roman[i + 1]];
    if (current === undefined) return null; // Invalid character
    if (next !== undefined && next > current) {
      result += next - current;
      i++;
    } else {
      result += current;
    }
  }
  return result;
}

export const POST = async ({ request }) => {
  try {
    const body = await request.json();

    // CASO A: Actualizar base de datos central (Favoritos / Picks / Personajes)
    if (body.dbData) {
      const { favorites, monthlyPicks, characters, likedCharacters, interestedCharacters, dislikedCharacters, monthlyChars, sagas } = body.dbData;

      if (favorites) {
        const favsToInsert = favorites.map((fav, index) => {
          if (typeof fav === 'string') {
            return { order: index, is_saga: false, title: fav };
          }
          return { order: index, is_saga: true, title: fav.title, cover: fav.cover };
        });
        await supabase.from('favorites').delete().neq('order', -1);
        const { error } = await supabase.from('favorites').insert(favsToInsert);
        if (error) throw new Error(`Favorites Error: ${error.message}`);
      }

      if (monthlyPicks) {
        const picksToInsert = monthlyPicks.map(p => ({ month: p.month, work_title: p.title, cover: p.cover }));
        await supabase.from('monthly_picks').delete().neq('month', 'dummy-month');
        const { error } = await supabase.from('monthly_picks').upsert(picksToInsert);
        if (error) throw new Error(`MonthlyPicks Error: ${error.message}`);
      }

      if (monthlyChars) {
        const charPicksToInsert = monthlyChars.map(p => ({ month: p.month, char_name: p.name, cover: p.cover }));
        await supabase.from('monthly_chars').delete().neq('month', 'dummy-month');
        const { error } = await supabase.from('monthly_chars').upsert(charPicksToInsert);
        if (error) throw new Error(`MonthlyChars Error: ${error.message}`);
      }

      if (sagas) {
        const sagasToInsert = Object.entries(sagas).map(([name, titles]) => ({ name, work_titles: titles }));
        await supabase.from('sagas').delete().neq('name', 'dummy-name');
        const { error } = await supabase.from('sagas').upsert(sagasToInsert);
        if (error) throw new Error(`Sagas Error: ${error.message}`);
      }

      // Handle all character lists
      if (characters || likedCharacters || interestedCharacters || dislikedCharacters) {
        const allChars = [];
        if (characters) allChars.push(...characters.map((c, i) => ({ ...c, category: 'hall_of_fame', order: i })));
        if (likedCharacters) allChars.push(...likedCharacters.map(c => ({ ...c, category: 'liked' })));
        if (interestedCharacters) allChars.push(...interestedCharacters.map(c => ({ ...c, category: 'interested' })));
        if (dislikedCharacters) allChars.push(...dislikedCharacters.map(c => ({ ...c, category: 'disliked' })));

        const charsToUpsert = allChars.map(c => ({
          id: c.id,
          title: c.title,
          cover: c.cover,
          source_id: c.sourceId,
          cover_offset_y: c.coverOffsetY,
          category: c.category,
          order: c.order
        }));

        // To do a full sync, we delete all and re-insert
        await supabase.from('characters').delete().neq('id', 'dummy-id-to-delete-all');
        const { error } = await supabase.from('characters').insert(charsToUpsert);
        if (error) throw new Error(`Characters Error: ${error.message}`);
      }
    }

    // CASO B: Guardar una obra individual (Game, Anime, Manga)
    if (body.fileData) {
      const { title, type, cover, year, status, score, startDate, finishDate, coverOffsetY, privateNotes } = body.fileData;

      if (!title || !type) {
        if (!body.dbData) {
          return new Response(JSON.stringify({ error: "Faltan datos críticos para guardar el archivo" }), { status: 400 });
        }
      } else {
        let collectionFolder = type;
        if (type === 'game') collectionFolder = 'games';

        const finalTitle = title.endsWith(' -M') ? title.slice(0, -3) : title;
        const baseTitleForJson = finalTitle;


        const jsonSlug = baseTitleForJson.toLowerCase()
          .replace(/[^a-z0-9\s-°'’]/g, '') // Permitir ', °, ’ y guiones
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-') + '.json';

        const coverSlug = title.toLowerCase()
          .replace(/[^a-z0-9\s-°'’]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        const coverDir = path.resolve('./public/img/covers');
        let finalCoverPath = cover;
        if (cover && cover.startsWith('http')) {
          await fs.mkdir(coverDir, { recursive: true });

          const existingLocalFileName = await findLocalImage(coverDir, coverSlug);
          if (existingLocalFileName) {
            finalCoverPath = `/img/covers/${existingLocalFileName}`;
          } else {
            // If no local file exists, download and save as PNG
            const newCoverFileName = `${coverSlug}${DEFAULT_IMAGE_EXTENSION}`;
            const newLocalCoverPath = path.resolve(coverDir, newCoverFileName);
            const newPublicCoverPath = `/img/covers/${newCoverFileName}`;

            try {
              const imageResponse = await fetch(cover);
              if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                await fs.writeFile(newLocalCoverPath, Buffer.from(imageBuffer));
                finalCoverPath = newPublicCoverPath;
              }
            } catch (e) {
              console.error(`Failed to download cover for ${title}:`, e);
            } // Fallback to original URL if download fails
          }
        }

        const mediaData = {
          id: jsonSlug,
          title: finalTitle,
          cover: finalCoverPath, year,
          type: collectionFolder,
          status: status || 'Jugando',
          score: Number(score) || 0,
          start_date: startDate || '',
          finish_date: finishDate || '',
          cover_offset_y: coverOffsetY !== undefined ? Number(coverOffsetY) : 50,
          private_notes: privateNotes || ''
        };

        const { error } = await supabase.from('works').upsert(mediaData);
        if (error) throw new Error(`Work upsert error: ${error.message}`);

        // La automatización de sagas ahora debería hacerse en el lado del cliente o como un trigger en Supabase.
        // Por simplicidad, la eliminamos de este endpoint. La lógica ya existe en `admin.astro`.
      }
    }

    if (!body.dbData && !body.fileData) {
      return new Response(JSON.stringify({ error: "No se proporcionaron datos para guardar" }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (error) {
    console.error("Error en SAVE API:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), { status: 500 });
  }
}