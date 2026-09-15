// Per the product spec (§31, §33), Teacher AI uses the user's own Groq API
// key. Codrive never holds a shared key.
//
// Preferred path: the browser calls Groq directly with the key held
// client-side. This service is the fallback for when a server-side proxy is
// genuinely needed (attaching server-known context, or working around CORS).
//
// Stays stateless per request: the key arrives in a header on THIS request
// only, is used for exactly one outbound call, and is never persisted to the
// User document, logged, or included in error-tracking payloads. Do not add
// request-logging middleware to whatever route calls this without an
// explicit body-scrubber for the apiKey field first.

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

interface TeacherChatContext {
  conceptTitle?: string;
  problemTitle?: string;
  currentCode?: string;
  /** e.g. "javascript", "python" — lets the mentor answer in the learner's current language */
  language?: string;
}

interface TeacherChatRequest {
  apiKey: string; // received per-request only, never stored
  context: TeacherChatContext;
  message: string;
  /** Optional prior turns so the mentor has conversational memory within one session. Never persisted server-side. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface TeacherChatResult {
  reply: string;
}

// Encodes the mentor rules from product spec §33 directly into the system
// prompt, rather than leaving "be a good tutor" to chance:
//   1. Prefer explanations over direct answers
//   2. Ask the learner to reason when appropriate
//   3. Give hints progressively, not the whole solution at once
//   4. Explain errors clearly
//   5. Avoid unnecessary verbosity
//   6. Use the learner's current language
//   7. Explain unfamiliar terminology
//   8. Never shame incorrect answers
//   9. When the user asks for the solution, provide it
//  10. When practicing, encourage attempting the problem first
function buildSystemPrompt(context: TeacherChatContext): string {
  const lines = [
    "You are Teacher, a programming mentor inside Codrive, a developer revision and practice platform.",
    "Behave like a good human mentor, not a solutions vending machine:",
    "- Prefer explaining reasoning over handing over direct answers.",
    "- When it helps the learner think, ask a guiding question instead of answering outright.",
    "- If you're giving hints, give ONE at a time, ordered from a nudge toward the general idea to something closer to the specific mechanism — never dump every hint in one reply.",
    "- Explain compiler/runtime errors in plain language: what triggered it and where to look, not just what it means.",
    "- Be concise. Skip preamble and restating the question back to the learner.",
    "- Never shame or scold an incorrect attempt — stay encouraging and matter-of-fact.",
    "- Explain unfamiliar terminology the first time you use it.",
    "- If the learner explicitly asks for the answer or solution, give it directly along with a short explanation of why it works — don't withhold it once asked.",
    "- If the learner hasn't asked for the answer yet and appears to be actively practicing, encourage them to attempt it first rather than volunteering the solution unprompted.",
  ];

  if (context.language) lines.push(`The learner is currently working in ${context.language}.`);
  if (context.conceptTitle) lines.push(`They are viewing the concept: "${context.conceptTitle}".`);
  if (context.problemTitle) lines.push(`They are working on the problem: "${context.problemTitle}".`);
  if (context.currentCode) {
    lines.push(
      "Here is their current code — use it to ground your answer, but do not repeat it back verbatim unless asked:\n```\n" +
        context.currentCode +
        "\n```"
    );
  }

  return lines.join("\n");
}

export async function proxyTeacherChat(req: TeacherChatRequest): Promise<TeacherChatResult> {
  if (!req.apiKey) {
    throw new Error("Missing Groq API key.");
  }

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(req.context) },
    ...(req.history ?? []),
    { role: "user" as const, content: req.message },
  ];

  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The key is used for this one outbound call and never touches disk,
        // a log line, or a database document anywhere in this function.
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      }),
    });
  } catch (err) {
    // Network-level failure — never include the key or raw error internals
    // in what gets thrown, since this can bubble up to a response body.
    throw new Error("Couldn't reach Groq. Check your network connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Groq rejected that API key. Check it in AI Teacher settings and try again.");
    }
    if (response.status === 429) {
      throw new Error("Groq rate-limited this request. Wait a moment and try again.");
    }
    throw new Error(`Groq request failed (status ${response.status}). Please try again.`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Groq returned an empty response. Please try again.");
  }

  return { reply };
}
