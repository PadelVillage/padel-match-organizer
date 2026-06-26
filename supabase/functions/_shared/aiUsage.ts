// Logging consumo Gemini condiviso dalle edge AI (ai-parse, ai-reason, ai-propose-lexicon,
// ai-lex-examples). Scrive UNA riga in pmo_ai_usage con service_role (così copre anche le
// routine/cron, che non hanno un client). È best-effort: non deve MAI rompere la risposta.
//
// Tariffe Gemini 2.5 Flash (giu 2026): $0,30 / 1M token input, $2,50 / 1M token output.
// I token "thinking" (thoughtsTokenCount) contano come OUTPUT ai fini del costo.

const RATE_IN = 0.30 / 1_000_000;   // $/token input
const RATE_OUT = 2.50 / 1_000_000;  // $/token output (+ thinking)
// Riferimento progetto PROD (per taggare env nella riga). Tutto il resto è TEST. Non è un segreto:
// il project-ref è già pubblico (URL anon). Ogni progetto scrive sulla PROPRIA tabella pmo_ai_usage.
const PROD_REF = 'qqbfphyslczzkxoncgex';

type Usage = Record<string, unknown> | null | undefined;

export async function logAiUsage(functionName: string, usage: Usage, actorEmail = '', model = 'gemini-2.5-flash'): Promise<void> {
  try {
    if (!usage || typeof usage !== 'object') return;
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !svc) return;
    const u = usage as Record<string, unknown>;
    const prompt = Number(u.promptTokenCount) || 0;
    const output = Number(u.candidatesTokenCount) || 0;
    const thinking = Number(u.thoughtsTokenCount) || 0;
    const total = Number(u.totalTokenCount) || (prompt + output + thinking);
    const cost = prompt * RATE_IN + (output + thinking) * RATE_OUT;
    const env = url.includes(PROD_REF) ? 'prod' : 'test';
    await fetch(`${url}/rest/v1/pmo_ai_usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: svc, Authorization: `Bearer ${svc}`, Prefer: 'return=minimal' },
      body: JSON.stringify({
        env, function_name: functionName, model,
        prompt_tokens: prompt, output_tokens: output, thinking_tokens: thinking,
        total_tokens: total, est_cost_usd: cost, actor_email: actorEmail || null,
      }),
    });
  } catch (_e) { /* logging best-effort: mai bloccare la risposta */ }
}
