// File: functions/click.js

export async function onRequestGet(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    const click_id = searchParams.get('click_id') || 'GUEST-' + Math.floor(Math.random()*999);
    const country = searchParams.get('country') || 'ID';

    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    const secret = "46400c53058ed136c313";
    const timestamp = Math.floor(Date.now() / 1000);

    const dataObj = { click_id, country };
    const body = JSON.stringify({
      name: "new-click",
      channel: "my-channel",
      data: JSON.stringify(dataObj)
    });

    // 1. Hitung MD5 menggunakan Web Crypto API (Standard Cloudflare)
    const msgUint8 = new TextEncoder().encode(body);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const bodyMd5 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const path = `/apps/${appId}/events`;
    const query = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n${path}\n${query}`;

    // 2. Hitung HMAC SHA256 menggunakan Web Crypto API
    const encoder = new TextEncoder();
    const importKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", importKey, encoder.encode(stringToSign));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. Kirim ke Pusher
    const response = await fetch(`https://api-ap1.pusher.com${path}?${query}&auth_signature=${signature}`, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Pusher failed: ${response.status}`);

    return new Response("OK", { 
      headers: { "Access-Control-Allow-Origin": "*" } 
    });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
