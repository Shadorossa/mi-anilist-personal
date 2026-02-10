// src/content/config.ts
import { defineCollection, z } from 'astro:content';

// Definimos el esquema básico para todo (Juegos, Anime, Manga)
const mediaCollection = defineCollection({
    type: 'data', // Son archivos JSON
    schema: z.object({
        title: z.string(),
        cover: z.string(),
        status: z.enum(['Jugando', 'Completado', 'Pendiente', 'Abandonado']),
        score: z.number(),
        year: z.union([z.string(), z.number()]).optional(), // Acepta texto o numero
        id: z.number().optional(),
        type: z.string().optional() // Para saber si es game/anime
    }),
});

// Exportamos las colecciones
export const collections = {
    'games': mediaCollection,
    'anime': mediaCollection,
    'manga': mediaCollection,
};