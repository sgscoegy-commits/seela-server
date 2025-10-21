import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // إضافة node-fetch لإصلاح مشكلة fetch

const app = express();
app.use(cors());
app.use(express.json());

// ====== الإعداد ======
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WC_URL = `${process.env.WC_STORE_URL}/wp-json/wc/v3`;
const WC_KEY = process.env.WC_CONSUMER_KEY;
const WC_SECRET = process.env.WC_CONSUMER_SECRET;

// ====== جلب المنتجات ======
async function getProducts(query) {
  try {
    const res = await fetch(`${WC_URL}/products?search=${encodeURIComponent(query)}&per_page=5`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64"),
      },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("خطأ في جلب المنتجات:", err);
    return [];
  }
}

// ====== تحليل المقاسات ======
function suggestSize(category, weight, height) {
  const sizeChart = {
    men: [
      { size: "S", minW: 60, maxW: 75, minH: 160, maxH: 175 },
      { size: "M", minW: 75, maxW: 85, minH: 165, maxH: 180 },
      { size: "L", minW: 80, maxW: 95, minH: 170, maxH: 185 },
      { size: "XL", minW: 90, maxW: 105, minH: 175, maxH: 190 },
    ],
    women: [
      { size: "S", minW: 50, maxW: 60, minH: 145, maxH: 165 },
      { size: "M", minW: 60, maxW: 75, minH: 150, maxH: 170 },
      { size: "L", minW: 70, maxW: 85, minH: 155, maxH: 175 },
      { size: "XL", minW: 80, maxW: 95, minH: 160, maxH: 180 },
    ],
  };

  const list = sizeChart[category] || [];
  const match = list.find(
    (s) => weight >= s.minW && weight <= s.maxW && height >= s.minH && height <= s.maxH
  );
  return match ? match.size : "برجاء التأكد من الوزن والطول لتحديد المقاس بدقة 😊";
}

// ====== الرد الذكي من Gemini ======
async function chatWithGemini(message) {
  const prompt = `
    المستخدم قال: "${message}"
    رد بأسلوب مصري مهذب وودود، وحاول توضح لو تقدر تساعده في المقاسات أو المنتجات.
  `;
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "معلش ممكن توضحلي أكتر؟ 😊";
  } catch (err) {
    console.error("خطأ في الاتصال بـ Gemini:", err);
    return "فيه مشكلة بسيطة في الاتصال، جرب تاني بعد لحظات 💬";
  }
}

// ====== GET endpoint للـ testing من المتصفح ======
app.get("/api/sila", async (req, res) => {
  const { message, category, weight, height } = req.query; // جلب البيانات من query parameters

  // لو مفيش parameters، نرجع تعليمات
  if (!message && !category && !weight && !height) {
    return res.json({
      reply: "مرحبًا! استخدم الرابط بالشكل ده: /api/sila?message=تيشيرت أو /api/sila?category=men&weight=80&height=175 😊",
    });
  }

  // تحويل weight و height لأرقام
  const parsedWeight = parseFloat(weight);
  const parsedHeight = parseFloat(height);

  // لو في category و weight و height
  if (category && weight && height && !isNaN(parsedWeight) && !isNaN(parsedHeight)) {
    const suggestion = suggestSize(category, parsedWeight, parsedHeight);
    return res.json({ reply: `المقاس الأنسب ليك هو ${suggestion} 👗` });
  }

  // لو في message يحتوي على "شنطة" أو "تيشيرت"
  if (message && /شنطة|تيشيرت/i.test(message)) { // استخدام regex لتغطية صيغ مختلفة
    const products = await getProducts(message);
    if (products.length > 0) {
      const reply = products
        .map((p) => `🛍️ ${p.name} - ${p.price} ج.م [رابط المنتج](${p.permalink})`)
        .join("\n");
      return res.json({ reply });
    } else {
      return res.json({ reply: "معلش، مفيش منتجات مطابقة لـ '" + message + "' 😔" });
    }
  }

  // لو مفيش شروط مطابقة، نروح لـ Gemini
  if (message) {
    const reply = await chatWithGemini(message);
    return res.json({ reply });
  }

  // لو في بيانات ناقصة
  return res.json({ reply: "برجاء إدخال بيانات كاملة (message أو category/weight/height) 😊" });
});

// ====== POST endpoint (يبقى زي ما هو للـ frontend أو التطبيقات) ======
app.post("/api/sila", async (req, res) => {
  const { message, category, weight, height } = req.body;

  if (category && weight && height) {
    const suggestion = suggestSize(category, weight, height);
    return res.json({ reply: `المقاس الأنسب ليك هو ${suggestion} 👗` });
  }

  if (message?.toLowerCase().includes("شنطة") || message?.toLowerCase().includes("تيشيرت")) {
    const products = await getProducts(message);
    if (products.length > 0) {
      const reply = products
        .map((p) => `🛍️ ${p.name} - ${p.price} ج.م [رابط المنتج](${p.permalink})`)
        .join("\n");
      return res.json({ reply });
    }
  }

  const reply = await chatWithGemini(message);
  res.json({ reply });
});

// ====== Health check ======
app.get("/", (req, res) => res.send("سيلا شغالة ✅"));

export default app;
