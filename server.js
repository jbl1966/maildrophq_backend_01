import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

const primaryEngine = process.env.PRIMARY_ENGINE || "1secmail";
const fallbackEngine = process.env.FALLBACK_ENGINE || "mail.tm";
let activeEngine = primaryEngine;
let primaryAvailable = true;

let lastCheck = 0;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is running.");
});

// Generate a new email address
app.get("/api/generate", async (req, res) => {
  await checkPrimary();
  console.log("Using engine:", activeEngine);

  try {
    if (activeEngine === "1secmail") {
      const response = await fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
      const [email] = await response.json();
      const [prefix, domain] = email.split("@");
      return res.json({ prefix, domain });
    } else if (activeEngine === "mail.tm") {
      const email = generateRandomEmail();
      const response = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: email, password: "password123" }),
      });
      const data = await response.json();
      if (data.address) {
        const [prefix, domain] = data.address.split("@");
        return res.json({ prefix, domain });
      } else {
        throw new Error("Mail.tm error: " + JSON.stringify(data));
      }
    }
  } catch (err) {
    console.error("Email generation error:", err);
    return res.status(500).json({ error: "Email generation failed." });
  }
});

// List inbox messages
app.get("/api/messages", async (req, res) => {
  const { prefix, domain } = req.query;
  await checkPrimary();
  console.log("Checking inbox for:", prefix, "Engine:", activeEngine);

  if (!prefix) {
    return res.status(400).json({ error: "Missing email prefix." });
  }

  if (activeEngine === "1secmail") {
    try {
      const inboxUrl = `https://www.1secmail.com/api/v1/?action=getMessages&login=${prefix}&domain=${domain || "1secmail.com"}`;
      const response = await fetch(inboxUrl);
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Inbox fetch error:", err);
      return res.status(500).json({ error: "1SecMail returned an error." });
    }
  } else if (activeEngine === "mail.tm") {
    return res.status(501).json({ error: "Fallback engine inbox not implemented yet." });
  } else {
    return res.status(500).json({ error: "All inbox engines are unavailable." });
  }
});

// View a full message
app.get("/api/message", async (req, res) => {
  const { prefix, domain, id } = req.query;

  if (!prefix || !domain || !id) {
    return res.status(400).json({ error: "Missing required query params: prefix, domain, id" });
  }

  if (activeEngine === "1secmail") {
    try {
      const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${prefix}&domain=${domain}&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Failed to fetch message:", err);
      return res.status(500).json({ error: "Failed to load message." });
    }
  } else if (activeEngine === "mail.tm") {
    return res.status(501).json({ error: "Fallback engine inbox view not implemented yet." });
  } else {
    return res.status(500).json({ error: "All inbox engines are unavailable." });
  }
});

// Util: Random email generator for mail.tm
function generateRandomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const name = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${name}@mail.tm`;
}

// Util: check 1secmail availability
async function checkPrimary() {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL) return;

  lastCheck = now;
  try {
    const res = await fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1", { timeout: 3000 });
    if (res.ok) {
      primaryAvailable = true;
      activeEngine = primaryEngine;
      console.log("✅ 1SecMail available — using primary.");
    } else {
      throw new Error("Primary not OK");
    }
  } catch {
    primaryAvailable = false;
    activeEngine = fallbackEngine;
    console.warn("⚠️ Falling back to", fallbackEngine);
  }
}

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
