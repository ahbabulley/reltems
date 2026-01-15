// File: functions/postback.js

export async function onRequestGet(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    
    // Ambil data yang dikirim oleh Network Iklan
    const click_id = searchParams.get('click_id');
    const oid = searchParams.get('oid') || 'UNKNOWN';
    const payout = searchParams.get('payout') || '0.00';
    const country = searchParams.get('country') || 'ID';

    if (!click_id) {
      return new Response("Missing click_id", { status: 400 });
    }

    // 1. Simpan ke Cloudflare KV (Database History)
    // Pastikan kamu sudah bind KV namespace dengan nama 'DB'
    const timestamp = Date.now();
    const leadData = { click_id, oid, payout, country, timestamp };
    
    if (context.env.DB) {
      await context.env.DB.put(`lead:${timestamp}`, JSON.stringify(leadData));
    }

    // 2. Konfigurasi Pusher (Kirim ke Dashboard)
    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    const secret = "46400c53058ed136c313";
    const authTimestamp = Math.floor(Date.now() / 1000);

    const body = JSON.stringify({
      name: "new-lead",
      channel: "my-channel",
      data: JSON.stringify(leadData)
    });

    // --- Logika Signature (Sama dengan click.js agar kompatibel) ---
    const msgUint8 = new TextEncoder().encode(body);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const bodyMd5 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const path = `/apps/${appId}/events`;
    const query = `auth_key=${key}&auth_timestamp=${authTimestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n${path}\n${query}`;

    const encoder = new TextEncoder();
    const importKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", importKey, encoder.encode(stringToSign));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. Eksekusi Kirim ke Pusher
    const pusherRes = await fetch(`https://api-ap1.pusher.com${path}?${query}&auth_signature=${signature}`, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/json' }
    });

    if (!pusherRes.ok) throw new Error("Pusher Broadcast Failed");

    return new Response("Postback Success", { 
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" } 
    });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
