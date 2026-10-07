'use client';

import { ArrowDownToLine, ArrowUpToLine, GripVertical } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';

import { HOME_COUNT, HomePreview } from '@/components/HomePreview';
import { api } from '@/lib/api';
import type { Category, Product } from '@/lib/types';

function CategoryRow({
  c,
  index,
  total,
  dragging,
  highlight,
  onMove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onChange,
  onDelete,
}: {
  c: Category;
  index: number;
  total: number;
  dragging: boolean;
  highlight: boolean;
  onMove: (from: number, to: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  onChange: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const [name, setName] = useState(c.name);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  // Rows are only draggable while the handle is held, so typing in the name box still works
  const [grab, setGrab] = useState(false);
  const dirty = name.trim() !== c.name;

  async function patch(body: Partial<Pick<Category, 'name' | 'isActive'>>) {
    setState('saving');
    setError('');
    try {
      const u = await api<Category>(`/admin/categories/${c.slug}`, { method: 'PATCH', body });
      onChange({ ...c, ...u });
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setState('idle');
    }
  }

  // Type a position (1 = first) and press Enter or click away
  const goTo = (value: string) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return;
    const to = Math.min(total, n) - 1;
    if (to !== index) onMove(index, to);
  };

  const quick = 'flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-maroon hover:border-maroon disabled:opacity-30';
  return (
    <tr
      id={`cat-${c.slug}`}
      draggable={grab}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={() => {
        setGrab(false);
        onDragEnd();
      }}
      className={`transition-colors ${dragging ? 'bg-gold-50 opacity-60' : highlight ? 'bg-gold-50 ring-2 ring-inset ring-gold-deep' : c.isActive ? '' : 'bg-sand/50'}`}>
      <td className="px-2 py-2">
        <span
          onMouseDown={() => setGrab(true)}
          onMouseUp={() => setGrab(false)}
          title="Drag to move"
          aria-hidden
          className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-subtle hover:bg-sand hover:text-maroon active:cursor-grabbing">
          <GripVertical size={18} />
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        <input
          key={index}
          type="number"
          min={1}
          max={total}
          defaultValue={index + 1}
          aria-label={`Position of ${c.name}`}
          title="Type a position and press Enter"
          onKeyDown={(e) => e.key === 'Enter' && goTo(e.currentTarget.value)}
          onBlur={(e) => goTo(e.currentTarget.value)}
          className="h-8 w-14 rounded-lg border border-line bg-white text-center font-bold tabular-nums text-wood [appearance:textfield] focus:border-maroon focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button aria-label={`Move ${c.name} to top`} title="Move to top" disabled={index === 0} onClick={() => onMove(index, 0)} className={quick}>
            <ArrowUpToLine size={15} />
          </button>
          <button
            aria-label={`Move ${c.name} to bottom`}
            title="Move to bottom"
            disabled={index === total - 1}
            onClick={() => onMove(index, total - 1)}
            className={quick}>
            <ArrowDownToLine size={15} />
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-56 rounded-lg border border-line bg-white px-2" />
      </td>
      <td className="px-3 py-2 text-center">{c.productCount}</td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          role="switch"
          aria-checked={c.isActive}
          aria-label={c.isActive ? `${c.name} is shown in the app, click to hide` : `${c.name} is hidden, click to show`}
          onClick={() => patch({ isActive: !c.isActive })}
          className="inline-flex items-center gap-2">
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${c.isActive ? 'bg-leaf' : 'bg-subtle/60'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${c.isActive ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
          <span className={`w-12 text-left text-xs font-bold ${c.isActive ? 'text-leaf' : 'text-muted'}`}>{c.isActive ? 'Shown' : 'Hidden'}</span>
        </button>
      </td>
      <td className="w-44 px-3 py-2 text-right">
        {state === 'saved' ? (
          <span className="font-bold text-leaf">Saved ✓</span>
        ) : dirty ? (
          <button
            disabled={name.trim().length < 2 || state === 'saving'}
            onClick={() => patch({ name: name.trim() })}
            className="h-9 rounded-lg bg-maroon px-4 text-sm font-bold text-gold hover:bg-maroon-700 disabled:opacity-50">
            Save
          </button>
        ) : c.productCount === 0 ? (
          <button onClick={() => onDelete(c)} className="text-sm font-semibold text-vermilion hover:underline">
            Delete
          </button>
        ) : null}
        {error && <div className="text-xs text-vermilion">{error}</div>}
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '' });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  const [picked, setPicked] = useState<string | null>(null);

  const load = () =>
    api<Category[]>('/admin/categories')
      .then((c) => {
        setCats(c);
        setOrderDirty(false);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    // Cover photo per category = its first visible product (same rule as the app)
    api<Product[]>('/admin/products')
      .then((ps) => {
        const m = new Map<string, string>();
        for (const p of ps) if (p.isActive && p.images[0] && !m.has(p.category)) m.set(p.category, p.images[0]);
        setCovers(m);
      })
      .catch(() => undefined);
  }, []);

  /** Clicking a tile in the phone preview points at its row. */
  function pick(slug: string) {
    setPicked(slug);
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setPicked((p) => (p === slug ? null : p)), 1800);
  }

  // The Home grid shows the first 9 *visible* categories; the line goes under the 9th one
  const visibleIdx = (cats ?? []).flatMap((c, i) => (c.isActive ? [i] : []));
  const homeCut = visibleIdx.length > HOME_COUNT ? visibleIdx[HOME_COUNT - 1] : -1;

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(''), 4000);
  }

  function move(from: number, to: number) {
    setCats((cs) => {
      if (!cs) return cs;
      const next = [...cs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setOrderDirty(true);
  }

  async function saveOrder() {
    if (!cats) return;
    setSavingOrder(true);
    try {
      await api('/admin/categories/reorder', { method: 'POST', body: { slugs: cats.map((c) => c.slug) } });
      setOrderDirty(false);
      flash('Order saved. The app shows categories in this order on its next refresh.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save order');
    } finally {
      setSavingOrder(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const c = await api<Category>('/admin/categories', { method: 'POST', body: { name: form.name.trim() } });
      setCats((cs) => [...(cs ?? []), c]);
      setForm({ name: '' });
      flash(`Added “${c.name}”. Add products to it from the Products page.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category');
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete the empty category “${c.name}”?`)) return;
    try {
      await api(`/admin/categories/${c.slug}`, { method: 'DELETE' });
      setCats((cs) => cs?.filter((x) => x.slug !== c.slug) ?? null);
      flash(`Deleted “${c.name}”.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-maroon">Categories</h1>
      <p className="mb-4 text-sm text-muted">
        Set the order customers see: drag a row by its handle, type a position number, or send it to the top or bottom. Then save. Hidden categories, and
        their products, disappear from the app but stay here.
      </p>

      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label className="text-sm font-semibold">
          New category
          <input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Local Specials"
            className="mt-1 block h-10 w-64 rounded-lg border border-line bg-white px-3"
          />
        </label>
        <button className="h-10 rounded-lg bg-maroon px-4 font-bold text-gold hover:bg-maroon-700">+ Add category</button>
      </form>

      {notice && <p className="mb-3 rounded-lg bg-leaf-50 p-3 font-semibold text-leaf">{notice}</p>}
      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}
      {orderDirty && (
        <div className="sticky top-20 z-10 mb-3 flex items-center justify-between rounded-lg border border-gold-deep bg-gold-50 p-3 shadow-sm">
          <span className="font-semibold text-wood">You changed the order.</span>
          <div className="flex gap-2">
            <button onClick={load} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-sand">
              Undo
            </button>
            <button onClick={saveOrder} disabled={savingOrder} className="h-9 rounded-lg bg-maroon px-4 text-sm font-bold text-gold hover:bg-maroon-700 disabled:opacity-50">
              {savingOrder ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </div>
      )}

      {cats === null && !error && <p className="text-muted">Loading…</p>}
      {cats && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 text-center">Position</th>
                <th className="px-2 py-2">Move</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-center">Products</th>
                <th className="px-3 py-2 text-center">In app</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cats.map((c, i) => (
                <Fragment key={c.slug}>
                  <CategoryRow
                    c={c}
                    index={i}
                    total={cats.length}
                    dragging={dragIndex === i}
                    highlight={picked === c.slug}
                    onMove={move}
                    onDragStart={setDragIndex}
                    // Live reorder while dragging, so the row follows the mouse
                    onDragOver={(to) => {
                      if (dragIndex === null || dragIndex === to) return;
                      move(dragIndex, to);
                      setDragIndex(to);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    onChange={(u) => setCats((cs) => cs?.map((x) => (x.slug === u.slug ? u : x)) ?? null)}
                    onDelete={remove}
                  />
                  {i === homeCut && (
                    <tr className="bg-gold-50/70">
                      <td colSpan={7} className="px-3 py-1.5 text-center text-xs font-semibold text-wood">
                        ↑ The first {HOME_COUNT} shown categories above appear on the app&apos;s Home screen
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="xl:sticky xl:top-24">
          <HomePreview categories={cats} covers={covers} onMove={move} onPick={pick} />
        </aside>
        </div>
      )}
    </div>
  );
}
