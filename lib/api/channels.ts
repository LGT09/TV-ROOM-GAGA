// TV Channels data with real streaming sources
export interface TVChannel {
  id: string
  name: string
  logo: string
  category: string
  description: string
  shows: string[]
  streamUrl: string
  youtubeChannelId?: string
  fallbackSearchQuery?: string
}

export const tvChannels: TVChannel[] = [
  // Sports Channels
  {
    id: "supersport",
    name: "SuperSport",
    logo: "/supersport-logo.jpg",
    category: "Sports",
    description: "Africa's leading sports broadcaster - Live football, rugby, cricket and more",
    shows: ["Premier League", "La Liga", "UEFA Champions League", "PSL", "Rugby Championship"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCnHF5-WaSgZBqZNw5SqZr3Q",
    fallbackSearchQuery: "SuperSport live football 2024",
  },
  {
    id: "sky-sports",
    name: "Sky Sports",
    logo: "/sky-sports-logo.jpg",
    category: "Sports",
    description: "UK's premier sports coverage - Football, F1, Cricket, Golf",
    shows: ["Premier League", "EFL Championship", "Formula 1", "Cricket", "Golf Majors"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCNAf1k0yIjyGu3k9BwAg3lg",
    fallbackSearchQuery: "Sky Sports News live",
  },
  {
    id: "bein-sports",
    name: "beIN Sports",
    logo: "/bein-sports-logo.jpg",
    category: "Sports",
    description: "Global sports network - La Liga, Ligue 1, Serie A coverage",
    shows: ["La Liga", "Ligue 1", "Serie A", "Copa America", "AFC Champions League"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCYKmzs1JGPe2gBRX8FcwyUg",
    fallbackSearchQuery: "beIN Sports live football",
  },
  {
    id: "espn",
    name: "ESPN",
    logo: "/espn-logo.jpg",
    category: "Sports",
    description: "The worldwide leader in sports - NFL, NBA, MLB, UFC",
    shows: ["SportsCenter", "Monday Night Football", "NBA on ESPN", "UFC", "College GameDay"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCiWLfSweyRNmLpgEHekhoAg",
    fallbackSearchQuery: "ESPN live sports news",
  },
  {
    id: "nba-tv",
    name: "NBA TV",
    logo: "/nba-tv-logo.png",
    category: "Sports",
    description: "All basketball, all the time - NBA games, analysis, and classics",
    shows: ["NBA Games", "NBA Finals", "All-Star Weekend", "NBA Draft", "Inside the NBA"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCWJ2lWNubArHWmf3FIHbfcQ",
    fallbackSearchQuery: "NBA TV live basketball",
  },
  {
    id: "fox-sports",
    name: "Fox Sports",
    logo: "/fox-sports-logo.jpg",
    category: "Sports",
    description: "Major league sports coverage - MLB, NFL, NASCAR, Soccer",
    shows: ["NFL on Fox", "MLB on Fox", "NASCAR", "FIFA World Cup", "UFC on Fox"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCnPkTA-bzcCbYKG6YC6SVJA",
    fallbackSearchQuery: "Fox Sports live",
  },
  // Kids Channels
  {
    id: "nickelodeon",
    name: "Nickelodeon",
    logo: "/nickelodeon-logo.jpg",
    category: "Kids",
    description: "The number one kids entertainment brand",
    shows: ["SpongeBob SquarePants", "The Loud House", "PAW Patrol", "Blue's Clues", "Dora the Explorer"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCx27Pkk8plpiosF14qXq-VA",
    fallbackSearchQuery: "Nickelodeon cartoons full episodes",
  },
  {
    id: "cartoon-network",
    name: "Cartoon Network",
    logo: "/cartoon-network-logo.jpg",
    category: "Kids",
    description: "Home of the best cartoons",
    shows: ["Adventure Time", "Regular Show", "The Amazing World of Gumball", "Steven Universe", "Teen Titans Go!"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCcp4h03eLH5uKIKS_JOwHEvRhQ",
    fallbackSearchQuery: "Cartoon Network live stream",
  },
  {
    id: "disney-channel",
    name: "Disney Channel",
    logo: "/disney-channel-logo.jpg",
    category: "Kids",
    description: "Where the magic happens",
    shows: ["Gravity Falls", "Phineas and Ferb", "Kim Possible", "DuckTales", "Big City Greens"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCw7SNYrYei7F5ttQO3o-rpA",
    fallbackSearchQuery: "Disney Channel full episodes",
  },
  // Entertainment
  {
    id: "hbo",
    name: "HBO",
    logo: "/generic-entertainment-logo.png",
    category: "Premium",
    description: "Premium entertainment and original series",
    shows: ["Game of Thrones", "House of the Dragon", "The Last of Us", "Succession", "Euphoria"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCQzdMyuz0Lf4zo4uGcEujFw",
    fallbackSearchQuery: "HBO trailers 2024",
  },
  {
    id: "netflix",
    name: "Netflix",
    logo: "/netflix-logo.png",
    category: "Streaming",
    description: "Stream unlimited movies and TV shows",
    shows: ["Stranger Things", "The Crown", "Wednesday", "Squid Game", "Money Heist"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCWOA1ZGywLbqmigxE4Qlvuw",
    fallbackSearchQuery: "Netflix new releases 2024",
  },
  {
    id: "mtv",
    name: "MTV",
    logo: "/mtv-logo.jpg",
    category: "Entertainment",
    description: "Music television and reality shows",
    shows: ["MTV Cribs", "Ridiculousness", "Teen Mom", "The Challenge", "Catfish"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UC0EOyTx7uKIKS_JOwHEvRhQ",
    fallbackSearchQuery: "MTV music videos live",
  },
  // News & Documentary
  {
    id: "discovery",
    name: "Discovery Channel",
    logo: "/discovery-channel-logo.jpg",
    category: "Documentary",
    description: "Explore your world - Science, nature, and adventure",
    shows: ["MythBusters", "Deadliest Catch", "Gold Rush", "Shark Week", "Planet Earth"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCEdvpU2pFRCVqU6yIPyTpMQ",
    fallbackSearchQuery: "Discovery Channel documentaries",
  },
  {
    id: "national-geographic",
    name: "National Geographic",
    logo: "/national-geographic-logo.jpg",
    category: "Documentary",
    description: "Explore the world through stunning documentaries",
    shows: ["Wild America", "Cosmos", "One Strange Rock", "Brain Games", "Explorer"],
    streamUrl: "https://www.youtube.com/embed/live_stream?channel=UCpVm7bg6pXKo1Pr6k5kxG9A",
    fallbackSearchQuery: "National Geographic documentaries",
  },
]

export function getChannelsByCategory(category: string): TVChannel[] {
  return tvChannels.filter((channel) => channel.category === category)
}

export function getChannelById(id: string): TVChannel | undefined {
  return tvChannels.find((channel) => channel.id === id)
}

export function getAllCategories(): string[] {
  const categories = Array.from(new Set(tvChannels.map((channel) => channel.category)))
  // Sort to put Sports first
  return categories.sort((a, b) => {
    if (a === "Sports") return -1
    if (b === "Sports") return 1
    return a.localeCompare(b)
  })
}

export function getSportsChannels(): TVChannel[] {
  return tvChannels.filter((channel) => channel.category === "Sports")
}
