import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;
app.use(cors());

let tokenCache = {}; // Stores auth token per email

// Utility: Generate a random 8-char email prefix
function generateRandomPrefix() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Create new account + get token
async function createAccount() {
  const prefix = generateRandomPrefix();
  const email = `${prefix}@temp-mail.org`; // working domain
  const password = "password123";

  const res = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: email, password }),
  });

  const data = await res.json();
  if (data["@type"] === "ConstraintViolationList") {
    throw new Error("Email domain may be invalid or reused.");
  }

  // Now login to get token
  const loginRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: email, password }),
  });
  const loginData = await loginRes.json();

  tokenCache[prefix] = loginData.token;
  return { prefix, domain: "temp-mail.org" };
}

// Get inbox messages
async function getInbox(prefix) {
  const token = tokenCache[prefix];
  if (!token) throw new Error("Token not found. Inbox expired or never created.");

  const res = await fetch("https://api.mail.tm/messages", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch messages.");
  const data = await res.json();
  return data["hydra:member"];
}

// Get full message content
async function getMessage(prefix, id) {
  const token = tokenCache[prefix];
  if (!token) throw new Error("Token not found for message retrieval.");

  const res = await fetch(`https://api.mail.tm/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch message.");
  return await res.json();
}

// ===== Routes =====

app.get("/api/generate", async (req, res) => {
  try {
    const { prefix, domain } = await createAccount();
    res.json({ prefix, domain });
  } catch (err) {
    console.error("Email generation failed:", err);
    res.status(500).json({ error: "Email generation failed." });
  }
});

app.get("/api/messages", async (req, res) => {
  const { prefix } = req.query;
  if (!prefix) return res.status(400).json({ error: "Missing email prefix." });

  try {
    const messages = await getInbox(prefix);
    res.json(messages);
  } catch (err) {
    console.error("Inbox fetch error:", err);
    res.status(500).json({ error: "Failed to fetch inbox." });
  }
});

app.get("/api/message", async (req, res) => {
  const { prefix, id } = req.query;
  if (!prefix || !id) return res.status(400).json({ error: "Missing prefix or message ID." });

  try {
    const message = await getMessage(prefix, id);
    res.json(message);
  } catch (err) {
    console.error("Message fetch error:", err);
    res.status(500).json({ error: "Failed to fetch message." });
  }
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ backend (mail.tm only) running on port ${port}`);
});
