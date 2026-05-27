import sendEmail from "./email-template";

interface OrganisationInvitationData {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}

export async function sendOrganizationInvitation({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: OrganisationInvitationData) {
  await sendEmail({
    to: email,
    subject: `You've been invited to join ${teamName} — Teacher's Aid`,
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
                    <p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#667eea;">School Invitation</p>
                    <h1 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">You've been invited<br/>to join a school</h1>
                    <p style="margin:0 0 24px;font-size:14px;color:#8888a8;line-height:1.65;"><strong style="color:#c8c8e0;">${invitedByUsername}</strong> (<a href="mailto:${invitedByEmail}" style="color:#667eea;text-decoration:none;">${invitedByEmail}</a>) has invited you to join <strong style="color:#c8c8e0;">${teamName}</strong> on Teacher's Aid.</p>

                    <!-- School name badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f14;border:1px solid #2a2a38;border-radius:10px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:20px 22px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#8888a8;">School</p>
                          <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${teamName}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <a href="${inviteLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f14;border:1px solid #2a2a38;border-radius:8px;margin-bottom:20px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#4a4a6a;">Or copy this link</p>
                          <p style="margin:0;font-size:12px;color:#667eea;word-break:break-all;font-family:'Courier New',monospace;">${inviteLink}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Security alert -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1114;border:1px solid #3d1a24;border-radius:8px;margin-bottom:20px;">
                      <tr>
                        <td style="padding:13px 15px;">
                          <p style="margin:0;font-size:13px;color:#c07070;line-height:1.55;"><strong style="color:#e08888;">⚠ Security alert:</strong>&nbsp; If you don't recognise <strong>${invitedByUsername}</strong> or weren't expecting this invite, please ignore this email.</p>
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
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">Click the button above or paste the link into your browser to accept.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="color:#667eea;font-size:12px;padding-right:10px;vertical-align:top;padding-top:2px;">→</td>
                              <td style="font-size:13px;color:#8888a8;line-height:1.55;">This invitation link will expire — accept it promptly.</td>
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
                          <p style="margin:0;font-size:12px;color:#4a4a6a;line-height:1.65;">You received this because someone invited you to a school on Teacher's Aid.<br/><a href="https://teachersaid.tech" style="color:#667eea;text-decoration:none;">teachersaid.tech</a> &nbsp;·&nbsp; <a href="mailto:support@teachersaid.tech" style="color:#667eea;text-decoration:none;">support@teachersaid.tech</a></p>
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
    text: `${invitedByUsername} (${invitedByEmail}) has invited you to join ${teamName} on Teacher's Aid.\n\nAccept your invitation:\n${inviteLink}\n\n⚠ If you don't recognise ${invitedByUsername} or weren't expecting this, please ignore this email.\n\nteachersaid.tech · support@teachersaid.tech`,
  });
}
