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

// Mail.tm token and account cache
const mailtmCache = {
  token: null,
  id: null,
  address: null,
  password: "password123",
};

app.use(cors());

// Generate email
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
      const register = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: email, password: mailtmCache.password }),
      });

      const regData = await register.json();
      if (!regData.id) throw new Error("Mail.tm registration failed: " + JSON.stringify(regData));

      mailtmCache.address = regData.address;
      mailtmCache.id = regData.id;

      const tokenRes = await fetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: regData.address, password: mailtmCache.password }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error("Mail.tm login failed: " + JSON.stringify(tokenData));
      mailtmCache.token = tokenData.token;

      const [prefix, domain] = regData.address.split("@");
      return res.json({ prefix, domain });
    }
  } catch (err) {
    console.error("Email generation error:", err);
    return res.status(500).json({ error: "Email generation failed." });
  }
});

// Fetch inbox messages
app.get("/api/messages", async (req, res) => {
  const { prefix } = req.query;
  await checkPrimary();
  console.log("Checking inbox for:", prefix, "Engine:", activeEngine);

  if (!prefix) return res.status(400).json({ error: "Missing email prefix." });

  if (activeEngine === "1secmail") {
    try {
      const domain = "1secmail.com";
      const inboxUrl = `https://www.1secmail.com/api/v1/?action=getMessages&login=${prefix}&domain=${domain}`;
      const response = await fetch(inboxUrl);
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Inbox fetch error:", err);
      return res.status(500).json({ error: "Failed to load 1SecMail inbox." });
    }
  } else if (activeEngine === "mail.tm") {
    try {
      if (!mailtmCache.token) throw new Error("Missing mail.tm token");
      const response = await fetch("https://api.mail.tm/messages", {
        headers: { Authorization: `Bearer ${mailtmCache.token}` },
      });
      const data = await response.json();
      return res.json(data["hydra:member"] || []);
    } catch (err) {
      console.error("Mail.tm inbox fetch error:", err);
      return res.status(500).json({ error: "Failed to load mail.tm inbox." });
    }
  } else {
    return res.status(500).json({ error: "All inbox engines are unavailable." });
  }
});

// View a full message
app.get("/api/message", async (req, res) => {
  const { id, prefix } = req.query;
  await checkPrimary();
  console.log("Fetching message ID:", id, "Engine:", activeEngine);

  if (!id) return res.status(400).json({ error: "Missing message ID." });

  if (activeEngine === "1secmail") {
    try {
      const domain = "1secmail.com";
      const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${prefix}&domain=${domain}&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Failed to fetch 1SecMail message:", err);
      return res.status(500).json({ error: "Failed to load message." });
    }
  } else if (activeEngine === "mail.tm") {
    try {
      if (!mailtmCache.token) throw new Error("Missing mail.tm token");
      const response = await fetch(`https://api.mail.tm/messages/${id}`, {
        headers: { Authorization: `Bearer ${mailtmCache.token}` },
      });
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Failed to fetch mail.tm message:", err);
      return res.status(500).json({ error: "Failed to load message." });
    }
  } else {
    return res.status(500).json({ error: "All inbox engines are unavailable." });
  }
});

// Utility functions
function generateRandomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const name = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${name}@${name}.tm`; // Use unique domain to avoid conflicts
}

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
      throw new Error("1SecMail not OK");
    }
  } catch {
    primaryAvailable = false;
    activeEngine = fallbackEngine;
    console.warn("⚠️ Falling back to", fallbackEngine);
  }
}

app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is running.");
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend running on port ${port}`);
});
