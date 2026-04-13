import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending emails
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;

    // In a real app, you'd use real credentials. 
    // For this demo, we'll use a test account or log it.
    // Since we don't have real SMTP credentials in .env yet, we'll log it.
    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    
    // If SMTP credentials exist, we could use them:
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Churrasco Condomínio" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text,
          html,
        });
        return res.json({ success: true, message: "Email sent" });
      } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ success: false, error: "Failed to send email" });
      }
    } else {
      console.log("SMTP credentials not found. Email logged to console.");
      return res.json({ success: true, message: "Email logged (no SMTP config)" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
