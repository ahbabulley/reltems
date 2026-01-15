export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || "LEAD"; // Deteksi LEAD/CLICK
    const data = {
      type: type.toUpperCase(),
      click_id: url.searchParams.get('click_id') || "N/A",
      oid: url.searchParams.get('oid') || "USER",
      payout: parseFloat(url.searchParams.get('payout') || "0"),
      country: (url.searchParams.get('country') || "id").toLowerCase(),
      timestamp: Date.now()
    };

    // Simpan ke KV (Gabungan)
    let history = JSON.parse(await env.ROWX_DB.get('all_traffic') || "[]");
    history.unshift(data);
    if (history.length > 100) history = history.slice(0, 100);
    await env.ROWX_DB.put('all_traffic', JSON.stringify(history));

    // Pusher Broadcast
    const pKey = "6bc0867b80098f3e3424", pAppId = "1814631", pSecret = "647f3b89b88229f63564", pCluster = "ap1";
    const body = JSON.stringify({ name: type === 'LEAD' ? "new-lead" : "new-click", channels: ["my-channel"], data: JSON.stringify(data) });
    const ts = Math.floor(Date.now() / 1000);
    const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
    const authQS = `auth_key=${pKey}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n/apps/${pAppId}/events\n${authQS}`;
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign)).then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

    await fetch(`https://api-${pCluster}.pusher.com/apps/${pAppId}/events?${authQS}&auth_signature=${signature}`, {
        method: 'POST', body, headers: { 'Content-Type': 'application/json' }
    });

    return new Response('OK');
  } catch (e) { return new Response(e.message, { status: 500 }); }
}
