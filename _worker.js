// MILANO CAFE - Cloudflare Worker API Layer
// Handles caching of the café menu via Cloudflare KV

export default {
    async fetch(request, env, ctx) {
        // Retrieve Firestore Project ID from environment variables or use a default
        const projectId = env.FIRESTORE_PROJECT_ID || "milano-cafe-menu";
        
        // CORS Headers for the premium API
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        };

        // Handle preflight OPTIONS requests
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        const url = new URL(request.url);

        // Routing for /api/menu
        if (url.pathname === "/api/menu") {
            // POST request to clear/regenerate cache (Admin Trigger)
            if (request.method === "POST") {
                try {
                    // Delete cached item in KV
                    if (env.MILANO_MENU_CACHE) {
                        await env.MILANO_MENU_CACHE.delete("menu_products");
                    }
                    
                    // Rebuild cache immediately
                    const freshProducts = await fetchLatestFromFirestore(projectId);
                    
                    if (env.MILANO_MENU_CACHE) {
                        await env.MILANO_MENU_CACHE.put("menu_products", JSON.stringify(freshProducts), {
                            expirationTtl: 86400 // Cache for 24 hours
                        });
                    }

                    return new Response(JSON.stringify({ success: true, message: "KV Cache cleared and regenerated successfully", count: freshProducts.length }), {
                        status: 200,
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                } catch (err) {
                    return new Response(JSON.stringify({ success: false, error: err.message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
            }

            // GET request to retrieve menu
            if (request.method === "GET") {
                try {
                    let cachedData = null;
                    
                    // Check KV namespace cache
                    if (env.MILANO_MENU_CACHE) {
                        cachedData = await env.MILANO_MENU_CACHE.get("menu_products");
                    }

                    if (cachedData) {
                        return new Response(cachedData, {
                            status: 200,
                            headers: { 
                                "Content-Type": "application/json", 
                                "X-Cache": "HIT",
                                ...corsHeaders 
                            }
                        });
                    }

                    // Cache missed: fetch latest from Firestore REST API
                    const products = await fetchLatestFromFirestore(projectId);

                    // Store in KV cache if it exists
                    if (env.MILANO_MENU_CACHE) {
                        await env.MILANO_MENU_CACHE.put("menu_products", JSON.stringify(products), {
                            expirationTtl: 86400 // Cache for 24 hours
                        });
                    }

                    return new Response(JSON.stringify(products), {
                        status: 200,
                        headers: { 
                            "Content-Type": "application/json", 
                            "X-Cache": "MISS",
                            ...corsHeaders 
                        }
                    });
                } catch (err) {
                    return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
            }
        }

        // 404 for other API endpoints
        if (url.pathname.startsWith('/api/')) {
            return new Response("Not Found", { status: 404, headers: corsHeaders });
        }

        // Serve the static frontend (HTML/CSS/JS)
        return env.ASSETS.fetch(request);
    }
};

// Helper: Query Firestore via standard REST API and sanitize the result
async function fetchLatestFromFirestore(projectId) {
    // REST endpoint to get all documents from the 'products' collection
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products`;
    
    const response = await fetch(firestoreUrl);
    if (!response.ok) {
        throw new Error(`Firestore REST API returned error status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.documents) {
        return [];
    }

    // Map and sanitize the response into flat, clean objects
    return data.documents.map(doc => {
        const id = doc.name.split("/").pop();
        const fields = doc.fields || {};
        const parsedFields = parseFirestoreFields(fields);
        return {
            id,
            ...parsedFields
        };
    });
}

// Convert Firestore REST format types (stringValue, integerValue, booleanValue, etc.) to standard JS types
function parseFirestoreFields(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields)) {
        if ("stringValue" in value) {
            result[key] = value.stringValue;
        } else if ("integerValue" in value) {
            result[key] = parseInt(value.integerValue, 10);
        } else if ("doubleValue" in value) {
            result[key] = parseFloat(value.doubleValue);
        } else if ("booleanValue" in value) {
            result[key] = value.booleanValue;
        } else if ("timestampValue" in value) {
            result[key] = value.timestampValue;
        } else {
            result[key] = value;
        }
    }
    return result;
}
