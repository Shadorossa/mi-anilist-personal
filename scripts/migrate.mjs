// scripts/migrate.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const contentDir = path.resolve('./src/content');

async function migrateWorks() {
    console.log('Migrating works...');
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
                    allWorks.push({
                        id: file,
                        ...data
                    });
                }
            }
        } catch (e) {
            if (e.code !== 'ENOENT') console.error(`Error reading ${collection} dir:`, e);
        }
    }

    const { error } = await supabase.from('works').upsert(allWorks);
    if (error) console.error('Error migrating works:', error);
    else console.log(`Migrated ${allWorks.length} works successfully.`);
}

async function migrateDatabaseJson() {
    console.log('Migrating database.json...');
    try {
        const dbPath = path.join(contentDir, 'database.json');
        const dbContent = await fs.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbContent);

        // Favorites
        if (db.favorites) {
            const favsToInsert = db.favorites.map((fav, index) => {
                if (typeof fav === 'string') {
                    return { order: index, is_saga: false, title: fav };
                }
                return { order: index, is_saga: true, title: fav.title, cover: fav.cover };
            });
            await supabase.from('favorites').delete().neq('order', -1); // Clear table
            const { error } = await supabase.from('favorites').insert(favsToInsert);
            if (error) console.error('Error migrating favorites:', error);
            else console.log('Migrated favorites.');
        }

        // Characters
        const allChars = [];
        if (db.characters) allChars.push(...db.characters.map((c, i) => ({ ...c, id: c.id || `hof-${i}`, category: 'hall_of_fame', order: i })));
        if (db.likedCharacters) allChars.push(...db.likedCharacters.map((c, i) => ({ ...c, id: c.id || `liked-${i}`, category: 'liked' })));
        if (db.interestedCharacters) allChars.push(...db.interestedCharacters.map((c, i) => ({ ...c, id: c.id || `interested-${i}`, category: 'interested' })));
        if (db.dislikedCharacters) allChars.push(...db.dislikedCharacters.map((c, i) => ({ ...c, id: c.id || `disliked-${i}`, category: 'disliked' })));

        const charsToInsert = allChars.map(c => ({
            id: c.id,
            title: c.title,
            cover: c.cover,
            source_id: c.sourceId,
            cover_offset_y: c.coverOffsetY,
            category: c.category,
            order: c.order
        }));

        await supabase.from('characters').delete().neq('id', 'dummy-id-to-delete-all');
        const { error: charError } = await supabase.from('characters').insert(charsToInsert);
        if (charError) console.error('Error migrating characters:', charError);
        else console.log('Migrated characters.');


        // Monthly Picks
        if (db.monthlyPicks) {
            const picksToInsert = db.monthlyPicks.map(p => ({ month: p.month, work_title: p.title, cover: p.cover }));
            await supabase.from('monthly_picks').delete().neq('month', 'dummy-month');
            const { error } = await supabase.from('monthly_picks').insert(picksToInsert);
            if (error) console.error('Error migrating monthly picks:', error);
            else console.log('Migrated monthly picks.');
        }

        // Monthly Chars
        if (db.monthlyChars) {
            const charPicksToInsert = db.monthlyChars.map(p => ({ month: p.month, char_name: p.name, cover: p.cover }));
            await supabase.from('monthly_chars').delete().neq('month', 'dummy-month');
            const { error } = await supabase.from('monthly_chars').insert(charPicksToInsert);
            if (error) console.error('Error migrating monthly chars:', error);
            else console.log('Migrated monthly chars.');
        }

        // Sagas
        if (db.sagas) {
            const sagasToInsert = Object.entries(db.sagas).map(([name, titles]) => ({ name, work_titles: titles }));
            await supabase.from('sagas').delete().neq('name', 'dummy-name');
            const { error } = await supabase.from('sagas').insert(sagasToInsert);
            if (error) console.error('Error migrating sagas:', error);
            else console.log('Migrated sagas.');
        }

    } catch (e) {
        console.error('Error reading database.json:', e);
    }
}

async function migrateConfigJson() {
    console.log('Migrating config.json...');
    try {
        const configPath = path.join(contentDir, 'config.json');
        const dbPath = path.join(contentDir, 'database.json');

        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        const dbContent = await fs.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbContent);

        const configToInsert = {
            id: 1,
            username: config.username,
            bio: config.bio,
            deco_pairs: db.decoPairs || [],
            deco_groups: db.decoGroups || []
        };

        const { error } = await supabase.from('config').upsert(configToInsert);
        if (error) console.error('Error migrating config:', error);
        else console.log('Migrated config.');

    } catch (e) {
        console.error('Error reading config.json or database.json:', e);
    }
}


async function main() {
    console.log('Starting migration to Supabase...');
    await migrateWorks();
    await migrateDatabaseJson();
    await migrateConfigJson();
    console.log('Migration finished!');
}

main();
