import sendEmail from "./email-template";

interface TeacherInvitationEmailData {
  to: string;
  fullName?: string | null;
  title?: string | null;
  activationLink: string;
  expiryDays?: number;
}

export async function sendTeacherInvitationEmail({
  to,
  fullName,
  title,
  activationLink,
  expiryDays = 7,
}: TeacherInvitationEmailData) {
  const greeting = [title, fullName].filter(Boolean).join(' ') || 'there';

  await sendEmail({
    to,
    subject: "You've been invited to join Teacher's Aid",
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
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">You're Invited!</h1>
                    <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Teacher's Aid — School Management Platform</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:40px 40px 30px;">
                    <p style="margin:0 0 16px;color:#4a4a4a;font-size:16px;">Dear ${greeting},</p>
                    <p style="margin:0 0 24px;color:#4a4a4a;font-size:16px;line-height:1.7;">
                      You have been invited by your school administrator to join <strong>Teacher's Aid</strong>. 
                      Click the button below to accept your invitation and create your account.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px;">
                      <tr>
                        <td align="center">
                          <a href="${activationLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(102,126,234,0.3);">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="margin:0 0 8px;color:#6b6b6b;font-size:14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin:0 0 24px;word-break:break-all;">
                      <a href="${activationLink}" style="color:#667eea;font-size:13px;text-decoration:none;">${activationLink}</a>
                    </p>

                    <!-- Security notice -->
                    <div style="padding:18px;background-color:#f8f9fa;border-left:4px solid #667eea;border-radius:4px;margin:0 0 24px;">
                      <p style="margin:0;color:#6b6b6b;font-size:14px;line-height:1.6;">
                        <strong style="color:#1a1a1a;">Security notice:</strong> This invitation link expires in <strong>${expiryDays} days</strong>. 
                        If you did not expect this invitation, you can safely ignore this email — no account will be created without your action.
                      </p>
                    </div>

                    <p style="margin:0;color:#6b6b6b;font-size:14px;line-height:1.6;">Best regards,<br><strong style="color:#1a1a1a;">Teacher's Aid Team</strong></p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:24px 40px;background-color:#f8f9fa;border-radius:0 0 8px 8px;border-top:1px solid #e9ecef;text-align:center;">
                    <p style="margin:0 0 6px;color:#6b6b6b;font-size:13px;">Need help? Contact us at <a href="mailto:support@teachersaid.tech" style="color:#667eea;text-decoration:none;">support@teachersaid.tech</a></p>
                    <p style="margin:0;color:#9b9b9b;font-size:12px;">© ${new Date().getFullYear()} Teacher's Aid. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Dear ${greeting},\n\nYou have been invited by your school administrator to join Teacher's Aid.\n\nAccept your invitation here:\n${activationLink}\n\nThis link expires in ${expiryDays} days. If you did not expect this invitation, you can safely ignore this email.\n\nBest regards,\nTeacher's Aid Team`,
  });
}
