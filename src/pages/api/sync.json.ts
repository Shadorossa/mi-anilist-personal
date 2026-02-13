export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import JSZip from "jszip";

// Helper para crear un slug seguro para nombres de archivo
const createSlug = (title: string): string => {
    if (!title) return 'unknown-' + Date.now();
    return title.toLowerCase()
        .replace(/[^a-z0-9\s-°'’]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

// Helper para obtener la extensión de un archivo desde una URL
const getExtension = (url: string): string => {
    try {
        const pathname = new URL(url).pathname;
        const lastDot = pathname.lastIndexOf('.');
        if (lastDot === -1) return '.jpg'; // Extensión por defecto
        const ext = pathname.substring(lastDot);
        return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext.toLowerCase()) ? ext : '.jpg';
    } catch {
        return '.jpg';
    }
};

export const GET: APIRoute = async () => {
    try {
        const zip = new JSZip();
        const urlToLocalPath = new Map<string, string>();

        const workUpdates: { id: string; cover: string }[] = [];
        const characterUpdates: { id: string; cover: string }[] = [];
        const favoriteSagaUpdates: { title: string; cover: string }[] = [];
        const monthlyPickUpdates: { month: string; cover: string }[] = [];
        const monthlyCharUpdates: { month: string; cover: string }[] = [];

        // --- 1. OBTENER TODOS LOS DATOS DE SUPABASE ---
        const [
            worksRes, charactersRes, sagasRes, monthlyPicksRes,
            monthlyCharsRes, favoritesRes, configRes,
        ] = await Promise.all([
            supabase.from("works").select("*"),
            supabase.from("characters").select("*"),
            supabase.from("sagas").select("*"),
            supabase.from("monthly_picks").select("*"),
            supabase.from("monthly_chars").select("*"),
            supabase.from("favorites").select("*").order("order"),
            supabase.from("config").select("*").single(),
        ]);

        // Comprobar errores
        for (const res of [worksRes, charactersRes, sagasRes, monthlyPicksRes, monthlyCharsRes, favoritesRes, configRes]) {
            if (res.error) throw new Error(`Supabase fetch failed: ${res.error.message}`);
        }

        const allWorks = worksRes.data || [];
        const allCharacters = charactersRes.data || [];
        const allSagas = sagasRes.data || [];
        const allMonthlyPicks = monthlyPicksRes.data || [];
        const allMonthlyChars = monthlyCharsRes.data || [];
        const allFavorites = favoritesRes.data || [];
        const config = configRes.data || {};

        // --- 2. PROCESAR DATOS Y PREPARAR ARCHIVOS ---

        // A. Procesar obras individuales y sus portadas
        const contentFolder = zip.folder("src/content");
        for (const work of allWorks) {
            const { id, created_at, ...workData } = work;
            const typeFolder = work.type === 'games' ? 'games' : work.type;
            const slug = createSlug(work.title);

            if (work.cover && work.cover.startsWith('http')) {
                const extension = getExtension(work.cover);
                const localCoverPath = `/img/covers/${slug}${extension}`;
                urlToLocalPath.set(work.cover, `public${localCoverPath}`);
                workData.cover = localCoverPath;
                workUpdates.push({ id: work.id, cover: localCoverPath });
            }

            contentFolder.file(`${typeFolder}/${slug}.json`, JSON.stringify(workData, null, 2));
        }

        // B. Procesar personajes y sus portadas
        allCharacters.forEach(char => {
            if (char.cover && char.cover.startsWith('http')) {
                const slug = createSlug(char.title);
                const extension = getExtension(char.cover);
                const localCoverPath = `/img/chara/${slug}${extension}`;
                urlToLocalPath.set(char.cover, `public${localCoverPath}`);
                char.cover = localCoverPath;
                characterUpdates.push({ id: char.id, cover: localCoverPath });
            }
        });

        // C. Reconstruir database.json con el formato original
        const sagasMap = allSagas.reduce((acc, saga) => {
            acc[saga.name] = saga.work_titles;
            return acc;
        }, {});

        const favoritesFormatted = allFavorites.map(fav => {
            if (fav.is_saga) {
                let sagaCover = fav.cover;
                if (sagaCover && sagaCover.startsWith('http')) {
                    const slug = createSlug(`saga-${fav.title}`);
                    const extension = getExtension(sagaCover);
                    const localCoverPath = `/img/covers/${slug}${extension}`;
                    urlToLocalPath.set(sagaCover, `public${localCoverPath}`);
                    favoriteSagaUpdates.push({ title: fav.title, cover: localCoverPath });
                    sagaCover = localCoverPath;
                }
                return { isSaga: true, title: fav.title, cover: sagaCover };
            }
            return fav.title;
        });

        const charactersByCategory = {
            hall_of_fame: allCharacters.filter(c => c.category === 'hall_of_fame').sort((a, b) => a.order - b.order),
            liked: allCharacters.filter(c => c.category === 'liked'),
            interested: allCharacters.filter(c => c.category === 'interested'),
            disliked: allCharacters.filter(c => c.category === 'disliked'),
        };

        const monthlyPicksFormatted = allMonthlyPicks.map(p => {
            let pickCover = p.cover;
            if (pickCover && pickCover.startsWith('http')) {
                const slug = createSlug(`monthly-pick-${p.month}`);
                const extension = getExtension(pickCover);
                const localCoverPath = `/img/covers/${slug}${extension}`;
                urlToLocalPath.set(pickCover, `public${localCoverPath}`);
                pickCover = localCoverPath;
                monthlyPickUpdates.push({ month: p.month, cover: localCoverPath });
            }
            return { month: p.month, title: p.work_title, cover: pickCover };
        });
        const monthlyCharsFormatted = allMonthlyChars.map(p => {
            let pickCover = p.cover;
            if (pickCover && pickCover.startsWith('http')) {
                const slug = createSlug(`monthly-char-${p.month}`);
                const extension = getExtension(pickCover);
                const localCoverPath = `/img/chara/${slug}${extension}`;
                urlToLocalPath.set(pickCover, `public${localCoverPath}`);
                pickCover = localCoverPath;
                monthlyCharUpdates.push({ month: p.month, cover: localCoverPath });
            }
            return { month: p.month, name: p.char_name, cover: pickCover };
        });

        const dbJson = {
            favorites: favoritesFormatted,
            monthlyPicks: monthlyPicksFormatted,
            sagas: sagasMap,
            characters: charactersByCategory.hall_of_fame,
            likedCharacters: charactersByCategory.liked,
            interestedCharacters: charactersByCategory.interested,
            dislikedCharacters: charactersByCategory.disliked,
            monthlyChars: monthlyCharsFormatted,
            decoPairs: config.deco_pairs || [],
            decoGroups: config.deco_groups || [],
        };

        contentFolder.file('database.json', JSON.stringify(dbJson, null, 2));

        // --- 3. DESCARGAR IMÁGENES ---
        const downloadPromises = Array.from(urlToLocalPath.entries()).map(async ([url, localPath]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return;
                const buffer = await response.arrayBuffer();
                zip.file(localPath, buffer, { binary: true });
            } catch (e) {
                console.error(`Failed to download image ${url}:`, e);
            }
        });
        await Promise.all(downloadPromises);

        // --- 4. ACTUALIZAR SUPABASE CON RUTAS LOCALES ---
        const updatePromises = [];
        if (workUpdates.length > 0) {
            updatePromises.push(supabase.from('works').upsert(workUpdates));
        }
        if (characterUpdates.length > 0) {
            characterUpdates.forEach(update => {
                updatePromises.push(supabase.from('characters').update({ cover: update.cover }).eq('id', update.id));
            });
        }
        if (favoriteSagaUpdates.length > 0) {
            favoriteSagaUpdates.forEach(update => {
                updatePromises.push(supabase.from('favorites').update({ cover: update.cover }).eq('title', update.title).eq('is_saga', true));
            });
        }
        if (monthlyPickUpdates.length > 0) {
            updatePromises.push(supabase.from('monthly_picks').upsert(monthlyPickUpdates));
        }
        if (monthlyCharUpdates.length > 0) {
            updatePromises.push(supabase.from('monthly_chars').upsert(monthlyCharUpdates));
        }

        const results = await Promise.allSettled(updatePromises);
        results.forEach(result => {
            if (result.status === 'rejected') {
                console.error("A Supabase update failed during sync:", result.reason);
            }
        });

        // --- 5. GENERAR Y DEVOLVER EL ZIP ---
        const zipContent = await zip.generateAsync({ type: "nodebuffer" });
        const backupDate = new Date().toISOString().split('T')[0];

        return new Response(zipContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="mi-anilist-backup-${backupDate}.zip"`,
            },
        });

    } catch (error) {
        console.error("Error creating sync package:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};