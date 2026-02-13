import type { APIRoute } from "astro";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { supabase } from "../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get("cover") as File;

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: "No file uploaded." }), {
                status: 400,
            });
        }

        const fileExtension = path.extname(file.name) || ".png";
        const fileName = `${randomUUID()}${fileExtension}`;
        const filePath = `sagas/${fileName}`; // Carpeta dentro del bucket

        const { data, error } = await supabase.storage
            .from('covers') // Nombre de tu bucket
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
        const publicPath = publicUrl;

        return new Response(JSON.stringify({ coverPath: publicPath }), { status: 200 });
    } catch (error) {
        console.error("Upload error:", error);
        return new Response(JSON.stringify({ error: "Failed to upload file." }), {
            status: 500,
        });
    }
};