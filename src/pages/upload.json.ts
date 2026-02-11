import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get("cover") as File;

        if (!file) {
            return new Response(JSON.stringify({ error: "No file uploaded." }), {
                status: 400,
            });
        }

        const buffer = await file.arrayBuffer();
        const fileExtension = path.extname(file.name) || ".png";
        const fileName = `${randomUUID()}${fileExtension}`;

        const saveDir = path.resolve("./public/img/sagas");

        await fs.mkdir(saveDir, { recursive: true });

        const savePath = path.join(saveDir, fileName);

        await fs.writeFile(savePath, Buffer.from(buffer));

        const publicPath = `/img/sagas/${fileName}`;

        return new Response(JSON.stringify({ coverPath: publicPath }), { status: 200 });
    } catch (error) {
        console.error("Upload error:", error);
        return new Response(JSON.stringify({ error: "Failed to upload file." }), {
            status: 500,
        });
    }
};