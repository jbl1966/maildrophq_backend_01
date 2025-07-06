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

// 🔧 Generate Email Endpoint
app.get("/api/generate", async (req, res) => {
  await checkPrimary();
  console.log("Using engine:", activeEngine); // Debug log

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
