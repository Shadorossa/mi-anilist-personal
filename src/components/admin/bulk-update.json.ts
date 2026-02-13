import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { ids, updates } = body;

        if (!Array.isArray(ids) || !updates || typeof updates !== 'object') {
            return new Response(JSON.stringify({ error: "Datos no válidos." }), { status: 400 });
        }

        for (const id of ids) {
            const filePath = path.resolve(`./src/content/${id}`);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);

                const updatedData = { ...data, ...updates };

                if (updates.status && updates.status !== 'Completado') {
                    updatedData.score = 0;
                }

                fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error("Error en API de actualización masiva:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};