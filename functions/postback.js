export async function onRequest(context) {
  const { request, env } = context;

  // CEK APAKAH DATABASE SUDAH TERKONEKSI
  if (!env.ROWX_DB) {
    return new Response("DATABASE ERROR: Kamu belum setting KV Binding 'ROWX_DB' di dashboard Cloudflare!", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const click_id = url.searchParams.get('click_id') || "NO_ID";
    const oid = url.searchParams.get('oid') || "UNKNOWN";
    const payout = url.searchParams.get('payout') || "0";
    const country = url.searchParams.get('country') || "id";

    const newLead = {
      click_id, oid, 
      payout: parseFloat(payout), 
      country: country.toLowerCase(), 
      timestamp: Date.now()
    };

    // SIMPAN KE KV
    const historyRaw = await env.ROWX_DB.get('leads_history');
    let history = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift(newLead);
    if (history.length > 50) history = history.slice(0, 50);
    await env.ROWX_DB.put('leads_history', JSON.stringify(history));

    // KIRIM KE PUSHER (SAMA SEPERTI SEBELUMNYA)
    const body = JSON.stringify({ name: "new-lead", channels: ["my-channel"], data: JSON.stringify(newLead) });
    const pusherKey = "6bc0867b80098f3e3424";
    const pusherAppId = "1814631";
    const pusherSecret = "647f3b89b88229f63564";
    const pusherCluster = "ap1";

    const timestamp = Math.floor(Date.now() / 1000);
    const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
    const authQueryString = `auth_key=${pusherKey}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n/apps/${pusherAppId}/events\n${authQueryString}`;
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pusherSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign))
      .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));

    await fetch(`https://api-${pusherCluster}.pusher.com/apps/${pusherAppId}/events?${authQueryString}&auth_signature=${signature}`, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'application/json' }
    });

    return new Response('PHEI 2026 - SUCCESS', { status: 200 });
  } catch (err) {
    return new Response('PHEI ERROR: ' + err.message, { status: 500 });
  }
}
