import "server-only";

/** Aviso best-effort a Telegram -- si falla (token mal configurado, Telegram
 * caído), no tira abajo a quien la llama: el dato real ya se guardó donde
 * corresponda (ej. `reportes_bugs`), esto es solo la notificación. */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados -- no se mandó el aviso.");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error("Telegram respondió", res.status, await res.text());
    }
  } catch (err) {
    console.error("Error mandando notificación a Telegram", err);
  }
}
