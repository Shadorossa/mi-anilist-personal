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

        // --- ESTOS SON LOS IMPORTANTES ---
        favorite: z.boolean().optional(),
        favIndex: z.number().optional(),
        monthlyPicks: z.array(z.string()).optional() // Array de fechas "YYYY-MM"
    }),
});

export const collections = {
    'games': mediaCollection,
    'anime': mediaCollection,
    'manga': mediaCollection,
};