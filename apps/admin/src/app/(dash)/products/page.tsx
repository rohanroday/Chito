'use client';

import { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { imageUrl, rupees, toPaise, toRupees } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import { uploadProductPhoto } from '@/lib/upload';

type Draft = { price: string; mrp: string; stock: string; maxPerOrder: string; category: string; isActive: boolean };
const toDraft = (p: Product): Draft => ({
  price: String(toRupees(p.price)),
  mrp: String(toRupees(p.mrp)),
  stock: String(p.stock),
  maxPerOrder: String(p.maxPerOrder),
  category: p.category,
  isActive: p.isActive,
});

const input = 'h-9 w-20 rounded-lg border border-line bg-white px-2 text-right';

/** Pill switch: green "Visible" / grey "Hidden". Clearer than a tiny checkbox. */
function VisibilityToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Visible in app, click to hide' : 'Hidden from app, click to show'}
      onClick={() => onChange(!on)}
      title={on ? 'Customers can see and buy this. Click to hide it.' : 'Customers can’t see this. Click to show it.'}
      className="group inline-flex items-center gap-2.5 text-left">
      {/* A real on/off switch: green and knob right = shown in the app */}
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-leaf' : 'bg-subtle/60'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className={`whitespace-nowrap text-xs font-bold ${on ? 'text-leaf' : 'text-muted'}`}>{on ? 'Shown' : 'Hidden'}</span>
    </button>
  );
}

function Row({ p, categories, onSaved }: { p: Product; categories: Category[]; onSaved: (p: Product) => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(p));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(p));
  const low = p.stock <= p.lowStockThreshold;
  const invalid = !(Number(d.price) >= 0 && Number(d.mrp) >= Number(d.price) && Number.isInteger(Number(d.stock)) && Number(d.stock) >= 0 && Number(d.maxPerOrder) >= 1);

  async function save() {
    setState('saving');
    try {
      const updated = await api<Product>(`/admin/products/${p.id}`, {
        method: 'PATCH',
        body: {
          price: toPaise(Number(d.price)),
          mrp: toPaise(Number(d.mrp)),
          stock: Number(d.stock),
          maxPerOrder: Number(d.maxPerOrder),
          category: d.category,
          isActive: d.isActive,
        },
      });
      onSaved(updated);
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
      setState('error');
    }
  }

  return (
    <tr className={low && p.isActive ? 'bg-gold-50' : ''}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit already resizes */}
          <img src={imageUrl(p.images[0], 80)} alt="" className={`h-10 w-10 rounded bg-white object-contain ${d.isActive ? '' : 'grayscale'}`} />
          <div>
            <div className="font-semibold">
              {p.name}
              {!p.isActive && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-[11px] font-bold uppercase text-muted">Hidden</span>}
            </div>
            <div className="text-xs text-muted">
              {p.unit}
              {low && p.isActive && <span className="ml-2 font-bold text-saffron">Low stock</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <select aria-label="Category" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className="h-9 max-w-40 rounded-lg border border-line bg-white px-2 text-sm">
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        ₹ <input aria-label="Selling price" inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} className={input} />
      </td>
      <td className="px-3 py-2">
        ₹ <input aria-label="MRP" inputMode="decimal" value={d.mrp} onChange={(e) => setD({ ...d, mrp: e.target.value })} className={input} />
      </td>
      <td className="px-3 py-2">
        <input aria-label="Stock" inputMode="numeric" value={d.stock} onChange={(e) => setD({ ...d, stock: e.target.value })} className={input} />
      </td>
      <td className="px-3 py-2">
        <input aria-label="Max per order" inputMode="numeric" value={d.maxPerOrder} onChange={(e) => setD({ ...d, maxPerOrder: e.target.value })} className={`${input} w-14`} />
      </td>
      <td className="px-3 py-2 text-center">
        <VisibilityToggle on={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} />
      </td>
      <td className="w-36 px-3 py-2 text-right">
        {/* Save only appears when something changed — no permanently disabled grey buttons */}
        {state === 'saved' ? (
          <span className="font-bold text-leaf">Saved ✓</span>
        ) : dirty ? (
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setD(toDraft(p))} className="text-xs font-semibold text-muted hover:underline">
              Undo
            </button>
            <button
              type="button"
              disabled={invalid || state === 'saving'}
              onClick={save}
              title={invalid ? 'Check the numbers (MRP must be ≥ price)' : undefined}
              className="h-9 rounded-lg bg-maroon px-4 text-sm font-bold text-gold shadow-sm hover:bg-maroon-700 disabled:cursor-not-allowed disabled:opacity-50">
              {state === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : null}
        {state === 'error' && <div className="text-xs text-vermilion">{msg}</div>}
        {invalid && dirty && <div className="text-xs text-vermilion">MRP must be ≥ price</div>}
      </td>
    </tr>
  );
}

const emptyForm = { name: '', category: '', unit: '', mrp: '', price: '', stock: '20', maxPerOrder: '10', altNames: '', isActive: true };

function AddProduct({ categories, onAdded, onClose }: { categories: Category[]; onAdded: (p: Product) => void; onClose: () => void }) {
  const [f, setF] = useState({ ...emptyForm, category: categories[0]?.slug ?? '' });
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const field = 'mt-1 h-10 w-full rounded-lg border border-line bg-white px-3';

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const path = await uploadProductPhoto(file);
      setPhoto({ path, preview: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(f.price) > Number(f.mrp)) return setError('Selling price can’t be more than MRP');
    setBusy(true);
    setError('');
    try {
      const p = await api<Product>('/admin/products', {
        method: 'POST',
        body: {
          name: f.name.trim(),
          category: f.category,
          unit: f.unit.trim(),
          mrp: toPaise(Number(f.mrp)),
          price: toPaise(Number(f.price)),
          stock: Number(f.stock),
          maxPerOrder: Number(f.maxPerOrder),
          altNames: f.altNames.split(',').map((s) => s.trim()).filter(Boolean),
          images: photo ? [photo.path] : [],
          isActive: f.isActive,
        },
      });
      onAdded(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add product');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-maroon bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl text-maroon">Add a product</h2>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:underline">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr]">
        <label className="flex h-36 w-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-white text-center text-xs text-muted hover:border-maroon">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
            <img src={photo.preview} alt="" className="h-full w-full rounded-xl object-contain" />
          ) : uploading ? (
            'Uploading…'
          ) : (
            <>
              <span className="text-2xl">📷</span>
              Add photo
              <br />
              (JPG/PNG, max 5 MB)
            </>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="hidden" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold sm:col-span-2">
            Product name *
            <input required minLength={2} value={f.name} onChange={set('name')} placeholder="e.g. Local Churpi" className={field} />
          </label>
          <label className="text-sm font-semibold">
            Category *
            <select required value={f.category} onChange={set('category')} className={field}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pack size *
            <input required value={f.unit} onChange={set('unit')} placeholder="e.g. 200 g, 1 L, 6 pcs" className={field} />
          </label>
          <label className="text-sm font-semibold">
            MRP (₹) *
            <input required type="number" min="0" step="0.5" value={f.mrp} onChange={set('mrp')} className={field} />
          </label>
          <label className="text-sm font-semibold">
            Selling price (₹) *
            <input required type="number" min="0" step="0.5" value={f.price} onChange={set('price')} className={field} />
          </label>
          <label className="text-sm font-semibold">
            Stock *
            <input required type="number" min="0" step="1" value={f.stock} onChange={set('stock')} className={field} />
          </label>
          <label className="text-sm font-semibold">
            Max per order
            <input type="number" min="1" max="50" step="1" value={f.maxPerOrder} onChange={set('maxPerOrder')} className={field} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
            Local / search names <span className="font-normal text-muted">(comma separated)</span>
            <input value={f.altNames} onChange={set('altNames')} placeholder="e.g. churpi, durkha, cheese" className={field} />
          </label>
          <div className="flex items-end">
            <VisibilityToggle on={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} />
          </div>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-vermilion-50 px-3 py-2 text-sm font-semibold text-vermilion">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button disabled={busy || uploading} className="h-10 rounded-lg bg-maroon px-5 font-bold text-gold hover:bg-maroon-700 disabled:opacity-50">
          {busy ? 'Adding…' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [filter, setFilter] = useState<'all' | 'low' | 'hidden'>('all');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api<Product[]>('/admin/products'), api<Category[]>('/admin/categories')])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (cat === 'all' || p.category === cat) &&
        (filter === 'all' || (filter === 'low' ? p.stock <= p.lowStockThreshold : !p.isActive)) &&
        (!s || p.name.toLowerCase().includes(s) || p.altNames?.some((a) => a.toLowerCase().includes(s))),
    );
  }, [products, q, cat, filter]);

  const groups = categories.map((c) => ({ c, items: shown.filter((p) => p.category === c.slug) })).filter((g) => g.items.length);
  const onSaved = (u: Product) => setProducts((ps) => ps?.map((p) => (p.id === u.id ? u : p)) ?? null);
  const hiddenCount = (products ?? []).filter((p) => !p.isActive).length;

  return (
    <div className="max-w-7xl">
      <div className="mb-1 flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-maroon">Products</h1>
        {!adding && (
          <button onClick={() => setAdding(true)} className="h-10 rounded-lg bg-maroon px-4 font-bold text-gold hover:bg-maroon-700">
            + Add product
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
        Prices are in rupees. Changes show in the customer app on its next refresh. “Hidden” products stay here but don’t appear in the app.
        {products && ` ${products.length} products (${hiddenCount} hidden), stock value ${rupees(products.reduce((s, p) => s + p.price * p.stock, 0))}.`}
      </p>
      {notice && <p className="mb-3 rounded-lg bg-leaf-50 p-3 font-semibold text-leaf">{notice}</p>}
      {adding && (
        <AddProduct
          categories={categories}
          onClose={() => setAdding(false)}
          onAdded={(p) => {
            setProducts((ps) => [p, ...(ps ?? [])]);
            setAdding(false);
            setNotice(`Added “${p.name}”${p.isActive ? '. It shows in the app on its next refresh.' : ' as hidden.'}`);
            setTimeout(() => setNotice(''), 5000);
          }}
        />
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-10 w-64 rounded-lg border border-line bg-white px-3" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-line bg-white text-sm font-semibold">
          {(['all', 'low', 'hidden'] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`h-10 px-3 ${filter === k ? 'bg-maroon text-gold' : 'text-ink hover:bg-sand'}`}>
              {k === 'all' ? 'All' : k === 'low' ? 'Low stock' : 'Hidden'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}
      {products === null && !error && <p className="text-muted">Loading products…</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">MRP</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Max/order</th>
              <th className="px-3 py-2 text-center">In app</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.c.slug} className="divide-y divide-line">
              <tr className="bg-maroon-50">
                <td colSpan={8} className="px-3 py-1.5 font-display text-maroon">
                  {g.c.name} <span className="font-sans text-xs text-muted">· {g.items.length}</span>
                  {!g.c.isActive && <span className="ml-2 font-sans text-xs font-bold uppercase text-muted">(category hidden)</span>}
                </td>
              </tr>
              {g.items.map((p) => (
                <Row key={p.id} p={p} categories={categories} onSaved={onSaved} />
              ))}
            </tbody>
          ))}
        </table>
        {products && groups.length === 0 && <p className="p-6 text-center text-muted">No products match.</p>}
      </div>
    </div>
  );
}
