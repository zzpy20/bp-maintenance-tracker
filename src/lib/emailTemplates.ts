import type { IssueDetail } from './api'
import { fmtCurrency } from './utils'

function property(i: IssueDetail) {
  return [i.property_ref, i.property_address, i.property_suburb].filter(Boolean).join(', ')
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export type EmailTemplate = {
  key: string
  label: string
  subject: (i: IssueDetail) => string
  body: (i: IssueDetail) => string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'request-quote',
    label: 'Request quote from supplier',
    subject: i => `Quote Request – ${i.title} – ${i.property_address}`,
    body: i => `Hi ${i.supplier_name ?? 'there'},

Could you please provide a quote for the following maintenance issue:

Issue: ${i.title}${i.description ? `\nDetails: ${stripHtml(i.description)}` : ''}
Property: ${property(i)}
Tenant: ${[i.tenant_name, i.tenant_phone].filter(Boolean).join(' – ') || 'Please contact us to arrange access'}

Please contact the tenant directly to arrange access and forward your quote at your earliest convenience.

Thank you`,
  },
  {
    key: 'chase-quote',
    label: 'Follow up on quote (supplier)',
    subject: i => `Following Up – Quote for ${i.title} – ${i.property_address}`,
    body: i => `Hi ${i.supplier_name ?? 'there'},

I wanted to follow up on my earlier request for a quote regarding the following:

Issue: ${i.title}
Property: ${property(i)}

Could you please provide the quote at your earliest convenience?

Thank you`,
  },
  {
    key: 'owner-approval',
    label: 'Send quote to owner for approval',
    subject: i => `Quote for Approval – ${i.title} – ${property(i)}`,
    body: i => {
      const q = i.quotes?.[0]
      return `Hi ${i.owner_name ?? 'there'},

We have received a quote for maintenance work at your property and would like your approval to proceed.

Property: ${property(i)}
Issue: ${i.title}${q ? `\nSupplier: ${q.supplier_name ?? i.supplier_name ?? ''}` : ''}${q?.amount != null ? `\nQuote amount: ${fmtCurrency(q.amount)}` : ''}

Could you please review and confirm whether you would like to proceed?

Thank you`
    },
  },
  {
    key: 'chase-owner',
    label: 'Follow up on owner approval',
    subject: i => `Following Up – Approval Required – ${i.title} – ${i.property_address}`,
    body: i => {
      const q = i.quotes?.[0]
      return `Hi ${i.owner_name ?? 'there'},

I'm following up on my earlier email regarding approval for maintenance work at your property.

Property: ${property(i)}
Issue: ${i.title}${q?.amount != null ? `\nQuote amount: ${fmtCurrency(q.amount)}` : ''}

Your approval is needed before we can proceed with the repair. Could you please advise at your earliest convenience?

Thank you`
    },
  },
  {
    key: 'notify-tenant',
    label: 'Notify tenant of upcoming work',
    subject: i => `Maintenance Work Scheduled – ${i.property_address}`,
    body: i => `Hi ${i.tenant_name ?? 'there'},

I wanted to let you know that we have arranged for ${i.supplier_name ?? 'a tradesperson'} to attend your property to carry out the following maintenance work:

${i.title}

Please ensure access is available on the scheduled date. You will be contacted directly to confirm the appointment time.

If you have any questions, please don't hesitate to get in touch.

Thank you`,
  },
]
