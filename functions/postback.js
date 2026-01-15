export async function onRequest(context) {
    const { request, env } = context;
    
    if (!env.ROWX_DB) {
        return new Response("ERROR: KV 'ROWX_DB' belum di-bind!", { status: 500 });
    }

    try {
        const url = new URL(request.url);
        
        // Ambil data dari parameter URL
        const rawType = url.searchParams.get('type') || "LEAD";
        const type = rawType.toUpperCase();
        const now = Date.now();
        
        // --- LOGIKA PAYOUT (Biang kerok biasanya di sini) ---
        let rawPayout = url.searchParams.get('payout');
        let payout = 0;
        if (rawPayout) {
            // Bersihkan karakter non-angka kecuali titik
            payout = parseFloat(rawPayout.replace(/[^0-9.]/g, '')) || 0;
        }

        const entry = {
            type: type,
            click_id: url.searchParams.get('click_id') || `CID-${Math.floor(now / 1000)}`,
            oid: url.searchParams.get('oid') || "STRANGER",
            payout: payout,
            country: (url.searchParams.get('country') || "id").toLowerCase(),
            timestamp: now
        };

        // --- SIMPAN KE KV ---
        let history = [];
        const cached = await env.ROWX_DB.get('all_traffic');
        if (cached) {
            try { history = JSON.parse(cached); } catch(e) { history = []; }
        }

        history.unshift(entry);
        
        // Filter 24 Jam & Limit 100 data
        const limit24h = now - (24 * 60 * 60 * 1000);
        history = history.filter(item => item.timestamp > limit24h).slice(0, 100);

        await env.ROWX_DB.put('all_traffic', JSON.stringify(history));

        // --- KIRIM KE PUSHER ---
        const pKey = "6bc0867b80098f3e3424", pAppId = "1814631", pSecret = "647f3b89b88229f63564", pCluster = "ap1";
        
        // Pastikan event name sesuai dengan yang di-listen di index.html
        const eventName = (type === 'LEAD') ? "new-lead" : "new-click";
        
        const body = JSON.stringify({ 
            name: eventName, 
            channels: ["my-channel"], 
            data: JSON.stringify(entry) 
        });

        const authTimestamp = Math.floor(now / 1000);
        const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body))
            .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));

        const authQueryString = `auth_key=${pKey}&auth_timestamp=${authTimestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
        const stringToSign = `POST\n/apps/${pAppId}/events\n${authQueryString}`;
        const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign))
            .then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

        await fetch(`https://api-${pCluster}.pusher.com/apps/${pAppId}/events?${authQueryString}&auth_signature=${signature}`, {
            method: 'POST', body, headers: { 'Content-Type': 'application/json' }
        });

        return new Response('PB_OK');

    } catch (err) {
        return new Response(`ERROR: ${err.message}`, { status: 500 });
    }
}
