// Universal mailer that automatically routes emails based on environment:
// 1. Resend HTTP API (Port 443 - works on Render Free Tier!)
// 2. Brevo HTTP API (Port 443 - works on Render Free Tier!)
// 3. Nodemailer Gmail SMTP (Port 465 - works on localhost!)

export async function sendEmail({ to, subject, text }) {
  const recipient = to || process.env.ALERT_EMAIL || "24104019@nec.edu.in";

  // 1. Check for Resend (HTTPS API - Bypasses Render SMTP port blocking)
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`[Mailer] Sending via Resend to ${recipient}...`);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "RescueRelief <onboarding@resend.dev>",
          to: [recipient],
          subject: subject,
          text: text
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("[Mailer] Resend API error:", data);
        throw new Error(data.message || JSON.stringify(data));
      }
      console.log("[Mailer] Email sent successfully via Resend:", data.id);
      return { success: true, provider: "resend", id: data.id };
    } catch (err) {
      console.error("[Mailer] Resend failed:", err.message);
      // Fall through to other providers if available
    }
  }

  // 2. Check for Brevo (HTTPS API - Bypasses Render SMTP port blocking)
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`[Mailer] Sending via Brevo to ${recipient}...`);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY.trim(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "RescueRelief", email: process.env.EMAIL_USER || "rescue@relief.local" },
          to: [{ email: recipient }],
          subject: subject,
          textContent: text
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("[Mailer] Brevo API error:", data);
        throw new Error(data.message || JSON.stringify(data));
      }
      console.log("[Mailer] Email sent successfully via Brevo:", data.messageId);
      return { success: true, provider: "brevo", id: data.messageId };
    } catch (err) {
      console.error("[Mailer] Brevo failed:", err.message);
    }
  }

  // 3. Fallback: Standard Nodemailer (Works on Localhost)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log(`[Mailer] Sending via Nodemailer/Gmail to ${recipient}...`);
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipient,
        subject: subject,
        text: text
      });
      console.log("[Mailer] Email sent successfully via Nodemailer:", info.messageId);
      return { success: true, provider: "nodemailer", id: info.messageId };
    } catch (err) {
      console.error("[Mailer] Nodemailer failed:", err.message);
      throw err;
    }
  }

  console.warn("[Mailer] No email credentials configured (RESEND_API_KEY, BREVO_API_KEY, or EMAIL_USER/EMAIL_PASS).");
  return { success: false, error: "No email provider configured" };
}
