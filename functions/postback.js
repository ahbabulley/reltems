export async function onRequest(context) {
    const { request, env } = context;
    
    // 1. CEK BINDING KV (WAJIB!)
    if (!env.ROWX_DB) {
        return new Response("ERROR: KV 'ROWX_DB' belum di-bind di Dashboard Cloudflare!", { status: 500 });
    }

    try {
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || "LEAD").toUpperCase();
        const now = Date.now();
        
        // --- LOGIKA RESET JAM 7 PAGI ---
        const lastReset = await env.ROWX_DB.get('last_reset_ts') || 0;
        const resetTime = new Date().setHours(7, 0, 0, 0);
        
        if (now >= resetTime && lastReset < resetTime) {
            await env.ROWX_DB.put('all_traffic', "[]");
            await env.ROWX_DB.put('last_reset_ts', now.toString());
        }

        // --- AMBIL DATA DARI URL ---
        const entry = {
            type: type,
            click_id: url.searchParams.get('click_id') || `CID-${Math.floor(now / 1000)}`,
            oid: url.searchParams.get('oid') || "STRANGER",
            payout: parseFloat(url.searchParams.get('payout') || "0"),
            country: (url.searchParams.get('country') || "id").toLowerCase(),
            timestamp: now
        };

        // --- UPDATE DATABASE KV ---
        let history = [];
        try {
            const cached = await env.ROWX_DB.get('all_traffic');
            history = cached ? JSON.parse(cached) : [];
        } catch (e) { history = []; }

        history.unshift(entry);

        // Filter 24 Jam
        const limit24h = now - (24 * 60 * 60 * 1000);
        history = history.filter(item => item.timestamp > limit24h);
        
        // Simpan max 100 data biar KV gak bengkak
        if (history.length > 100) history = history.slice(0, 100);

        await env.ROWX_DB.put('all_traffic', JSON.stringify(history));

        // --- KIRIM KE PUSHER (LIVE DASHBOARD) ---
        const pusherConfig = {
            appId: "1814631",
            key: "6bc0867b80098f3e3424",
            secret: "647f3b89b88229f63564",
            cluster: "ap1"
        };

        const channel = "my-channel";
        const event = type === 'LEAD' ? "new-lead" : "new-click";
        const body = JSON.stringify({ 
            name: event, 
            channels: [channel], 
            data: JSON.stringify(entry) 
        });

        const authTimestamp = Math.floor(now / 1000);
        const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body))
            .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));

        const authQueryString = `auth_key=${pusherConfig.key}&auth_timestamp=${authTimestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
        const stringToSign = `POST\n/apps/${pusherConfig.appId}/events\n${authQueryString}`;

        const hmacKey = await crypto.subtle.importKey(
            'raw', 
            new TextEncoder().encode(pusherConfig.secret), 
            { name: 'HMAC', hash: 'SHA-256' }, 
            false, 
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign))
            .then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

        const pusherUrl = `https://api-${pusherConfig.cluster}.pusher.com/apps/${pusherConfig.appId}/events?${authQueryString}&auth_signature=${signature}`;

        await fetch(pusherUrl, {
            method: 'POST',
            body: body,
            headers: { 'Content-Type': 'application/json' }
        });

        return new Response('PB_OK', { status: 200 });

    } catch (err) {
        return new Response(`ERROR: ${err.message}`, { status: 500 });
    }
}
