// File: functions/get-clicks.js
export async function onRequest(context) {
  const history = await context.env.ROWX_DB.get('click_history');
  return new Response(history || "[]", {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
