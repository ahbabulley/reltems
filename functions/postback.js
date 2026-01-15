export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || "LEAD").toUpperCase();
    const now = Date.now();
    
    // Logika Reset Jam 7 Pagi
    const lastReset = await env.ROWX_DB.get('last_reset_ts') || 0;
    const today7AM = new Date().setHours(7, 0, 0, 0);
    if (now > today7AM && lastReset < today7AM) {
      await env.ROWX_DB.put('all_traffic', "[]");
      await env.ROWX_DB.put('last_reset_ts', now.toString());
    }

    const entry = {
      type,
      click_id: url.searchParams.get('click_id') || "CID-" + Math.floor(Math.random() * 1000),
      oid: url.searchParams.get('oid') || "USER",
      payout: parseFloat(url.searchParams.get('payout') || "0"),
      country: (url.searchParams.get('country') || "id").toLowerCase(),
      timestamp: now
    };

    let history = JSON.parse(await env.ROWX_DB.get('all_traffic') || "[]");
    
    // Tambah data baru
    history.unshift(entry);

    // FILTER 24 JAM: Hapus data yang umurnya > 24 jam
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    history = history.filter(item => item.timestamp > twentyFourHoursAgo);

    await env.ROWX_DB.put('all_traffic', JSON.stringify(history));

    // Pusher Auth & Trigger (Sama seperti sebelumnya)
    const pKey = "6bc0867b80098f3e3424", pAppId = "1814631", pSecret = "647f3b89b88229f63564", pCluster = "ap1";
    const body = JSON.stringify({ name: type === 'LEAD' ? "new-lead" : "new-click", channels: ["my-channel"], data: JSON.stringify(entry) });
    const ts = Math.floor(now / 1000);
    const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(body)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
    const authQS = `auth_key=${pKey}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n/apps/${pAppId}/events\n${authQS}`;
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(stringToSign)).then(s => Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join(''));

    await fetch(`https://api-${pCluster}.pusher.com/apps/${pAppId}/events?${authQS}&auth_signature=${signature}`, {
        method: 'POST', body, headers: { 'Content-Type': 'application/json' }
    });

    return new Response('SUCCESS');
  } catch (e) { return new Response(e.message, { status: 500 }); }
}
