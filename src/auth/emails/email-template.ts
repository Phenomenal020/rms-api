import { Resend } from "resend";

interface EmailTemplateParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export default async function emailTemplate({
  from,
  to,
  subject,
  text,
  html,
}: EmailTemplateParams) {
  const resend = new Resend(process.env.RESEND_API_KEY!);

  try {
    const response = await resend.emails.send({
      from: from || "Teacher's Aid <email-verification@teachersaid.tech>",
      to: to,
      subject: subject,
      text: text || "",
      html: html || text || "",
    });
    return response;
  } catch (error) {
    console.error(error);  // Todo: Use nestjs logger
    throw error;
  }
}