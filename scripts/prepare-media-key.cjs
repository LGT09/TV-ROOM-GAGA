// One private key per build, shared by every serverless function in that build.
// Never print this value or include this directory in source control.
const fs = require("node:fs")
const path = require("node:path")
const { randomBytes } = require("node:crypto")
const directory = path.join(__dirname, "..", ".generated")
const file = path.join(directory, "media-key.json")
fs.mkdirSync(directory, { recursive: true })
if (!process.argv.includes("--ensure") || !fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify({ key: randomBytes(32).toString("base64url") }), { mode: 0o600 })
}
