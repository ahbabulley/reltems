export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const KV = context.env.LEADS_KV; // Ini harus di-binding di dashboard Cloudflare

    const leadData = {
        click_id: searchParams.get('click_id') || 'n/a',
        payout: searchParams.get('payout') || '0',
        oid: searchParams.get('oid') || 'n/a',
        country: searchParams.get('country') || 'n/a'
    };

    // SIMPAN KE KV (Database Gratis Cloudflare)
    let history = await KV.get("history", { type: "json" }) || [];
    history.unshift(leadData);
    if (history.length > 50) history.pop();
    await KV.put("history", JSON.stringify(history));

    // KIRIM KE PUSHER (Simpel Mode)
    // Untuk postback cepat, kita panggil API Pusher
    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    // ... (Logika fetch ke Pusher seperti kode sebelumnya) ...
    // Note: Pastikan kode signature Pusher yang lengkap ada di sini

    return new Response("OK");
}