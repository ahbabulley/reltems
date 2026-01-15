export async function onRequest(context) {
  const { request, env } = context;

  // Izinkan semua method (GET/POST) karena tiap network beda-beda
  try {
    const url = new URL(request.url);
    
    // Ambil data dari parameter URL
    const click_id = url.searchParams.get('click_id') || "NO_CLICK_ID";
    const oid = url.searchParams.get('oid') || "UNKNOWN";
    const payout = url.searchParams.get('payout') || "0";
    const country = url.searchParams.get('country') || "id";

    const newLead = {
      click_id,
      oid,
      payout: parseFloat(payout),
      country: country.toLowerCase(),
      timestamp: Date.now()
    };

    // 1. SIMPAN KE KV (BIAR RELOAD ENGGAK HILANG)
    // Ambil data lama
    const historyRaw = await env.ROWX_DB.get('leads_history');
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // Tambah yang baru ke urutan pertama
    history.unshift(newLead);

    // Batasi 50 biar kenceng
    if (history.length > 50) history = history.slice(0, 50);

    // Save balik ke KV
    await env.ROWX_DB.put('leads_history', JSON.stringify(history));

    // 2. KIRIM KE PUSHER (BIAR LIVE MUNCUL & BUNYI)
    const pusherConfig = {
      appId: "1814631",
      key: "6bc0867b80098f3e3424",
      secret: "647f3b89b88229f63564",
      cluster: "ap1"
    };

    const body = JSON.stringify({
      name: "new-lead",
      channels: ["my-channel"],
      data: JSON.stringify(newLead)
    });

    const timestamp = Math.floor(Date.now() / 1000);
    
    // Auth Pusher Signature
    const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    const authQueryString = `auth_key=${pusherConfig.key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n/apps/${pusherConfig.appId}/events\n${authQueryString}`;
    
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pusherConfig.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign))
      .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));

    await fetch(
      `https://api-${pusherConfig.cluster}.pusher.com/apps/${pusherConfig.appId}/events?${authQueryString}&auth_signature=${signature}`,
      {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return new Response('PHEI 2026 - SUCCESS', { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" } 
    });

  } catch (err) {
    return new Response('PHEI ERROR: ' + err.message, { status: 500 });
  }
}
