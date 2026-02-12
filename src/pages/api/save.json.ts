export const prerender = false;
import fs from 'node:fs';
import path from 'node:path';

// Helper function to find an existing local image with flexible extension
function findLocalImage(baseDir: string, slug: string): string | null {
  const commonExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  for (const ext of commonExtensions) {
    const fullPath = path.join(baseDir, `${slug}${ext}`);
    if (fs.existsSync(fullPath)) {
      return `${slug}${ext}`;
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

export const POST = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json();

    // CASO A: Actualizar base de datos central (Favoritos / Picks / Personajes)
    if (body.dbData) {
      const dbPath = path.resolve('./src/content/database.json');
      let currentDB = { favorites: [], monthlyPicks: [], characters: [], monthlyChars: [], sagas: {} };
      if (fs.existsSync(dbPath)) {
        currentDB = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      }
      const { favorites, monthlyPicks, characters, monthlyChars, sagas } = body.dbData;

      let processedCharacters = currentDB.characters;
      if (characters) {
        const charaDir = path.resolve('./public/img/chara');
        if (!fs.existsSync(charaDir)) {
          fs.mkdirSync(charaDir, { recursive: true });
        }

        processedCharacters = await Promise.all(characters.map(async (char) => {
          if (char.cover && char.cover.startsWith('http')) {
            const slug = char.title.toLowerCase().replace(/[^a-z0-9\s-°'’]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

            const existingLocalFileName = findLocalImage(charaDir, slug);
            if (existingLocalFileName) {
              return { ...char, cover: `/img/chara/${existingLocalFileName}` };
            }

            // If no local file exists, download and save as PNG
            const newCoverFileName = `${slug}${DEFAULT_IMAGE_EXTENSION}`;
            const newLocalCoverPath = path.resolve(charaDir, newCoverFileName);
            const newPublicCoverPath = `/img/chara/${newCoverFileName}`;

            try {
              const imageResponse = await fetch(char.cover);
              if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                fs.writeFileSync(newLocalCoverPath, Buffer.from(imageBuffer));
                return { ...char, cover: newPublicCoverPath };
              }
            } catch (e) { console.error(`Failed to download cover for char ${char.title}:`, e); }
            // Fallback to original URL if download fails
            return char;
          }
          return char;
        }));
      }

      const newDB = {
        ...currentDB,
        favorites: favorites !== undefined ? favorites : currentDB.favorites,
        monthlyPicks: monthlyPicks !== undefined ? monthlyPicks : currentDB.monthlyPicks,
        characters: characters !== undefined ? processedCharacters : currentDB.characters,
        likedCharacters: body.dbData.likedCharacters !== undefined ? body.dbData.likedCharacters : currentDB.likedCharacters,
        interestedCharacters: body.dbData.interestedCharacters !== undefined ? body.dbData.interestedCharacters : currentDB.interestedCharacters,
        dislikedCharacters: body.dbData.dislikedCharacters !== undefined ? body.dbData.dislikedCharacters : currentDB.dislikedCharacters,
        monthlyChars: monthlyChars !== undefined ? monthlyChars : currentDB.monthlyChars,
        sagas: sagas !== undefined ? sagas : currentDB.sagas
      };

      fs.writeFileSync(dbPath, JSON.stringify(newDB, null, 2));
    }

    // CASO B: Guardar una obra individual (Game, Anime, Manga)
    if (body.fileData) {
      const { title, type, cover, year, status, score, startDate, finishDate, coverOffsetY } = body.fileData;

      if (!title || !type) {
        // Si solo se enviaron datos de la BD, no es un error.
        // Pero si se proporcionó fileData y está incompleto, sí lo es.
        if (!body.dbData) {
          return new Response(JSON.stringify({ error: "Faltan datos críticos para guardar el archivo" }), { status: 400 });
        }
      } else {
        let collectionFolder = type;
        if (type === 'game') collectionFolder = 'games';

        const slug = title.toLowerCase()
          .replace(/[^a-z0-9\s-°'’]/g, '') // Permitir ', °, ’ y guiones
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        const fileName = `${slug}.json`;
        const filePath = path.resolve(`./src/content/${collectionFolder}/${fileName}`);

        const coverDir = path.resolve('./public/img/covers');
        let finalCoverPath = cover;
        if (cover && cover.startsWith('http')) {
          if (!fs.existsSync(coverDir)) {
            fs.mkdirSync(coverDir, { recursive: true });
          }

          const existingLocalFileName = findLocalImage(coverDir, slug);
          if (existingLocalFileName) {
            finalCoverPath = `/img/covers/${existingLocalFileName}`;
          } else {
            // If no local file exists, download and save as PNG
            const newCoverFileName = `${slug}${DEFAULT_IMAGE_EXTENSION}`;
            const newLocalCoverPath = path.resolve(coverDir, newCoverFileName);
            const newPublicCoverPath = `/img/covers/${newCoverFileName}`;

            try {
              const imageResponse = await fetch(cover);
              if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                fs.writeFileSync(newLocalCoverPath, Buffer.from(imageBuffer));
                finalCoverPath = newPublicCoverPath;
              }
            } catch (e) {
              console.error(`Failed to download cover for ${title}:`, e);
            } // Fallback to original URL if download fails
          }
        }

        const mediaData = {
          title, cover: finalCoverPath, year,
          type: collectionFolder,
          status: status || 'Jugando',
          score: Number(score) || 0,
          startDate: startDate || '',
          finishDate: finishDate || '',
          coverOffsetY: coverOffsetY !== undefined ? Number(coverOffsetY) : 50
        };

        fs.writeFileSync(filePath, JSON.stringify(mediaData, null, 2));

        // --- Saga Automation ---
        const dbPathForSaga = path.resolve('./src/content/database.json');
        if (fs.existsSync(dbPathForSaga)) {
          try {
            const dbContent = fs.readFileSync(dbPathForSaga, 'utf-8');
            const fullDb = JSON.parse(dbContent);

            if (fullDb.sagas) {
              const newGameTitle = title;
              const getTitleNumber = (t: string): number | null => {
                // Matches an arabic number at the end of the string.
                let match = t.match(/\s(\d+)$/);
                if (match) return parseInt(match[1], 10);

                // Matches a roman numeral at the end of the string.
                match = t.match(/\s(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/i);
                if (match && match[1]) {
                  return romanToArabic(match[1]);
                }
                return null;
              };

              const newGameNumber = getTitleNumber(newGameTitle);

              if (newGameNumber !== null) { // Only run automation if the new game has a number.
                let sagaUpdated = false;
                for (const sagaName in fullDb.sagas) {
                  // Check if the game title starts with the saga name and is not already in the saga
                  if (newGameTitle.toLowerCase().startsWith(sagaName.toLowerCase()) && !fullDb.sagas[sagaName].includes(newGameTitle)) {

                    fullDb.sagas[sagaName].push(newGameTitle);

                    // Sort the saga list descending by number
                    fullDb.sagas[sagaName].sort((a: string, b: string) => {
                      const numA = getTitleNumber(a);
                      const numB = getTitleNumber(b);

                      if (numA !== null && numB !== null) return numB - numA;
                      if (numA !== null) return -1; // numbers before no-numbers
                      if (numB !== null) return 1;
                      return a.localeCompare(b); // alpha sort for non-numbered
                    });

                    sagaUpdated = true;
                    break; // Stop after finding the first matching saga
                  }
                }

                if (sagaUpdated) {
                  fs.writeFileSync(dbPathForSaga, JSON.stringify(fullDb, null, 2));
                }
              }
            }
          } catch (e) {
            console.error("Error during saga automation:", e);
          }
        }
      }
    }

    if (!body.dbData && !body.fileData) {
      return new Response(JSON.stringify({ error: "No se proporcionaron datos para guardar" }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (error) {
    console.error("Error en SAVE API:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}