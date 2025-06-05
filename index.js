require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");

// ensure scan QR once by saving the session
const client = new Client({ authStrategy: new LocalAuth() });

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

const sendTon8n = async (payload) => {
  try {
    await fetch("http://localhost:5678/webhook/whatsapp-incoming", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: payload.from,
        body: payload.body,
        timestamp: payload.timestamp,
        author: payload.author,
        to: payload.to,
      }),
    });
    console.log("✅ Sent to n8n webhook");
  } catch (err) {
    console.error("❌ Error sending to n8n:", err);
  }
};

const checkInValidRoom = (room) => {
  return room !== process.env.GROUP_ID;
};

// Handle message from me, sometimes 'message' cant receive the chat from me. that's why we need 'message_create'
client.on("message_create", async (msg) => {
  console.log({ message_create: msg });
  const isNotMe = msg.body.includes("*AI Assistant:*");
  if (checkInValidRoom(msg.to) || isNotMe) return;

  if (msg.fromMe) {
    await sendTon8n(msg);
  }
});

// Handle message from the others
client.on("message", async (msg) => {
  console.log({ message: msg });
  if (checkInValidRoom(msg.to)) return;

  if (!msg.fromMe) {
    await sendTon8n(msg);
  }
});

client.initialize();

// Server

const app = express();
app.use(express.json());
app.post("/send-reply", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send("Missing chatId or message");
  }

  try {
    await client.sendMessage(process.env.GROUP_ID, message);
    res.send("Message sent");
  } catch (err) {
    res.status(500).send(`Failed to send message: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server on port ${PORT}`));
