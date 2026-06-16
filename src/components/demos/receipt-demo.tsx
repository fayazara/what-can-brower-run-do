import { useEffect, useRef, useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { Download, FileText, Plus, ReceiptText, Trash2 } from "lucide-react"

type Item = { name: string; qty: number; price: number }

const STARTER_ITEMS: Array<Item> = [
  { name: "Cold Brew", qty: 2, price: 4.5 },
  { name: "Almond Croissant", qty: 1, price: 3.75 },
  { name: "Sticker pack", qty: 3, price: 2.0 },
]

export function ReceiptDemo() {
  const [storeName, setStoreName] = useState("The Agentic Coffee House")
  const [cashier, setCashier] = useState("Fayaz Ahmed")
  const [note, setNote] = useState("Thanks for stopping by!")
  const [items, setItems] = useState<Array<Item>>(STARTER_ITEMS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const lastObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current)
    }
  }, [])

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0)
  const total = subtotal * 1.0825

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    )
  }

  function addItem() {
    setItems((prev) => [...prev, { name: "", qty: 1, price: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeName,
          cashier,
          note,
          items: items.filter((i) => i.name.trim().length > 0),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      const blob = await res.blob()
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current)
      const objectUrl = URL.createObjectURL(blob)
      lastObjectUrl.current = objectUrl
      setPdfUrl(objectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setPdfUrl(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={generate}
        className="rounded-xl bg-kumo-base p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-kumo-hairline"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Store name">
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Cashier">
            <input
              value={cashier}
              onChange={(e) => setCashier(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="block text-sm font-medium text-kumo-default">
            Line items
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  placeholder="Item"
                  className={`${inputClass} flex-1`}
                />
                <input
                  aria-label="Quantity"
                  min={1}
                  value={item.qty}
                  onChange={(e) =>
                    updateItem(i, { qty: Number(e.target.value) || 1 })
                  }
                  className={`${inputClass} w-16 text-center tnum`}
                />
                <input
                  aria-label="Price"
                  min={0}
                  step="0.01"
                  value={item.price}
                  onChange={(e) =>
                    updateItem(i, { price: Number(e.target.value) || 0 })
                  }
                  className={`${inputClass} w-24 text-right tnum`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="Remove item"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-kumo-subtle transition-colors hover:bg-red-50 hover:text-red-600 active:scale-[0.96]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-default active:scale-[0.96]"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </div>

        <div className="mt-4">
          <Field label="Footer note">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-kumo-hairline pt-4">
          <div className="text-sm text-kumo-subtle">
            Estimated total{" "}
            <span className="tnum ml-1 text-base font-semibold text-kumo-default">
              ${total.toFixed(2)}
            </span>
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading || items.every((i) => !i.name.trim())}
          >
            <ReceiptText className="h-4 w-4" />
            {loading ? "Printing…" : "Print receipt"}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-3 text-kumo-subtle">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-emerald-500" />
            <span className="text-sm">Rendering your PDF…</span>
          </div>
        </div>
      ) : pdfUrl ? (
        <div className="flex flex-col gap-3">
          <iframe
            src={pdfUrl}
            title="Receipt PDF preview"
            className="h-[480px] w-full rounded-xl bg-kumo-base ring-1 ring-kumo-hairline"
          />
          <a
            href={pdfUrl}
            download="receipt.pdf"
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-default active:scale-[0.96]"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <FileText className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Your receipt PDF will appear here</span>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  "min-w-0 rounded-xl bg-kumo-tint px-3.5 py-2.5 text-sm text-kumo-default ring-1 ring-kumo-hairline outline-none transition-[box-shadow,background-color] placeholder:text-kumo-subtle focus:bg-kumo-base focus:ring-2 focus:ring-emerald-400"

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-kumo-default">{label}</span>
      {children}
    </label>
  )
}
