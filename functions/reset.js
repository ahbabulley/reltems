export async function onRequest(context) {
  const { env } = context;
  
  if (env.ROWX_DB) {
    // Menghapus data riwayat klik dan lead
    await env.ROWX_DB.delete('click_history');
    await env.ROWX_DB.delete('leads_history');
    
    return new Response("Database Berhasil Dibersihkan!", { status: 200 });
  }
  
  return new Response("Error: KV tidak ditemukan", { status: 500 });
}
