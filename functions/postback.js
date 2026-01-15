export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. Ambil data dari URL (Postback URL biasanya pake Query Params)
    const url = new URL(request.url);
    const click_id = url.searchParams.get('click_id');
    const oid = url.searchParams.get('oid') || 'UNKNOWN'; // Team/ID
    const payout = url.searchParams.get('payout') || '0';
    const country = url.searchParams.get('country') || 'ID';

    if (!click_id) {
      return new Response('Missing click_id', { status: 400 });
    }

    const newLead = {
      click_id,
      oid,
      payout: parseFloat(payout),
      country: country.toLowerCase(),
      timestamp: Date.now()
    };

    // 2. Simpan ke Cloudflare KV (Biar direload data nggak hilang)
    // Ambil history lama dulu
    const historyRaw = await env.ROWX_DB.get('leads_history');
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // Tambah data baru ke urutan paling atas
    history.push(newLead);

    // Batasi histori maksimal 50 data biar KV nggak bengkak
    if (history.length > 50) {
      history = history.slice(-50);
    }

    // Simpan balik ke KV
    await env.ROWX_DB.put('leads_history', JSON.stringify(history));

    // 3. Kirim sinyal Real-time ke Pusher
    const pusherData = {
      appId: "1814631",
      key: "6bc0867b80098f3e3424",
      secret: "647f3b89b88229f63564", // JANGAN SEBARKAN SECRET INI
      cluster: "ap1",
    };

    // Fungsi helper untuk auth Pusher manual di Workers
    const body = JSON.stringify({
      name: "new-lead",
      channels: ["my-channel"],
      data: JSON.stringify(newLead)
    });

    const fetchPusher = await fetch(
      `https://api-${pusherData.cluster}.pusher.com/apps/${pusherData.appId}/events?auth_key=${pusherData.key}&auth_timestamp=${Math.floor(Date.now() / 1000)}&auth_version=1.0&body_md5=${await md5(body)}&auth_signature=${await sign(body, pusherData)}`,
      {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return new Response('Postback Received & Saved', { status: 200 });

  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 });
  }
}

// Helper functions untuk security Pusher (HMAC-SHA256)
async function md5(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sign(body, config) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyMd5 = await md5(body);
  const authQueryString = `auth_key=${config.key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
  const stringToSign = `POST\n/apps/${config.appId}/events\n${authQueryString}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}
