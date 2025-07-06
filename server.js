import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

// Generate a random email using mail.tm
app.get("/api/generate", async (req, res) => {
  const email = generateRandomEmail();
  try {
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
      throw new Error("mail.tm returned: " + JSON.stringify(data));
    }
  } catch (err) {
    console.error("Email generation error:", err);
    return res.status(500).json({ error: "Email generation failed." });
  }
});

// Utility function to generate random email address
function generateRandomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const name = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${name}@punkproof.com`;
}


// Start the server
app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
