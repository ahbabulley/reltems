export async function onRequestGet(context) {
    const history = await context.env.LEADS_KV.get("history");
    return new Response(history || "[]", {
        headers: { "Content-Type": "application/json" }
    });
}