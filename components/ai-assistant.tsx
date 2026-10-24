"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, X, Loader2, Sparkles, Bot, RefreshCw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

async function getAIResponse(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase()

  // Try to use Gemini AI API
  try {
    const response = await fetch("https://api.hostify.indevs.in/api/ai/gemini-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `You are TV Room GAGA's helpful AI assistant. Help users with movies, music, K-dramas, anime, live TV channels, and downloads. Be friendly and concise. User: ${message}` }),
    })

    if (response.ok) {
      const data = await response.json()
      // Handle various response formats from the API
      const aiResponse = data.result || data.response || data.text || data.answer || data.message || data.content
      if (aiResponse) {
        // Ensure the response is a string, not an object
        if (typeof aiResponse === "string") {
          return aiResponse
        } else if (typeof aiResponse === "object" && aiResponse !== null) {
          // If it's an object, try to extract text from common fields
          return aiResponse.text || aiResponse.content || aiResponse.answer || JSON.stringify(aiResponse)
        }
      }
    }
  } catch (error) {
    // Fall back to built-in responses
  }

  // Fallback to built-in responses
  if (lowerMessage.includes("download") && lowerMessage.includes("movie")) {
    return "Open Movies & series, search for a title, and open it. For a series or anime, choose the season and episode first. Select Play to find an available file; Download buttons appear only when a real file is available. Your browser handles saving it to your device. Some titles may not have an accessible file."
  }

  if (lowerMessage.includes("download") && lowerMessage.includes("music")) {
    return "To download music:\n\n1. Go to the Music section or search\n2. Play any song to preview\n3. Click download button\n4. Choose quality: 320kbps or 192kbps\n\nFile sizes:\n- 320kbps: ~10MB per 4min song\n- 192kbps: ~6MB per 4min song\n\nPlay before downloading!"
  }

  if (lowerMessage.includes("search")) {
    return "Use Movies & series to search titles, filter categories, and choose how many cards appear per page. Select Series or Anime to narrow the collection. Music has its own room. The Help & guide page explains browsing, episodes, and downloads."
  }

  if (lowerMessage.includes("kdrama") || lowerMessage.includes("korean")) {
    return "K-Dramas in TV Room:\n\n• Crash Landing on You\n• Squid Game\n• Goblin\n• Vincenzo\n• All of Us Are Dead\n\nEach shows:\n- Seasons & episodes\n- Episode duration\n- Download size\n\nDownload full episodes!"
  }

  if (lowerMessage.includes("anime")) {
    return "Anime available:\n\n• Attack on Titan\n• Demon Slayer\n• Jujutsu Kaisen\n• One Piece\n• My Hero Academia\n\nShows episode count, rating, and genres. Download in your preferred quality!"
  }

  if (lowerMessage.includes("channel") || lowerMessage.includes("sport") || lowerMessage.includes("live")) {
    return "Live Channels:\n\n**Sports:**\n• SuperSport - Football, Rugby\n• Sky Sports - Premier League, F1\n• beIN Sports - La Liga\n• ESPN - American Sports\n• NBA TV - Basketball\n\n**Entertainment:**\n• Nickelodeon, Cartoon Network\n• Disney Channel, HBO, MTV\n\nAll stream live!"
  }

  if (lowerMessage.includes("quality") || lowerMessage.includes("size") || lowerMessage.includes("file")) {
    return "Quality & File Sizes:\n\n**Video Quality Options:**\n- 4K (2160p): Highest quality\n- 1080p: Full HD\n- 720p: HD (recommended)\n- 480p: Standard quality\n\nActual file sizes vary based on the movie duration and compression. The real file size will be displayed before you download."
  }

  if (lowerMessage.includes("series") || lowerMessage.includes("season") || lowerMessage.includes("episode")) {
    return "TV Series features:\n\n- Browse all seasons\n- Episode details\n- Download individual episodes\n- Quality selection\n\nAll downloads are full episodes!"
  }

  if (lowerMessage.includes("help") || lowerMessage.includes("how")) {
    return "Welcome to TV Room!\n\n**Movies & Series:**\nBrowse → Details → Download\n\n**Music:**\nMusic section → Play → Download MP3\n\n**Channels:**\nChannels page → Select → Watch live\n\n**Search:**\nUse search bar for all content\n\nWhat do you need help with?"
  }

  return "I can help with:\n\n• **Movies** - Download full movies\n• **K-Dramas** - Korean dramas\n• **Anime** - Japanese animation\n• **Music** - MP3 downloads\n• **Channels** - Live sports & entertainment\n• **Search** - Find any content\n\nAsk me anything!"
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to TV Room AI! I can help you with:\n\n• Finding movies, K-dramas, anime, and series\n• Understanding download options (MP3/MP4)\n• File sizes and quality settings\n• Live sports channels\n• Music playback\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input
    setInput("")
    setIsLoading(true)

    try {
      const response = await getAIResponse(userInput)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickQuestion = async (question: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await getAIResponse(question)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const quickQuestions = [
    "How to download movies?",
    "Show K-drama recommendations",
    "Explain file sizes",
    "What sports channels?",
  ]

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-24 right-6 z-40"
          >
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-primary to-secondary"
              onClick={() => setIsOpen(true)}
            >
              <Bot className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)]"
          >
            <Card className="border-primary/50 shadow-2xl">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-secondary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary rounded-lg">
                      <Sparkles className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">TV Room AI</CardTitle>
                      <CardDescription className="text-xs">Your entertainment guide</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea ref={scrollRef} className="h-80 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2 ${
                            message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="border-t p-2 flex flex-wrap gap-1">
                  {quickQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleQuickQuestion(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>

                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask about movies, downloads, channels..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      disabled={isLoading}
                    />
                    <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
