'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";

import { useEffect, useState } from 'react';

type BindingStatus = { bound: boolean; canUnbind: boolean; wechatDisplayName?: string | null };
async function read(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options }); const body = await response.json();
  if (!response.ok || body.ok !== true) throw new Error(body.message ?? body.error ?? '请求未完成，请刷新核实');
  return body;
}
export default function BindWechatClient() {
  const siteCopy = useSiteCopy();
  const [status, setStatus] = useState<BindingStatus | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function load() { try { setStatus(await read('/api/wechat/bind')); setError(''); } catch (e) { setError(e instanceof Error ? e.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.d9f607a20068")); } }
  useEffect(() => { void load(); }, []);
  async function authorize() {
    if (busy) return; setBusy(true); setError('');
    try { const body = await read('/api/wechat/bind/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); window.location.assign(body.authorizeUrl); }
    catch (e) { setError(e instanceof Error ? e.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.e790e4eca3f8")); setBusy(false); }
  }
  async function unbind() {
    if (busy || !window.confirm(siteCopy("site.app.accounts.wechat.bind.bindwechatclient.e6ba5f5cadd6"))) return;
    setBusy(true); setError('');
    try { await read('/api/app/bindings/wechat', { method: 'DELETE' }); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.c5ca3fd0604f")); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900"><div className="mx-auto max-w-2xl space-y-6">
    <nav className="flex flex-wrap gap-4"><a className="text-indigo-700" href="/profile"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.4ab3251af877" /></a><a className="text-indigo-700" href="/accounts/discord/change"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.d769c865e545" /></a></nav>
    <h1 className="text-2xl font-semibold"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.196fd91ec1fa" /></h1>
    {done ? <section role="status" className="rounded-xl bg-green-50 p-5"><p><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.0c8950eecba0" /></p><a className="mt-4 inline-block underline" href="/accounts/discord/login"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.1f39c0d17884" /></a></section> : <>
      {status ? <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"><h2 className="font-semibold">{status.bound ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.853743338c30" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.6b682b6c5c32" />}</h2>
        {status.wechatDisplayName && <p>{status.wechatDisplayName}</p>}
        {status.bound ? <><button disabled={busy || !status.canUnbind} onClick={unbind} className="rounded-lg border border-rose-300 px-5 py-3 text-rose-700 disabled:opacity-40">{busy ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.ce9fd54c50a3" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.581512170a55" />}</button>{!status.canUnbind && <p className="text-sm"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.a76cf59e053d" /></p>}</> : <><button disabled={busy} onClick={authorize} className="rounded-lg bg-indigo-700 px-5 py-3 text-white disabled:opacity-40">{busy ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.fbc713baf5df" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.551f79dfc560" />}</button></>}
      </section> : !error && <p><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.5d54600db306" /></p>}
    </>}
    {error && <section role="alert" className="rounded-xl bg-red-50 p-4 text-red-700"><p><SiteText namespace="site.app.accounts.wechat.bind.bindwechatclient" value={error} /></p><button className="mt-3 underline" disabled={busy} onClick={load}><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.4febfd14555d" /></button></section>}
  </div></main>;
}
