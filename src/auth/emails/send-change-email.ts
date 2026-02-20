import sendEmail from "./email-template";

interface EmailChangeData {
  user: {
    name: string;
    email?: string;
  };
  url: string;
}

export async function sendEmailChange({ user, url }: EmailChangeData) {
  if (!user.email) {
    throw new Error("User email is required for email change");
  }

  await sendEmail({
    to: user.email,
    subject: "Approve Email Change - Teacher's Aid",
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
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Verify Your Email</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding:40px 40px 30px;">
                    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;font-weight:600;">Hello ${user.name},</h2>
                    <p style="margin:0 0 24px;color:#4a4a4a;font-size:16px;line-height:1.6;">You recently requested to change your email address! Please complete the change by clicking the button below. This link expires in 24 hours.</p>
                    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 28px;">
                      <tr>
                        <td style="text-align:center;">
                          <a href="${url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(102,126,234,0.3);">Verify Email</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;color:#6b6b6b;font-size:14px;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin:0 0 24px;color:#667eea;font-size:14px;line-height:1.5;word-break:break-all;">
                      <a href="${url}" style="color:#667eea;text-decoration:none;">${url}</a>
                    </p>
                    <div style="padding:18px;background-color:#f8f9fa;border-left:4px solid #667eea;border-radius:4px;margin:26px 0;">
                      <p style="margin:0 0 12px;color:#6b6b6b;font-size:14px;line-height:1.6;">If you did not request this email change, please ignore it.</p>
                    </div>
                    <p style="margin:0 0 12px;color:#6b6b6b;font-size:14px;line-height:1.6;">Thank you for using Teacher's Aid!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
}
