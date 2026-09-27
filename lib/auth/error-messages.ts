/** Traduce un mensaje de error crudo de Supabase (inglés, técnico) al texto
 * en español que se muestra en las pantallas de auth. Supabase no expone un
 * código estable para todos estos casos, así que se matchea por substring del
 * mensaje. Lo desconocido cae en un fallback genérico: nunca mostrar el
 * crudo al usuario. */
export function authErrorMessage(rawMessage: string): string {
  const raw = rawMessage.toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos";
  }
  if (raw.includes("email not confirmed")) {
    return "Confirmá tu cuenta desde el mail que te enviamos";
  }
  if (raw.includes("rate limit")) {
    return "Demasiados intentos, esperá un momento y volvé a intentar";
  }
  if (raw.includes("banned")) {
    return "Esta cuenta fue desactivada";
  }
  return "Ocurrió un error, intentá de nuevo";
}
