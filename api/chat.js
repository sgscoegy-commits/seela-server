import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// دالتك الخاصة بالمقاسات أو غيرها
function suggestSize(category, weight, height) {
  return "M"; // مجرد مثال بسيط
}

async function chatWithGemini(message) {
  return `👋 مرحبًا! استفسارك كان: ${message}`;
}

app.post("/api/chat", async (req, res) => {
  const { message, category, weight, height } = req.body || {};

  if (message?.includes("مقاس")) {
    const suggestion = suggestSize(category, weight, height);
    return res.json({ reply: `المقاس الأنسب ليك هو ${suggestion} 👗` });
  }

  const reply = await chatWithGemini(message);
  res.json({ reply });
});

app.get("/", (req, res) => res.send("سيلا شغالة ✅"));

// ✅ أهم سطر — التصدير بالطريقة اللي Vercel بيفهمها
export default app;
