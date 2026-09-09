// app/api/insights/route.ts
import { generateText } from "ai"
import { google } from "@ai-sdk/google" // npm i @ai-sdk/google
import { z } from "zod"
import { type InsightSpec, specToPrompt } from "@/lib/insights"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// ---- Validate input thay vì ép kiểu thẳng ----
const insightSpecSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  labels: z.array(z.string()).min(1),
  volume: z.array(z.number()).optional(),
  volumeLabel: z.string().optional(),
  volumeUnit: z.enum(["number", "currency"]).optional(),
  rate: z.array(z.number()).optional(),
  rateLabel: z.string().optional(),
  isTimeSeries: z.boolean().optional(),
})

// ---- Cache in-memory đơn giản theo hash của spec (giảm gọi API trùng lặp) ----
// Lưu ý: chỉ hiệu quả trong 1 lambda instance, không phải cache phân tán.
// Nếu cần cache thật (nhiều instance/serverless), chuyển sang Vercel KV / Upstash Redis.
const cache = new Map<string, { text: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 phút — đủ để tránh spam re-render nhưng vẫn "tươi"

function hashSpec(spec: InsightSpec) {
  return JSON.stringify(spec)
}

export async function POST(req: Request) {
  let spec: InsightSpec

  try {
    const body = await req.json()
    const parsed = insightSpecSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "Dữ liệu chart không hợp lệ.", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    spec = parsed.data
  } catch {
    return Response.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 })
  }

  const key = hashSpec(spec)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json({ text: cached.text, cached: true })
  }

  const dataBlock = specToPrompt(spec)

  try {
    const { text } = await generateText({
      // Gọi thẳng provider Google thay vì string qua AI Gateway
      // -> tránh phụ thuộc billing của Vercel AI Gateway.
      // Cần env: GOOGLE_GENERATIVE_AI_API_KEY
      model: google("gemini-3.6-flash"),
      system:
        "Bạn là chuyên gia phân tích hiệu suất quảng cáo digital (Google Ads & Meta Ads). " +
        "Phân tích số liệu được cung cấp và trả lời hoàn toàn bằng tiếng Việt. " +
        "Đưa ra 2-3 câu ngắn gọn: nhận định xu hướng nổi bật và MỘT khuyến nghị hành động cụ thể. " +
        "Không lặp lại số liệu thô một cách máy móc, tập trung vào ý nghĩa kinh doanh. Không dùng markdown.",
      prompt: `Biểu đồ: "${spec.title}" (${spec.subject}).\n\nDữ liệu:\n${dataBlock}\n\nHãy phân tích.`,
      // abortSignal: AbortSignal.timeout(20_000),
       // fail sớm hơn maxDuration của route
    })

    const trimmed = text.trim()
    cache.set(key, { text: trimmed, expiresAt: Date.now() + CACHE_TTL_MS })

    return Response.json({ text: trimmed })
  } catch (err) {
    console.error("[insights] route error:", err)
    const raw = err instanceof Error ? err.message : String(err)

    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    const needsCard = /credit card|customer_verification|valid credit/i.test(raw)
    const isRateLimit = /rate limit|429/i.test(raw)

    const message = isTimeout
      ? "AI phân tích mất quá lâu, vui lòng thử lại."
      : needsCard
        ? "Tính năng AI cần cấu hình API key (GOOGLE_GENERATIVE_AI_API_KEY) hoặc bật thanh toán Gateway. Insight tự động vẫn hoạt động bình thường."
        : isRateLimit
          ? "Đang quá tải request AI, vui lòng thử lại sau ít phút."
          : "Không tạo được phân tích AI. Vui lòng thử lại."

    const status = needsCard ? 402 : isRateLimit ? 429 : 500
    return Response.json({ error: message, debug: raw }, { status })
  }
}