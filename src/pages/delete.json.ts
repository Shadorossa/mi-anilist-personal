import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { type, id } = await request.json();

        if (!id) {
            return new Response(JSON.stringify({ error: "Missing type or id" }), { status: 400 });
        }

        const { error } = await supabase.from('works').delete().eq('id', id);

        if (error) {
            throw error;
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error("Delete error:", error);
        return new Response(JSON.stringify({ error: "Failed to delete file." }), { status: 500 });
    }
};