// src/utils/rating.js

export function calculateRating(score) {
    if (!score || isNaN(score)) return 0;

    // Si la nota viene sobre 100 (ej: IGDB o RAWG a veces), la pasamos a base 10
    let base = 10;
    if (score > 10) base = 100;

    // Fórmula: (Nota / Base) * 5
    // Ejemplo: (9.5 / 10) * 5 = 4.75
    const raw = (score / base) * 5;

    // Redondear a 1 decimal
    return Math.round(raw * 10) / 10;
}