export function handler(): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ ok: true }),
  };
}
