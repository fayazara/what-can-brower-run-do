import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"

/**
 * POST /api/pdf  → receipt payload  → application/pdf
 *
 *   await env.BROWSER.quickAction("pdf", { html })
 *
 * We assemble a little thermal-receipt HTML document on the server, then
 * let Browser Run render it to a real PDF and stream it straight back.
 */
const itemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  qty: z.number().int().min(1).max(999),
  price: z.number().min(0).max(1_000_000),
})

const bodySchema = z.object({
  storeName: z.string().trim().min(1).max(40),
  cashier: z.string().trim().max(40).optional().default(""),
  currency: z.string().trim().max(3).optional().default("$"),
  note: z.string().trim().max(120).optional().default(""),
  items: z.array(itemSchema).min(1).max(20),
})

type Receipt = z.infer<typeof bodySchema>

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildReceiptHtml(r: Receipt): string {
  const money = (n: number) => `${escapeHtml(r.currency)}${n.toFixed(2)}`
  const subtotal = r.items.reduce((sum, i) => sum + i.qty * i.price, 0)
  const tax = subtotal * 0.0825
  const total = subtotal + tax
  const orderNo = Math.floor(100000 + Math.random() * 900000)
  const now = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const rows = r.items
    .map((i) => {
      const line = money(i.qty * i.price)
      const name = escapeHtml(i.name)
      return `<tr>
        <td class="qty">${i.qty}×</td>
        <td class="name">${name}</td>
        <td class="amt">${line}</td>
      </tr>`
    })
    .join("")

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        width: 80mm;
        padding: 10mm 7mm;
        font-family: "Courier New", ui-monospace, monospace;
        color: #111;
        font-size: 12px;
        line-height: 1.5;
        background: #fff;
      }
      .center { text-align: center; }
      .store { font-size: 18px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
      .muted { color: #555; }
      .rule { border: none; border-top: 1px dashed #999; margin: 10px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; vertical-align: top; }
      .qty { width: 30px; color: #555; }
      .amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .totals td { padding: 1px 0; }
      .totals .amt { font-variant-numeric: tabular-nums; }
      .grand td { font-weight: 700; font-size: 14px; padding-top: 4px; }
      .thanks { margin-top: 14px; font-size: 13px; }
      .barcode {
        margin: 12px auto 0;
        height: 38px; width: 80%;
        background: repeating-linear-gradient(90deg, #111 0 2px, #fff 2px 4px, #111 4px 5px, #fff 5px 9px);
      }
      .order { letter-spacing: 2px; }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="store">${escapeHtml(r.storeName)}</div>
      <div class="muted">Powered by Browser Run</div>
    </div>

    <hr class="rule" />

    <div class="muted">Order #<span class="order">${orderNo}</span></div>
    <div class="muted">${escapeHtml(now)}</div>
    ${r.cashier ? `<div class="muted">Cashier: ${escapeHtml(r.cashier)}</div>` : ""}

    <hr class="rule" />

    <table>${rows}</table>

    <hr class="rule" />

    <table class="totals">
      <tr><td>Subtotal</td><td class="amt">${money(subtotal)}</td></tr>
      <tr><td>Tax (8.25%)</td><td class="amt">${money(tax)}</td></tr>
      <tr class="grand"><td>TOTAL</td><td class="amt">${money(total)}</td></tr>
    </table>

    <hr class="rule" />

    <div class="center thanks">${r.note ? escapeHtml(r.note) : "Thank you for your order!"}</div>
    <div class="barcode"></div>
    <div class="center muted" style="margin-top:6px;">* * * * * * * * * *</div>
  </body>
</html>`
}

export const Route = createFileRoute("/api/pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown
        try {
          json = await request.json()
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 })
        }

        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          )
        }

        try {
          const res = await browser.quickAction("pdf", {
            html: buildReceiptHtml(parsed.data),
            pdfOptions: { printBackground: true },
          })

          if (!res.ok) {
            const detail = await res.text().catch(() => "")
            return Response.json(
              { error: `Browser Run returned ${res.status}`, detail },
              { status: 502 },
            )
          }

          return new Response(res.body, {
            headers: {
              "content-type": "application/pdf",
              "cache-control": "no-store",
            },
          })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "PDF failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
