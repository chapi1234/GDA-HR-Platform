import getContactMailOptions from "../Email/contactUs.js";
import { sendEmail } from "../Email/sendEmail.js";

export const sendContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!email || !message) {
      return res.status(400).json({ success: false, message: "Email and message are required." });
    }

    const emailResult = await sendEmail(
      getContactMailOptions({ name, email, subject, message })
    );

    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || "Failed to send message.",
      });
    }

    return res.status(200).json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    console.error("Contact send error:", err);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
};

export default { sendContact };
