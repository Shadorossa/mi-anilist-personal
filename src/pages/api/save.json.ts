import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { fileData, dbData } = body;

    if (!fileData) {
      return new Response(JSON.stringify({ error: "Faltan los datos del archivo (fileData)." }), { status: 400 });
    }

    // --- 1. Guardar la entrada principal (obra o música) ---
    if (fileData.type === 'music') {
      // Es una canción, la guardamos en la tabla 'music'
      const { error } = await supabase.from('music').upsert({
        title: fileData.title,
        artist: fileData.artist,
        album: fileData.album,
        year: fileData.year,
        cover: fileData.cover,
        score: fileData.score,
        // Añadimos un ID si existe para que 'upsert' pueda actualizar
        ...(fileData.id && { id: fileData.id }),
      });

      if (error) throw new Error(`Error al guardar en 'music': ${error.message}`);

    } else {
      // Es una obra (juego, anime, etc.), la guardamos en la tabla 'works'
      const { error } = await supabase.from('works').upsert({
        title: fileData.title,
        cover: fileData.cover,
        year: fileData.year,
        type: fileData.type,
        status: fileData.status,
        score: fileData.score,
        start_date: fileData.startDate,
        finish_date: fileData.finishDate,
        cover_offset_y: fileData.coverOffsetY,
        private_notes: fileData.privateNotes,
        // Añadimos un ID si existe para que 'upsert' pueda actualizar
        ...(fileData.id && { id: fileData.id }),
      });

      if (error) throw new Error(`Error al guardar en 'works': ${error.message}`);
    }

    // --- 2. Guardar datos adicionales (favoritos, mensuales, sagas, etc.) ---
    if (dbData) {
      const promises = [];

      if (dbData.favorites) {
        // Borramos los favoritos existentes y los reinsertamos para mantener el orden
        promises.push(supabase.from('favorites').delete().neq('id', -1)); // Borra todo
        const favsToInsert = dbData.favorites.map((fav, index) => ({
          order: index,
          is_saga: fav.is_saga || fav.isSaga || false,
          title: fav.title,
          cover: fav.cover || null,
        }));
        if (favsToInsert.length > 0) {
          promises.push(supabase.from('favorites').insert(favsToInsert));
        }
      }

      if (dbData.monthlyPicks) {
        const picksToUpsert = dbData.monthlyPicks.map(p => ({ month: p.month, work_title: p.title, cover: p.cover }));
        if (picksToUpsert.length > 0) {
          promises.push(supabase.from('monthly_picks').upsert(picksToUpsert, { onConflict: 'month' }));
        }
      }

      if (dbData.sagas) {
        promises.push(supabase.from('sagas').delete().neq('id', -1));
        const sagasToInsert = Object.entries(dbData.sagas).map(([name, titles]) => ({ name: name, work_titles: titles }));
        if (sagasToInsert.length > 0) {
          promises.push(supabase.from('sagas').insert(sagasToInsert));
        }
      }

      if (dbData.characters || dbData.likedCharacters || dbData.interestedCharacters || dbData.dislikedCharacters) {
        const allChars = [
          ...(dbData.characters || []).map((c, i) => ({ ...c, category: 'hall_of_fame', order: i })),
          ...(dbData.likedCharacters || []).map(c => ({ ...c, category: 'liked', order: null })),
          ...(dbData.interestedCharacters || []).map(c => ({ ...c, category: 'interested', order: null })),
          ...(dbData.dislikedCharacters || []).map(c => ({ ...c, category: 'disliked', order: null })),
        ];
        const charsToUpsert = allChars.map(c => ({ id: c.id, title: c.title, cover: c.cover, source_id: c.source_id || c.sourceId, cover_offset_y: c.cover_offset_y ?? c.coverOffsetY, category: c.category, order: c.order }));
        if (charsToUpsert.length > 0) {
          promises.push(supabase.from('characters').upsert(charsToUpsert, { onConflict: 'id' }));
        }
      }

      if (dbData.monthlyChars) {
        const charPicksToUpsert = dbData.monthlyChars.map(p => ({ month: p.month, char_name: p.name, cover: p.cover }));
        if (charPicksToUpsert.length > 0) {
          promises.push(supabase.from('monthly_chars').upsert(charPicksToUpsert, { onConflict: 'month' }));
        }
      }

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status === 'rejected') console.error("Error en una de las operaciones de dbData:", result.reason);
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error("Error en API de guardado:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};