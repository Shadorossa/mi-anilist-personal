// scripts/migrate.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Asegúrate de que tus variables de entorno están cargadas
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file.");
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const contentDir = path.resolve('./src/content');

async function migrateWorks() {
    console.log('Migrating works (games, anime, manga)...');
    const collections = ['games', 'anime', 'manga'];
    let allWorks = [];

    for (const collection of collections) {
        const dirPath = path.join(contentDir, collection);
        try {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
                    const data = JSON.parse(content);

                    // **LA CORRECCIÓN ESTÁ AQUÍ**
                    // Mapeamos los nombres de los campos del JSON (camelCase) a los de la base de datos (snake_case)
                    const workData = {
                        id: `${collection}/${file}`, // ID único, ej: 'games/elden-ring.json'
                        title: data.title,
                        cover: data.cover,
                        year: data.year,
                        type: data.type,
                        status: data.status,
                        score: data.score,
                        start_date: data.startDate || '',
                        finish_date: data.finishDate || '',
                        cover_offset_y: data.coverOffsetY,
                        private_notes: data.privateNotes || ''
                    };
                    allWorks.push(workData);
                }
            }
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.log(`Directory not found, skipping: ${dirPath}`);
            } else {
                console.error(`Error reading ${collection} dir:`, e);
            }
        }
    }

    if (allWorks.length > 0) {
        console.log(`Found ${allWorks.length} works to migrate.`);

        // 1. Borramos todos los datos existentes para asegurar una migración limpia
        console.log('Clearing existing works from the database...');
        const { error: deleteError } = await supabase.from('works').delete().neq('id', 'dummy-id-to-delete-all');
        if (deleteError) {
            console.error('Error clearing works table:', deleteError);
            return; // Detenemos la ejecución si no podemos borrar
        }
        console.log('Existing works cleared successfully.');

        // 2. Insertamos los nuevos datos
        console.log('Inserting new works into the database...');
        const { error: insertError } = await supabase.from('works').insert(allWorks);
        if (insertError) {
            console.error('Error migrating works:', insertError);
        } else {
            console.log(`Migrated ${allWorks.length} works successfully.`);
        }
    } else {
        console.log('No works found in local JSON files to migrate.');
    }
}

async function main() {
    console.log('Starting data migration for WORKS only...');
    await migrateWorks();
    console.log('Migration for works finished! The rest of the data (characters, etc.) was not touched.');
}

main();
