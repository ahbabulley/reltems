export async function onRequest(context) {
    const { request, env } = context;
    if (!env.ROWX_DB) return new Response("KV_MISSING", { status: 500 });

    try {
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || "LEAD").toUpperCase();
        const now = Date.now();
        
        // Payout cleaner
        let p = url.searchParams.get('payout') || "0";
        let payout = parseFloat(p.replace(/[^0-9.]/g, '')) || 0;

        const entry = {
            type: type,
            click_id: url.searchParams.get('click_id') || `CID-${now}`,
            oid: url.searchParams.get('oid') || "USER",
            payout: payout,
            country: (url.searchParams.get('country') || "id").toLowerCase(),
            timestamp: now
        };

        // Simpan ke KV
        let history = JSON.parse(await env.ROWX_DB.get('all_traffic') || "[]");
        history.unshift(entry);
        
        // Filter 24 Jam & Limit 100
        const limit24h = now - (24 * 60 * 60 * 1000);
        history = history.filter(item => item.timestamp > limit24h).slice(0, 100);
        await env.ROWX_DB.put('all_traffic', JSON.stringify(history));

        // Kirim ke Pusher
        const pKey = "6bc0867b80098f3e3424", pAppId = "1814631", pSecret = "647f3b89b88229f63564";
        const body = JSON.stringify({ name: "new-data", channels: ["my-channel"], data: JSON.stringify(entry) });
        const ts = Math.floor(now / 1000);
        const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
        const authQS = `auth_key=${pKey}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`;
        const stringToSign = `POST\n/apps/${pAppId}/events\n${authQS}`;
        const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign)).then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

        await fetch(`https://api-ap1.pusher.com/apps/${pAppId}/events?${authQS}&auth_signature=${signature}`, {
            method: 'POST', body, headers: { 'Content-Type': 'application/json' }
        });

        return new Response('PB_OK');
    } catch (e) { return new Response(e.message, { status: 500 }); }
}
