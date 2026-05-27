import sendEmail from "./email-template";

// Used for both "forget-password" OTP (emailOtp.sendVerificationOTP type: "forget-password")
// and as a notification after a password is successfully changed (no otp needed for the latter).

interface PasswordResetOtpData {
  email: string;
  otp: string;
  name?: string;
}

export async function sendPasswordResetEmail({
  email,
  otp,
  name,
}: PasswordResetOtpData) {
  const greeting = name ? `Hi ${name}` : "Hi there";
  const digits = otp.split("");

  await sendEmail({
    to: email,
    subject: "Reset your password — Teacher's Aid",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background-color:#09090f;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;color:#e8e8f0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#09090f;padding:48px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background-color:#13131a;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5);">

                <!-- Top gradient bar -->
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#667eea 0%,#764ba2 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Logo row -->
                <tr>
                  <td style="padding:28px 40px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width:32px;height:32px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:7px;text-align:center;vertical-align:middle;font-size:15px;">🛡</td>
                        <td style="padding-left:10px;font-size:14px;font-weight:600;color:#e8e8f0;letter-spacing:-0.3px;">Teacher's Aid</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:32px 40px 16px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#667eea;">Password Reset</p>
                    <h1 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">Reset your<br/>password</h1>
                    <p style="margin:0 0 24px;font-size:14px;color:#8888a8;line-height:1.65;">${greeting} — we received a request to reset your password.</p>

                    <!-- OTP block -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f14;border:1px solid #2a2a38;border-radius:10px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:22px 22px 18px;">
                          <p style="margin:0 0 14px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#8888a8;">Reset code</p>
                          <table role="presentation" cellspacing="6" cellpadding="0" border="0">
                            <tr>
                              ${digits.map(d => `<td style="width:50px;height:62px;background:#0f0f14;border:1.5px solid #2a2a38;border-radius:6px;text-align:center;vertical-align:middle;font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#ffffff;">${d}</td>`).join("")}
                            </tr>
                          </table>
                          <p style="margin:12px 0 0;font-size:12px;color:#4a4a6a;">⏱&nbsp; Expires in 15 minutes</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Security alert -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1114;border:1px solid #3d1a24;border-radius:8px;margin-bottom:20px;">
                      <tr>
                        <td style="padding:13px 15px;">
                          <p style="margin:0;font-size:13px;color:#c07070;line-height:1.55;"><strong style="color:#e08888;">⚠ Security alert:</strong>&nbsp; If you didn't request this, please ignore this email. Your password won't change.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Info rows -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="color:#667eea;font-size:12px;padding-right:10px;vertical-align:top;padding-top:2px;">→</td>
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">Enter this code on the password reset screen to continue.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="color:#667eea;font-size:12px;padding-right:10px;vertical-align:top;padding-top:2px;">→</td>
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">This code is single-use and expires after one attempt.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid #1e1e2e;">
                      <tr>
                        <td style="padding-top:20px;">
                          <p style="margin:0;font-size:12px;color:#4a4a6a;line-height:1.65;">You received this because an action was taken on your Teacher's Aid account.<br/><a href="https://teachersaid.tech" style="color:#667eea;text-decoration:none;">teachersaid.tech</a> &nbsp;·&nbsp; <a href="mailto:support@teachersaid.tech" style="color:#667eea;text-decoration:none;">support@teachersaid.tech</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${greeting} — use this code to reset your Teacher's Aid password:\n\n${otp}\n\nExpires in 15 minutes. This code is single-use.\n\n⚠ Security alert: If you didn't request this, please ignore this email. Your password won't change.\n\nteachersaid.tech · support@teachersaid.tech`,
  });
}
