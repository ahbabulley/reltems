export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    
    // Ambil data dari URL
    const click_id = searchParams.get('click_id') || 'ID-' + Math.floor(Math.random()*9999);
    const country = searchParams.get('country') || 'ID';

    // Data untuk dikirim ke Pusher
    const clickData = {
        click_id: click_id,
        country: country,
        type: 'CLICK'
    };

    // Konfigurasi Pusher (Sama dengan postback.js)
    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    const secret = "46400c53058ed136c313"; // Pastikan secret ini benar
    const timestamp = Math.floor(Date.now() / 1000);
    
    const body = JSON.stringify({
        name: "new-click",
        channel: "my-channel",
        data: JSON.stringify(clickData)
    });

    // Generate Signature Pusher (Wajib agar tidak ditolak Pusher)
    const { Buffer } = await import('node:buffer');
    const crypto = await import('node:crypto');
    const method = "POST";
    const path = `/apps/${appId}/events`;
    const query = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0`;
    const bodyMd5 = crypto.createHash('md5').update(body).digest('hex');
    const signData = [method, path, query + `&body_md5=${bodyMd5}`].join('\n');
    const signature = crypto.createHmac('sha256', secret).update(signData).digest('hex');

    // Kirim ke Pusher
    await fetch(`https://api-ap1.pusher.com${path}?${query}&body_md5=${bodyMd5}&auth_signature=${signature}`, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'application/json' }
    });

    return new Response("CLICK_LOGGED", { 
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" } 
    });
}
