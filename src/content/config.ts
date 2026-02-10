// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const mediaCollection = defineCollection({
    type: 'data',
    schema: z.object({
        title: z.string(),
        cover: z.string(),
        status: z.enum(['Jugando', 'Completado', 'Pendiente', 'Abandonado', 'Pausado']),
        score: z.number(),
        year: z.union([z.string(), z.number()]).optional(),
        id: z.number().optional(),
        type: z.string().optional(),

        // --- NUEVOS CAMPOS ---
        favorite: z.boolean().optional(), // ¿Es favorito?
        favIndex: z.number().optional()   // ¿En qué posición está? (1, 2, 3...)
    }),
});

export const collections = {
    'games': mediaCollection,
    'anime': mediaCollection,
    'manga': mediaCollection,
};