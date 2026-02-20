import sendEmail from "./email-template";

interface DeleteAccountData {
  user: {
    name: string;
    email?: string;
  };
  url: string;
}

export async function sendDeleteAccountVerificationEmail({
  user,
  url,
}: DeleteAccountData) {
  if (!user.email) {
    throw new Error("User email is required to verify account deletion");
  }

  await sendEmail({
    to: user.email,
    subject: "Confirm Account Deletion - Teacher's Aid",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f4;">
        <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;">
          <tr>
            <td style="padding:40px 20px;">
              <table role="presentation" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding:40px 40px 30px;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px 8px 0 0;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Confirm Account Deletion</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding:40px 40px 30px;">
                    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;font-weight:600;">We received your request</h2>
                    <p style="margin:0 0 16px;color:#4a4a4a;font-size:16px;line-height:1.6;">Hello ${user.name},</p>
                    <p style="margin:0 0 24px;color:#4a4a4a;font-size:16px;line-height:1.6;">You requested to delete your account. Confirm below to permanently remove your account and data. This link expires in 24 hours.</p>
                    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 28px;">
                      <tr>
                        <td style="text-align:center;">
                          <a href="${url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(102,126,234,0.3);">Confirm Deletion</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;color:#6b6b6b;font-size:14px;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin:0 0 24px;color:#667eea;font-size:14px;line-height:1.6;word-break:break-all;">
                      <a href="${url}" style="color:#667eea;text-decoration:none;">${url}</a>
                    </p>
                    <div style="padding:18px;background-color:#f8f9fa;border-left:4px solid #667eea;border-radius:4px;margin:26px 0;">
                      <p style="margin:0;color:#6b6b6b;font-size:14px;line-height:1.6;">
                        <strong style="color:#1a1a1a;">Security notice:</strong> If you did not request this, ignore this email and your account will stay active.
                      </p>
                    </div>
                    <p style="margin:0;color:#6b6b6b;font-size:14px;line-height:1.6;">Best regards,<br /><strong style="color:#1a1a1a;">Teacher's Aid Team</strong></p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:28px 40px;background-color:#f8f9fa;border-radius:0 0 8px 8px;border-top:1px solid #e9ecef;text-align:center;">
                    <p style="margin:0 0 8px;color:#6b6b6b;font-size:13px;line-height:1.6;">Need help? Contact us at <a href="mailto:support@teachersaid.tech" style="color:#667eea;text-decoration:none;">support@teachersaid.tech</a></p>
                    <p style="margin:0;color:#9b9b9b;font-size:12px;line-height:1.6;">© ${new Date().getFullYear()} Teacher's Aid. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${user.name},\n\nYou requested to delete your account. Confirm this action by visiting this link (expires in 24 hours):\n\n${url}\n\nIf you did not request this, ignore this email and your account will remain active.\n\nBest regards,\nTeacher's Aid Team`,
  });
}
