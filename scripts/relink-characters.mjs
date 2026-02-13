import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function main() {
    console.log('Iniciando proceso para re-ligar personajes a sus obras...');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.error("Error: Las variables SUPABASE_URL y SUPABASE_ANON_KEY deben estar en tu archivo .env.");
        process.exit(1);
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    // 1. Obtener todas las obras
    const { data: works, error: worksError } = await supabase.from('works').select('id');
    if (worksError) {
        console.error('Error obteniendo las obras:', worksError);
        return;
    }
    console.log(`Encontradas ${works.length} obras en la base de datos.`);

    // 2. Crear un mapa desde el ID antiguo (nombre de archivo) al ID nuevo (coleccion/nombre de archivo)
    const workIdMap = new Map();
    for (const work of works) {
        const parts = work.id.split('/');
        if (parts.length === 2) {
            const oldId = parts[1];
            workIdMap.set(oldId, work.id);
        }
    }
    console.log('Mapa de IDs de obras creado.');

    // 3. Obtener todos los personajes
    const { data: characters, error: charactersError } = await supabase.from('characters').select('id, source_id');
    if (charactersError) {
        console.error('Error obteniendo los personajes:', charactersError);
        return;
    }
    console.log(`Encontrados ${characters.length} personajes para procesar.`);

    // 4. Encontrar los personajes que necesitan ser actualizados
    const charactersToUpdate = [];
    for (const character of characters) {
        // Comprobar si el source_id existe y NO tiene el formato nuevo (no contiene '/')
        if (character.source_id && !character.source_id.includes('/')) {
            const oldId = character.source_id;
            const newId = workIdMap.get(oldId);

            if (newId) {
                // Coincidencia encontrada, preparamos la actualización
                charactersToUpdate.push({
                    id: character.id,
                    source_id: newId
                });
            } else {
                console.warn(`- Aviso: No se encontró una obra para el personaje con source_id: "${oldId}"`);
            }
        }
    }

    if (charactersToUpdate.length === 0) {
        console.log('No se necesita re-ligar ningún personaje. ¡Todos los source_id parecen correctos!');
        return;
    }

    console.log(`${charactersToUpdate.length} personajes necesitan actualizar su source_id.`);

    // 5. Actualizar los personajes en la base de datos
    console.log('Actualizando personajes...');
    const { error: updateError } = await supabase.from('characters').upsert(charactersToUpdate);

    if (updateError) {
        console.error('Error al actualizar los personajes:', updateError);
    } else {
        console.log(`¡Se han actualizado ${charactersToUpdate.length} personajes correctamente!`);
    }

    console.log('Proceso de re-ligado finalizado.');
}

main();