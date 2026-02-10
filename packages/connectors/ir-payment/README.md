# @asdev/connector-ir-payment

Zarinpal-first payment connector for invoice creation.

- Operation: `createInvoice`
- Input: `{ amount, description?, meta? }`
- Output: `{ provider, invoiceId, payUrl, fee }`
- Supports mock mode when merchant ID is not configured.
