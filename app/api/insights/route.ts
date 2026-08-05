import { generateText } from "ai"
import { type InsightSpec, specToPrompt } from "@/lib/insights"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const spec = (await req.json()) as InsightSpec
    if (!spec?.labels?.length) {
      return Response.json({ error: "Thiếu dữ liệu chart." }, { status: 400 })
    }

    const dataBlock = specToPrompt(spec)

    const { text } = await generateText({
      // Fast, low-cost model; Google is zero-config on the Vercel AI Gateway.
      model: "google/gemini-2.5-flash",
      system:
        "Bạn là chuyên gia phân tích hiệu suất quảng cáo digital (Google Ads & Meta Ads). " +
        "Phân tích số liệu được cung cấp và trả lời hoàn toàn bằng tiếng Việt. " +
        "Đưa ra 2-3 câu ngắn gọn: nhận định xu hướng nổi bật và MỘT khuyến nghị hành động cụ thể. " +
        "Không lặp lại số liệu thô một cách máy móc, tập trung vào ý nghĩa kinh doanh. Không dùng markdown.",
      prompt: `Biểu đồ: "${spec.title}" (${spec.subject}).\n\nDữ liệu:\n${dataBlock}\n\nHãy phân tích.`,
    })

    return Response.json({ text: text.trim() })
  } catch (err) {
    console.error("[v0] insights route error:", err)
    const raw = err instanceof Error ? err.message : String(err)
    // The AI Gateway blocks requests until a payment method is on file; pass a
    // clear, actionable message through instead of a generic failure.
    const needsCard = /credit card|customer_verification|valid credit/i.test(raw)
    const message = needsCard
      ? "Tính năng AI cần bật thanh toán cho Vercel AI Gateway (thêm thẻ để mở khoá free credits). Các insight tự động bên trên vẫn hoạt động bình thường."
      : "Không tạo được phân tích AI. Vui lòng thử lại."
    return Response.json({ error: message }, { status: needsCard ? 402 : 500 })
  }
}
