import { escapeHtml, validateTitle } from './validate'
import { isValidUlid } from './ulid'

export const PUBLIC_ORIGIN = 'https://grouppayback.com'
export const FROM_EMAIL = 'no-reply@grouppayback.com'
export function buildShareUrl(id: string): string {
  if (!isValidUlid(id)) throw new Error('INVALID_LIST_ID')
  return `${PUBLIC_ORIGIN}/?u=${id.toUpperCase()}`
}
export function buildSaveEmail(input: { title: string; id: string }) {
  const title = validateTitle(input.title)
  const escaped = escapeHtml(title)
  const url = buildShareUrl(input.id)
  return {
    subject: `Your GroupPayback link for "${title.length > 60 ? title.slice(0, 60) + '…' : title}"`,
    text: `Your event is saved.

Here’s your shared link. Keep this email so you can return to your event whenever you need it.

${title}
${url}

Anyone with this link can view and edit the event. Share it only with people you trust.

You’re getting this one-time email because you saved an event on grouppayback.com. It’s just a record of your link. No newsletters, no account, nothing to verify.

Please don’t reply to this automated email.`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f7f9;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><div style="display:none;font-size:1px;line-height:1px;color:#f6f7f9;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Keep this email for your ${escaped} event link. No account or verification needed.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f6f7f9;"><tr><td align="center" style="padding:0 16px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 28px 0;font-size:17px;line-height:24px;letter-spacing:-.45px;font-weight:700;color:#111827;">GroupPayback</td></tr>
<tr><td style="padding:32px 28px 0;"><h1 style="font-size:28px;line-height:1.2;letter-spacing:-.8px;font-weight:650;color:#111827;margin:0 0 16px;">Your event is saved.</h1><p style="font-size:15px;line-height:1.75;color:#4b5563;margin:0;">Here’s your shared link. Keep this email so you can return to your event whenever you need it.</p></td></tr>
<tr><td style="padding:28px 28px 0;"><p style="font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin:0 0 7px;">Your event</p><p style="font-size:20px;line-height:28px;letter-spacing:-.3px;color:#374151;font-weight:600;margin:0;">${escaped}</p></td></tr>
<tr><td style="padding:22px 28px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" bgcolor="#2563eb" style="background:#2563eb;border-radius:7px;"><a href="${url}" style="display:inline-block;padding:14px 23px;border:1px solid #2563eb;border-radius:7px;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;color:#fff;">Open your event</a></td></tr></table>
</td></tr>
<tr><td style="padding:22px 28px 0;"><p style="font-size:12px;line-height:20px;color:#6b7280;margin:0 0 6px;">Or copy and paste this link into your browser:</p><p style="font-size:12px;line-height:21px;margin:0;overflow-wrap:anywhere;word-break:break-all;"><a href="${url}" style="color:#1d4ed8;text-decoration:underline;">${url}</a></p></td></tr>
<tr><td style="padding:28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-top:1px solid #e5e7eb;padding-top:20px;"><p style="font-size:12px;line-height:20px;color:#4b5563;margin:0;">Anyone with this link can view and edit the event.<br>Share it only with people you trust.</p></td></tr></table></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;border-collapse:collapse;"><tr><td style="padding:24px 12px 0;"><p style="font-size:12px;line-height:20px;color:#6b7280;margin:0;">You’re getting this one-time email because you saved an event on grouppayback.com. It’s just a record of your link.</p><p style="font-size:12px;line-height:20px;color:#4b5563;margin:10px 0 0;">No newsletters, no account, nothing to verify.</p><p style="font-size:11px;line-height:18px;color:#6b7280;margin:18px 0 0;">Please don’t reply to this automated email.</p></td></tr></table>
</td></tr></table>
</body></html>
`
  }
}
