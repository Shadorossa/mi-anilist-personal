import { defineCollection, z } from 'astro:content';

// Definimos que CADA juego debe tener obligatoriamente estos datos
const gamesCollection = defineCollection({
    type: 'data', // Usamos JSON, no Markdown largo
    schema: z.object({
        title: z.string(),
        cover: z.string().url(), // Debe ser una URL de imagen
        status: z.enum(['Jugando', 'Completado', 'Abandonado', 'Pendiente']),
        score: z.number().min(0).max(10),
        platform: z.string().optional(),
        review: z.string().optional(), // Una mini opinión opcional
    }),
});

export const collections = {
    'games': gamesCollection,
    // Aquí podrías añadir 'anime', 'movies', etc.
};