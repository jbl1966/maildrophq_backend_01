// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: ['http://localhost:8080', 'https://maildrophq.com'],
  credentials: true,
}));

app.use(bodyParser.json());

let activeEngine = "mail.tm";
let mailTmToken = null;
let mailTmAccount = null;
let mailTmDomain = "punkproof.com";

// Initialize a mail.tm account
async function initMailTm() {
  try {
    const domainRes = await fetch("https://api.mail.tm/domains");
    const domainData = await domainRes.json();
    mailTmDomain = domainData["hydra:member"][0].domain;

    const prefix = Math.random().toString(36).substring(2, 10);
    const address = `${prefix}@${mailTmDomain}`;
    const password = "password123";

    const accountRes = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    if (accountRes.status === 201) {
      const loginRes = await fetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      const loginData = await loginRes.json();
      mailTmToken = loginData.token;
      mailTmAccount = { prefix, domain: mailTmDomain, address, id: loginData.id };
      console.log("✅ mail.tm account created:", mailTmAccount);
    } else {
      throw new Error("Account creation failed");
    }
  } catch (err) {
    console.error("❌ mail.tm init failed:", err.message);
    activeEngine = "1secmail";
  }
}

// Validate email prefix
function isValidPrefix(prefix) {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(prefix);
}

// Generate email (random or with custom prefix)
app.get("/api/generate", async (req, res) => {
  const requestedPrefix = req.query.prefix;

  if (activeEngine === "mail.tm") {
    try {
      const domainRes = await fetch("https://api.mail.tm/domains");
      const domainData = await domainRes.json();
      const domain = domainData["hydra:member"][0].domain;
      const prefix = requestedPrefix && isValidPrefix(requestedPrefix)
        ? requestedPrefix
        : Math.random().toString(36).substring(2, 10);
      const address = `${prefix}@${domain}`;
      const password = "password123";

      const accountRes = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
      });

      if (accountRes.status === 201) {
        const loginRes = await fetch("https://api.mail.tm/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, password }),
        });

        const loginData = await loginRes.json();
        mailTmToken = loginData.token;
        mailTmAccount = { prefix, domain, address, id: loginData.id };

        return res.json({ prefix, domain });
      } else {
        throw new Error("Account creation failed");
      }
    } catch (err) {
      console.error("❌ mail.tm generate failed:", err.message);
      activeEngine = "1secmail";
    }
  }

  if (activeEngine === "1secmail") {
    try {
      const prefix = requestedPrefix && isValidPrefix(requestedPrefix)
        ? requestedPrefix
        : Math.random().toString(36).substring(2, 10);
      const domain = "1secmail.com";
      return res.json({ prefix, domain });
    } catch (err) {
      return res.status(500).json({ error: "1SecMail generation failed." });
    }
  }

  return res.status(500).json({ error: "No inbox engines available." });
});

// Get inbox
app.get("/api/messages", async (req, res) => {
  const { prefix, domain } = req.query;

  if (activeEngine === "mail.tm") {
    try {
      const response = await fetch("https://api.mail.tm/messages", {
        headers: { Authorization: `Bearer ${mailTmToken}` },
      });
      const data = await response.json();
      return res.json(data["hydra:member"]);
    } catch (err) {
      console.error("mail.tm inbox error:", err.message);
      activeEngine = "1secmail";
    }
  }

  if (activeEngine === "1secmail") {
    try {
      const response = await fetch(
        `https://www.1secmail.com/api/v1/?action=getMessages&login=${prefix}&domain=${domain}`
      );
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: "1SecMail inbox error." });
    }
  }

  return res.status(500).json({ error: "No inbox engines available." });
});

// View full message
app.get("/api/message", async (req, res) => {
  const { prefix, domain, id } = req.query;

  if (activeEngine === "mail.tm") {
    try {
      const response = await fetch(`https://api.mail.tm/messages/${id}`, {
        headers: { Authorization: `Bearer ${mailTmToken}` },
      });
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("mail.tm message error:", err.message);
      return res.status(500).json({ error: "mail.tm failed to load message." });
    }
  }

  if (activeEngine === "1secmail") {
    try {
      const response = await fetch(
        `https://www.1secmail.com/api/v1/?action=readMessage&login=${prefix}&domain=${domain}&id=${id}`
      );
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: "1SecMail failed to load message." });
    }
  }

  return res.status(500).json({ error: "No inbox engines available." });
});

// Fallback homepage
app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${PORT}`);
  initMailTm();
});
