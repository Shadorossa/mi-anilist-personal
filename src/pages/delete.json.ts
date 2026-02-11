import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { type, id } = await request.json();

        if (!type || !id) {
            return new Response(JSON.stringify({ error: "Missing type or id" }), { status: 400 });
        }

        if (id.includes('..') || id.includes('/')) {
            return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 });
        }

        const collectionName = type === 'game' ? 'games' : type;
        const filePath = path.resolve(`./src/content/${collectionName}/${id}`);

        await fs.unlink(filePath);

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error("Delete error:", error);
        if (error.code === 'ENOENT') {
            return new Response(JSON.stringify({ success: true, message: "File not found, assumed deleted." }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Failed to delete file." }), { status: 500 });
    }
};