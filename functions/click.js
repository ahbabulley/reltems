export async function onRequestGet(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    
    // Ambil data dari parameter URL atau gunakan default jika kosong
    const click_id = searchParams.get('click_id') || 'GUEST-' + Math.floor(Math.random()*999);
    const country = searchParams.get('country') || 'ID';

    // Konfigurasi Pusher
    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    const secret = "46400c53058ed136c313";
    const timestamp = Math.floor(Date.now() / 1000);

    const body = JSON.stringify({
      name: "new-click",
      channel: "my-channel",
      data: JSON.stringify({ click_id, country })
    });

    // Menggunakan node:crypto yang lebih stabil untuk Cloudflare
    const crypto = require('node:crypto');
    const path = `/apps/${appId}/events`;
    
    // 1. Hitung MD5 dari body
    const bodyMd5 = crypto.createHash('md5').update(body).digest('hex');
    
    // 2. Susun Query String
    const query = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    
    // 3. Buat Signature HMAC SHA256
    const stringToSign = `POST\n${path}\n${query}`;
    const signature = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');

    // 4. Kirim Request ke API Pusher
    const response = await fetch(`https://api-ap1.pusher.com${path}?${query}&auth_signature=${signature}`, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pusher error: ${response.status} - ${errorText}`);
    }

    return new Response("OK", { 
        status: 200,
        headers: { 
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
        } 
    });
    
  } catch (err) {
    // Jika terjadi error, tampilkan detailnya agar mudah diperbaiki
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
