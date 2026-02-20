import sendEmail from "./email-template";

interface PasswordResetData {
  user: {
    name: string;
    email: string;
  };
  url: string;
  token: string;
}

export async function sendPasswordResetEmail({
  user,
  url,
  token,
}: PasswordResetData) {
  if (!user.email) {
    throw new Error("User email is required for password reset");
  }

  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f4;line-height:1.6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f4;padding:40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="padding:40px 40px 30px;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px 8px 0 0;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Reset Your Password</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding:40px 40px 30px;">
                    <p style="margin:0 0 16px;color:#4a4a4a;font-size:16px;">Hello ${user.name},</p>
                    <p style="margin:0 0 24px;color:#4a4a4a;font-size:16px;">You requested to reset your password. Please click the button below to create a new password:</p>
                    
                    <!-- Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
                      <tr>
                        <td align="center" style="padding:0;">
                          <a href="${url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(102,126,234,0.3);">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin:0 0 16px;color:#6b6b6b;font-size:14px;line-height:1.6;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
                    <p style="margin:0 0 24px;color:#6b6b6b;font-size:14px;line-height:1.6;">This link will expire in 24 hours.</p>

                    <p style="margin:0;color:#6b6b6b;font-size:14px;line-height:1.6;">Best regards,<br><strong style="color:#1a1a1a;">Teacher's Aid Team</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${user.name},\n\nYou requested to reset your password. Please click this link to create a new password: ${url}\n\nIf you didn't request a password reset, please ignore this email. Your password will remain unchanged.\n\nThis link will expire in 24 hours.\n\nBest regards,\nTeacher's Aid Team`,
  });
}
