import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { fileData, dbData } = body;

    // Validación: debe haber algo que guardar.
    // El cuerpo de la petición debe contener `fileData` (para una obra/música) o `dbData` (para favoritos, sagas, personajes, versiones, etc.).
    const hasDbData = dbData && Object.keys(dbData).length > 0;
    if (!fileData && !hasDbData) {
      return new Response(JSON.stringify({ error: "Faltan datos para guardar." }), { status: 400 });
    }

    let savedRecord = null;
    let savedCharacters = null;

    // --- 1. Guardar la entrada principal (obra o música), si existe fileData ---
    if (fileData) {
      if (fileData.type === 'music') {
        // 1. Upsert del álbum para obtener su ID
        const { data: albumRecord, error: albumError } = await supabase
          .from('albums')
          .upsert({
            title: fileData.album,
            artist: fileData.artist,
            cover: fileData.cover,
            year: fileData.year,
          }, { onConflict: 'title, artist' })
          .select()
          .single();

        if (albumError) throw new Error(`Error al gestionar el álbum: ${albumError.message}`);

        // 2. Upsert de la canción con el ID del álbum
        const { data: songRecord, error: songError } = await supabase
          .from('music')
          .upsert({
            ...(fileData.id && { id: fileData.id }),
            title: fileData.title,
            score: fileData.score,
            album_id: albumRecord.id,
          })
          .select()
          .single();

        if (songError) throw new Error(`Error al guardar la canción: ${songError.message}`);

        // 3. Devolvemos la canción recién guardada junto con los datos de su álbum
        const { data: newSongWithAlbum, error: fetchError } = await supabase
          .from('music')
          .select('*, albums(*)')
          .eq('id', songRecord.id)
          .single();

        if (fetchError) throw new Error(`Error al recuperar la canción guardada: ${fetchError.message}`);
        savedRecord = newSongWithAlbum;

      } else if (fileData.type === 'music-album') {
        // Es un álbum, lo guardamos en la tabla 'albums'
        const { data, error } = await supabase.from('albums').upsert({
          id: fileData.id,
          title: fileData.title,
          artist: fileData.artist,
          cover: fileData.cover,
          year: fileData.year,
          cover_offset_y: fileData.coverOffsetY,
        }).select().single();

        if (error) throw new Error(`Error al guardar en 'albums': ${error.message}`);
        savedRecord = data;

      } else {
        // Es una obra (juego, anime, etc.), la guardamos en la tabla 'works'
        const { data, error } = await supabase.from('works').upsert({
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
        }).select().single();

        if (error) throw new Error(`Error al guardar en 'works': ${error.message}`);
        savedRecord = data;
      }
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
          const { data, error } = await supabase.from('characters').upsert(charsToUpsert, { onConflict: 'id' }).select();
          if (error) {
            throw new Error(`Error upserting characters: ${error.message}`);
          }
          savedCharacters = data;
        }
      }

      if (dbData.monthlyChars) {
        const charPicksToUpsert = dbData.monthlyChars.map(p => ({ month: p.month, char_name: p.name, cover: p.cover }));
        if (charPicksToUpsert.length > 0) {
          promises.push(supabase.from('monthly_chars').upsert(charPicksToUpsert, { onConflict: 'month' }));
        }
      }

      if (dbData.versions) {
        const { mainGameId, mainGameTitle, editions } = dbData.versions;

        const manageVersions = async () => {
          // 1. Delete all existing entries for this main game
          const { error: deleteError } = await supabase.from('game_versions').delete().eq('main_igdb_id', mainGameId);
          if (deleteError) throw new Error(`Error deleting old versions: ${deleteError.message}`);

          // 2. Insert new entries if any
          if (editions && editions.length > 0) {
            const versionsToInsert = editions.map(edition => ({
              main_igdb_id: mainGameId,
              edition_igdb_id: edition.id,
              main_title: mainGameTitle,
              edition_title: edition.title,
              version_type: edition.version_type,
            }));
            const { error: insertError } = await supabase.from('game_versions').insert(versionsToInsert);
            if (insertError) throw new Error(`Error inserting new versions: ${insertError.message}`);
          }
        };
        promises.push(manageVersions());
      }

      // Se cambia a Promise.all para que cualquier error en las sub-operaciones
      // detenga la ejecución y sea capturado por el bloque catch principal.
      // Esto asegura que el cliente reciba una respuesta de error si algo falla.
      await Promise.all(promises);
    }

    return new Response(JSON.stringify({ success: true, savedRecord, savedCharacters }), { status: 200 });

  } catch (error) {
    console.error("Error en API de guardado:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};