import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailUser = process.env.EMAIL;
// Gmail app passwords are shown with spaces but must be used without them
const emailPass = process.env.EMAIL_PASSWORD?.replace(/\s/g, "");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

if (!emailUser || !emailPass) {
  console.warn("EMAIL or EMAIL_PASSWORD is missing in Backend/.env");
} else {
  transporter.verify((err) => {
    if (err) {
      console.error("Gmail SMTP auth failed:", err.message);
      console.error(
        "Create an App Password at https://myaccount.google.com/apppasswords (requires 2-Step Verification) and set EMAIL_PASSWORD in Backend/.env."
      );
    } else {
      console.log("Email transporter ready");
    }
  });
}

export default transporter;
