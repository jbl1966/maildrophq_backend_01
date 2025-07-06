import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

let mailTmDomain = null; // cached domain for mail.tm

// Generate email
app.get("/api/generate", async (req, res) => {
  try {
    const domain = await getMailTmDomain();
    const email = generateRandomEmail(domain);

    const accountRes = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: email,
        password: "password123"
      }),
    });

    const data = await accountRes.json();
    if (data.address) {
      const [prefix, domain] = data.address.split("@");
      return res.json({ prefix, domain });
    } else {
      throw new Error("Mail.tm account creation failed: " + JSON.stringify(data));
    }
  } catch (err) {
    console.error("Email generation error:", err.message);
    return res.status(500).json({ error: "Email generation failed." });
  }
});

// Get inbox
app.get("/api/messages", async (req, res) => {
  const { prefix, domain } = req.query;
  if (!prefix || !domain) {
    return res.status(400).json({ error: "Missing prefix or domain." });
  }

  try {
    const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${prefix}&domain=${domain}`;
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const html = await response.text();
      throw new Error("Unexpected HTML response: " + html.slice(0, 100));
    }
    const messages = await response.json();
    return res.json(messages);
  } catch (err) {
    console.error("Inbox fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load inbox." });
  }
});

// Get message by ID
app.get("/api/message", async (req, res) => {
  const { prefix, domain, id } = req.query;
  if (!prefix || !domain || !id) {
    return res.status(400).json({ error: "Missing prefix, domain, or id." });
  }

  try {
    const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${prefix}&domain=${domain}&id=${id}`;
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const html = await response.text();
      throw new Error("Unexpected HTML response: " + html.slice(0, 100));
    }
    const message = await response.json();
    return res.json(message);
  } catch (err) {
    console.error("Failed to fetch message:", err.message);
    return res.status(500).json({ error: "Failed to load message." });
  }
});

// Utilities
function generateRandomEmail(domain) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const name = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${name}@${domain}`;
}

async function getMailTmDomain() {
  if (mailTmDomain) return mailTmDomain;
  try {
    const res = await fetch("https://api.mail.tm/domains");
    const data = await res.json();
    if (data["hydra:member"] && data["hydra:member"].length > 0) {
      mailTmDomain = data["hydra:member"][0].domain;
      console.log("✅ Mail.tm domain:", mailTmDomain);
      return mailTmDomain;
    } else {
      throw new Error("No domain returned.");
    }
  } catch (err) {
    throw new Error("Failed to fetch mail.tm domain: " + err.message);
  }
}

// Start server
app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend running on port ${port}`);
});
