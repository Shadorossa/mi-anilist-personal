import type { APIRoute } from 'astro';

// Spotify API Interfaces
interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface SpotifyArtist {
    name: string;
}

interface SpotifyImage {
    url: string;
    height: number;
    width: number;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artists: SpotifyArtist[];
    images: SpotifyImage[];
    release_date: string; // "YYYY-MM-DD"
}

interface SpotifySearchResponse {
    albums: {
        items: SpotifyAlbum[];
    };
}

export const GET: APIRoute = async ({ url }) => {
    const query = url.searchParams.get('q');
    if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter "q" is required.' }), { status: 400 });
    }

    const SPOTIFY_CLIENT_ID = import.meta.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = import.meta.env.SPOTIFY_CLIENT_SECRET;

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('Spotify API credentials are not set in environment variables.');
        return new Response(JSON.stringify({ error: 'Server configuration error: Spotify API credentials missing.' }), { status: 500 });
    }

    try {
        // Step 1: Get Spotify Access Token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) throw new Error(`Spotify auth failed with status ${tokenResponse.status}`);
        // Add more detailed error logging for auth failure
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(`Spotify auth failed with status ${tokenResponse.status}: ${errorText}`);
            throw new Error(`Spotify authentication failed.`);
        }

        const tokenData: SpotifyTokenResponse = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Step 2: Search for albums on Spotify
        const spotifySearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=20`;
        const searchResponse = await fetch(spotifySearchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.error(`Spotify search failed with status ${searchResponse.status} (${searchResponse.statusText}): ${errorText}`);
            throw new Error(`Spotify search failed.`);
        }

        const searchData: SpotifySearchResponse = await searchResponse.json();

        // Step 3: Map results to the expected format
        const results = searchData.albums.items.map(album => ({
            id: album.id,
            title: album.name,
            artist: album.artists.map(a => a.name).join(', '),
            cover: album.images[0]?.url || 'https://placehold.co/300x300/111/333?text=No+Cover',
            year: album.release_date ? album.release_date.substring(0, 4) : 'N/A',
            album: album.name,
        }));

        return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error in /api/search-songs:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};