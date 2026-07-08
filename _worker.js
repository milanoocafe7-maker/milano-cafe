// MILANO CAFE - Cloudflare Pages Worker
// Serves both the static site and the /api/menu endpoint via KV cache

const KV_KEY = 'menu_products';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // ─── Handle /api/menu ────────────────────────────────────
        if (url.pathname === '/api/menu') {

            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            };

            // Preflight
            if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
            }

            // GET - return cached menu
            if (request.method === 'GET') {
                try {
                    const cached = await env.MILANO_MENU_CACHE.get(KV_KEY);
                    if (cached) {
                        return new Response(cached, {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
                        });
                    }
                    // Cache is empty - return empty array (admin must publish first)
                    return new Response(JSON.stringify([]), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'EMPTY' }
                    });
                } catch (err) {
                    return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // POST - admin publishes menu, saves directly to KV
            if (request.method === 'POST') {
                try {
                    const bodyText = await request.text();
                    // Validate it's valid JSON
                    JSON.parse(bodyText);
                    await env.MILANO_MENU_CACHE.put(KV_KEY, bodyText, {
                        expirationTtl: 86400 // 24 hours
                    });
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (err) {
                    return new Response(JSON.stringify({ success: false, error: err.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        // ─── Serve static site (HTML, CSS, JS, images) ───────────
        return env.ASSETS.fetch(request);
    }
};
