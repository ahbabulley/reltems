export async function onRequest(context) {
  const { request, env } = context;
  if (!env.ROWX_DB) return new Response("Error: KV ROWX_DB Not Bound", { status: 500 });

  try {
    const url = new URL(request.url);
    const click_id = url.searchParams.get('click_id') || "NO_ID";
    const oid = url.searchParams.get('oid') || "UNKNOWN";
    const payout = url.searchParams.get('payout') || "0";
    const country = url.searchParams.get('country') || "id";

    const newLead = { click_id, oid, payout: parseFloat(payout), country: country.toLowerCase(), timestamp: Date.now() };

    // 1. Simpan ke KV
    const historyRaw = await env.ROWX_DB.get('leads_history');
    let history = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift(newLead);
    if (history.length > 50) history = history.slice(0, 50);
    await env.ROWX_DB.put('leads_history', JSON.stringify(history));

    // 2. Tembak Pusher (Sama persis namanya 'new-lead')
    const body = JSON.stringify({ name: "new-lead", channels: ["my-channel"], data: JSON.stringify(newLead) });
    const pKey = "6bc0867b80098f3e3424", pAppId = "1814631", pSecret = "647f3b89b88229f63564", pCluster = "ap1";
    const ts = Math.floor(Date.now() / 1000);
    const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
    const authQS = `auth_key=${pKey}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n/apps/${pAppId}/events\n${authQS}`;
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign)).then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

    await fetch(`https://api-${pCluster}.pusher.com/apps/${pAppId}/events?${authQS}&auth_signature=${signature}`, {
        method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }
    });

    return new Response('PHEI 2026 - LEAD RECORDED', { status: 200 });
  } catch (e) { return new Response(e.message, { status: 500 }); }
}
