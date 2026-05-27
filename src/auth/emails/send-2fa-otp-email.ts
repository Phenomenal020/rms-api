import sendEmail from "./email-template";

interface TwoFactorOtpData {
  email: string;
  otp: string;
  name?: string;
}

export async function send2FAOtpEmail({ email, otp, name }: TwoFactorOtpData) {
  const greeting = name ? `Hi ${name}` : "Hi there";
  const digits = otp.split("");

  await sendEmail({
    to: email,
    subject: "Your sign-in verification code — Teacher's Aid",
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
                    <p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#667eea;">Two-Factor Authentication</p>
                    <h1 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">Sign-in<br/>verification code</h1>
                    <p style="margin:0 0 24px;font-size:14px;color:#8888a8;line-height:1.65;">${greeting} — a sign-in attempt to your account requires this code.</p>

                    <!-- OTP block -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f14;border:1px solid #2a2a38;border-radius:10px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:22px 22px 18px;">
                          <p style="margin:0 0 14px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#8888a8;">Your code</p>
                          <table role="presentation" cellspacing="6" cellpadding="0" border="0">
                            <tr>
                              ${digits.map(d => `<td style="width:50px;height:62px;background:#0f0f14;border:1.5px solid #2a2a38;border-radius:6px;text-align:center;vertical-align:middle;font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#ffffff;">${d}</td>`).join("")}
                            </tr>
                          </table>
                          <p style="margin:12px 0 0;font-size:12px;color:#4a4a6a;">⏱&nbsp; Expires in 5 minutes</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Security alert -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1114;border:1px solid #3d1a24;border-radius:8px;margin-bottom:20px;">
                      <tr>
                        <td style="padding:13px 15px;">
                          <p style="margin:0;font-size:13px;color:#c07070;line-height:1.55;"><strong style="color:#e08888;">⚠ Didn't try to sign in?</strong>&nbsp; Someone may be attempting to access your account. Change your password immediately and contact support.</p>
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
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">Enter this code on the sign-in verification screen in your browser.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="color:#667eea;font-size:12px;padding-right:10px;vertical-align:top;padding-top:2px;">→</td>
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">Do not share this code — Teacher's Aid staff will never ask for it.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="color:#667eea;font-size:12px;padding-right:10px;vertical-align:top;padding-top:2px;">→</td>
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">This code is valid for one use only and expires in 5 minutes.</td>
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
                          <p style="margin:0;font-size:12px;color:#4a4a6a;line-height:1.65;">You received this because a sign-in was attempted on your Teacher's Aid account.<br/><a href="https://teachersaid.tech" style="color:#667eea;text-decoration:none;">teachersaid.tech</a> &nbsp;·&nbsp; <a href="mailto:support@teachersaid.tech" style="color:#667eea;text-decoration:none;">support@teachersaid.tech</a></p>
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
    text: `${greeting} — your Teacher's Aid sign-in verification code is:\n\n${otp}\n\nExpires in 5 minutes. One use only.\n\n⚠ Didn't try to sign in? Someone may be attempting to access your account. Change your password and contact support immediately.\n\nteachersaid.tech · support@teachersaid.tech`,
  });
}
