/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            gridTemplateColumns: {
                '14': 'repeat(14, minmax(0, 1fr))',
                '15': 'repeat(15, minmax(0, 1fr))',
                '18': 'repeat(18, minmax(0, 1fr))',
                '20': 'repeat(20, minmax(0, 1fr))',
                '25': 'repeat(25, minmax(0, 1fr))',
            }
        },
    },
    plugins: [],
}