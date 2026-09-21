// Logs structurés (une ligne JSON). Ne jamais y passer de clés API, de secrets de webhook
// ni de données de carte : uniquement des identifiants (orderId, stripeEventId…).

type Level = "info" | "warn" | "error";

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, message, ...fields, at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
