import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    // Build context from recent history
    const contextMessages = history
      .slice(-5)
      .filter((m: any) => m.role !== "welcome")
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n")

    const systemPrompt = `You are the TV Room AI Assistant - an expert on movies, TV series, K-dramas, anime, music, and entertainment.

TV Room Features:
- Full movie downloads (MP4) with actual file sizes based on duration and quality (4K, 1080p, 720p, 480p)
- Music downloads (MP3) with 320kbps and 192kbps options
- K-drama streaming with full season and episode information
- Anime library with episode counts
- Live sports channels (SuperSport, Sky Sports, beIN Sports)
- YouTube video downloads (filters out Shorts automatically)

When users ask about:
- Movies: Provide genre recommendations, explain quality options, file sizes
- K-dramas: Suggest popular titles, explain episode/season structure
- Music: Recommend artists, explain MP3 quality differences
- Downloads: Explain how file sizes are calculated (bitrate x duration)
- Channels: List available sports channels and what they show

Be helpful, concise, and knowledgeable about entertainment content.`

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: `Previous conversation:\n${contextMessages}\n\nUser: ${message}`,
      maxOutputTokens: 300,
    })

    return NextResponse.json({ response: text })
  } catch (error) {
    console.error("[v0] AI Chat API error:", error)

    // Fallback response based on keywords
    const message = (await request.clone().json()).message?.toLowerCase() || ""
    let fallbackResponse =
      "I can help you with movies, K-dramas, anime, music, downloads, and live channels. What would you like to know?"

    if (message.includes("download")) {
      fallbackResponse =
        "Downloads in TV Room provide FULL content - no clips or shorts. File sizes vary based on actual duration and quality - the real size will be shown before download. Music downloads are available in 320kbps (high quality) or 192kbps (standard)."
    } else if (message.includes("kdrama") || message.includes("korean")) {
      fallbackResponse =
        "K-dramas are available with full season and episode information. Popular titles include: Crash Landing on You, Squid Game, Goblin, and Vincenzo. Each show displays the number of seasons and total episodes. You can watch trailers or download full episodes in MP4 format!"
    } else if (message.includes("movie")) {
      fallbackResponse =
        "Browse movies by genre: Kids, Horror, Comedy, Action, Romance. Each movie shows actual duration, rating, and cast. Downloads include the full movie file - the actual size will be shown before download."
    } else if (message.includes("music") || message.includes("mp3")) {
      fallbackResponse =
        "Play music directly on TV Room before downloading! MP3 downloads come in 320kbps (high quality) or 192kbps (standard). Each track shows album artwork, duration, and artist info. Visit the Music section to browse and play."
    } else if (message.includes("channel") || message.includes("sport")) {
      fallbackResponse =
        "Live channels include: SuperSport (football, rugby), Sky Sports (Premier League, F1), beIN Sports (La Liga, Serie A), ESPN, and more. Channels stream via embedded players with real-time content!"
    }

    return NextResponse.json({ response: fallbackResponse })
  }
}
