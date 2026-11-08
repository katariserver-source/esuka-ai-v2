const ALLOWED_ORIGINS = ["*"];
const GROQ_MODEL = "openai/gpt-oss-20b";
const GEMINI_MODEL = "gemini-3.8-flash";
const DEEPSEEK_MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const SYSTEM_PROMPT = "You are ESUKA AI 2.0, a smart and premium personal assistant created by Katari.";

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });
}

async function generateGroq(message, env) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_API_KEY },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: message }] })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response from Groq.";
}

async function generateGemini(message, env) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: message }] }] })
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
}

async function generateDeepseek(message, env) {
  const response = await env.AI.run(DEEPSEEK_MODEL, {
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: message }]
  });
  return response.response || "No response from DeepSeek.";
}

async function generateImage(prompt, env) {
  const result = await env.AI.run(IMAGE_MODEL, { prompt, steps: 8 });
  const buffer = await new Response(result).arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:image/png;base64," + btoa(binary);
}

export default {
  async fetch(request, env) {
    const cors = getCorsHeaders(request.headers.get("Origin") || "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const mode = body.mode || "chat";
        const message = body.message || "";
        const selectedModel = body.model || "groq";

        if (mode === "image") {
          const imgData = await generateImage(message, env);
          return json({ success: true, image: imgData }, 200, cors);
        }

        let reply = "";
        if (selectedModel === "gemini") reply = await generateGemini(message, env);
        else if (selectedModel === "deepseek") reply = await generateDeepseek(message, env);
        else reply = await generateGroq(message, env);

        return json({ success: true, reply }, 200, cors);
      } catch (err) {
        return json({ success: false, error: err.message }, 500, cors);
      }
    }
    return json({ status: "ESUKA AI 2.0 Active" }, 200, cors);
  }
};
