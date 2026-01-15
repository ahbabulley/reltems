// File: functions/click.js

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { searchParams } = new URL(context.request.url);
    const click_id = searchParams.get('click_id') || 'GUEST-' + Math.floor(Math.random()*999);
    const country = searchParams.get('country') || 'ID';
    const timestamp = Date.now();

    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    const secret = "46400c53058ed136c313";
    const pCluster = "ap1";
    const ts = Math.floor(timestamp / 1000);

    const dataObj = { click_id, country, timestamp };

    // --- LOGIKA SIMPAN KE KV (MAKSIMAL 5) ---
    if (env.ROWX_DB) {
      const historyRaw = await env.ROWX_DB.get('click_history');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      history.unshift(dataObj);
      if (history.length > 5) history = history.slice(0, 5);
      await env.ROWX_DB.put('click_history', JSON.stringify(history));
    }

    // --- PUSHER LOGIC ---
    const body = JSON.stringify({
      name: "new-click",
      channel: "my-channel",
      data: JSON.stringify(dataObj)
    });

    const msgUint8 = new TextEncoder().encode(body);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const bodyMd5 = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const path = `/apps/${appId}/events`;
    const query = `auth_key=${key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n${path}\n${query}`;

    const importKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuf = await crypto.subtle.sign("HMAC", importKey, new TextEncoder().encode(stringToSign));
    const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await fetch(`https://api-${pCluster}.pusher.com${path}?${query}&auth_signature=${signature}`, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/json' }
    });

    return new Response("OK", { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
