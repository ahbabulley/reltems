export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const KV = context.env.LEADS_KV;

    const leadData = {
        click_id: searchParams.get('click_id') || 'n/a',
        payout: searchParams.get('payout') || '0',
        oid: searchParams.get('oid') || 'n/a',
        country: searchParams.get('country') || 'n/a',
        time: new Date().toLocaleTimeString()
    };

    // Simpan ke KV
    let history = await KV.get("history", { type: "json" }) || [];
    history.unshift(leadData);
    if (history.length > 50) history.pop();
    await KV.put("history", JSON.stringify(history));

    // Kirim ke Pusher
    const body = JSON.stringify({ name: "new-lead", channel: "my-channel", data: JSON.stringify(leadData) });
    const timestamp = Math.floor(Date.now() / 1000);
    const appId = "2102557";
    const key = "6bc0867b80098f3e3424";
    // Cloudflare akan mengirimkan ini ke Pusher API
    await fetch(`https://api-ap1.pusher.com/apps/${appId}/events?auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0`, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'application/json' }
    });

    return new Response("OK");
}
