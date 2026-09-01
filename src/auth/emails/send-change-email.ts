import sendEmail from "./email-template";

// Called by better-auth's changeEmail.sendChangeEmailVerification
// Better-auth passes: { user, url, newEmail }

interface EmailChangeData {
  user: {
    name: string;
    email?: string; // current email (send to this address)
  };
  url: string; // confirmation link provided by better-auth
  newEmail?: string; // the new address the user wants to switch to
}

const BRAND = "#2f4858";
const PAGE_BG = "#f4f4f1";
const CARD_BG = "#ffffff";
const BORDER = "#e4e2dd";
const RULE = "#eeece8";
const TEXT = "#1f2328";
const BODY = "#4a5259";
const MUTED = "#8b9199";
const FOOTER = "#6b7280";
const FAINT = "#9aa0a6";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export async function sendEmailChange({ user, url, newEmail }: EmailChangeData) {
  if (!user.email) {
    throw new Error("User email is required for email change");
  }

  const greeting = user.name ? `Hi ${user.name},` : "Hi there,";
  const newEmailLine = newEmail
    ? `You requested to change your email address to <strong style="font-weight:500;color:${TEXT};">${newEmail}</strong>.`
    : "You requested to change your email address.";

  await sendEmail({
    to: user.email,
    subject: "Approve your email change",
    html: `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
        <title>Approve your email change</title>
        <!--[if mso]>
        <style type="text/css">
          body, table, td, p, h1 { font-family: Arial, Helvetica, sans-serif !important; }
        </style>
        <![endif]-->
      </head>
      <body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:${SANS};-webkit-font-smoothing:antialiased;color:${TEXT};">

        <div style="display:none;font-size:1px;color:${PAGE_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Approve your Teacher's Aid email change${newEmail ? ` to ${newEmail}` : ""}.</div>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${PAGE_BG};padding:40px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="520" style="max-width:520px;background-color:${CARD_BG};border-radius:8px;border:1px solid ${BORDER};">

                <!-- Wordmark -->
                <tr>
                  <td style="padding:36px 40px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width:26px;height:26px;background-color:${BRAND};border-radius:5px;text-align:center;vertical-align:middle;font-size:13px;font-weight:bold;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">T</td>
                        <td style="padding-left:9px;font-size:14px;font-weight:500;color:${BRAND};letter-spacing:0.2px;">Teacher's Aid</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:30px 40px 0;">
                    <h1 style="margin:0 0 16px;font-size:19px;font-weight:500;color:${TEXT};line-height:1.35;">Approve your email change</h1>
                    <p style="margin:0 0 8px;font-size:15px;color:${BODY};line-height:1.6;">${greeting}</p>
                    <p style="margin:0 0 26px;font-size:15px;color:${BODY};line-height:1.6;">${newEmailLine}</p>

                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;">
                      <tr>
                        <td style="background-color:${BRAND};border-radius:6px;">
                          <a href="${url}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;">Approve email change</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 30px;font-size:13px;color:${MUTED};line-height:1.6;">This link expires in 10 minutes. If the button doesn't work, paste this into your browser:<br /><a href="${url}" style="color:${FOOTER};text-decoration:underline;word-break:break-all;">${url}</a></p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:0 40px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid ${RULE};">
                      <tr>
                        <td style="padding-top:20px;">
                          <p style="margin:0 0 12px;font-size:13px;color:${FOOTER};line-height:1.6;">Didn't request this? You can safely ignore this email — your email address won't change.</p>
                          <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6;">Teacher's Aid &nbsp;·&nbsp; <a href="https://teachersaid.tech" style="color:${FOOTER};text-decoration:underline;">teachersaid.tech</a> &nbsp;·&nbsp; <a href="mailto:support@teachersaid.tech" style="color:${FOOTER};text-decoration:underline;">support@teachersaid.tech</a></p>
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
    text: [
      greeting,
      "",
      newEmail
        ? `You requested to change your email address to ${newEmail}.`
        : "You requested to change your email address.",
      "",
      "Approve the change here:",
      url,
      "",
      "This link expires in 10 minutes.",
      "",
      "Didn't request this? You can safely ignore this email — your email address won't change.",
      "",
      "Teacher's Aid · teachersaid.tech · support@teachersaid.tech",
    ].join("\n"),
  });
}
