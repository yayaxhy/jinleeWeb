"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import Image from 'next/image';
import { useEffect, useState } from 'react';

type BindWechatResponse = {
  ok: boolean;
  bound?: boolean;
  canUnbind?: boolean;
  wechatDisplayName?: string | null;
  qrCodeDataUrl?: string;
  urlLink?: string;
  fallbackMode?: 'manual_code' | 'mini_program_code';
  bindToken?: string;
  warning?: string;
  expiresAt?: string;
  error?: string;
  message?: string;
};

const pollIntervalMs = 5000;

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
};

const formatBindToken = (value?: string) => {
  if (!value) return '';
  return value.match(/.{1,4}/g)?.join(' ') ?? value;
};

const extractMessage = (payload?: { error?: string; message?: string } | null) => {
  const detail = payload?.message?.trim();

  switch (payload?.error) {
    case 'unauthorized':
      return '当前登录态无效，请重新登录后再试。';
    case 'unsupported_session_source':
      return '当前页面只支持网站端发起绑定微信。';
    case 'dlm_user_not_found':
      return '当前账号未找到，请重新登录后再试。';
    case 'bind_token_secret_missing':
      return '网站绑定配置缺失，请联系管理员检查登录密钥配置。';
    case 'wechat_config_missing':
      return '网站端尚未完成微信小程序配置，请联系管理员。';
    case 'wechat_access_token_http_error':
    case 'wechat_access_token_failed':
      return detail ? `获取微信接口凭证失败：${detail}` : '获取微信接口凭证失败，请稍后再试。';
    case 'wechat_generate_urllink_http_error':
    case 'wechat_generate_urllink_failed':
      return detail
        ? `微信绑定链接生成失败：${detail}`
        : '微信绑定链接生成失败，请联系管理员检查小程序路径与环境配置。';
    case 'wechat_generate_wxacode_http_error':
    case 'wechat_generate_wxacode_failed':
      return detail ? `微信小程序码生成失败：${detail}` : '微信小程序码生成失败，请稍后再试。';
    case 'last_login_method_forbidden':
      return '至少还要保留一种登录方式，不能解绑最后一个渠道。';
    case 'channel_not_bound':
      return '当前账号还没有绑定微信。';
    case 'bind_failed':
      return '绑定二维码生成失败，请稍后再试。';
    case 'unbind_failed':
      return '解绑失败，请稍后再试。';
    default:
      return detail ?? payload?.error ?? '操作失败，请稍后再试。';
  }
};

export default function BindWechatClient() {
  const siteCopy = useSiteCopy();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [bound, setBound] = useState(false);
  const [canUnbind, setCanUnbind] = useState(false);
  const [wechatDisplayName, setWechatDisplayName] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [urlLink, setUrlLink] = useState('');
  const [fallbackMode, setFallbackMode] = useState<'manual_code' | 'mini_program_code' | null>(null);
  const [bindToken, setBindToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeLevel, setNoticeLevel] = useState<'success' | 'error'>('success');

  const loadStatus = async (preserveNotice = true) => {
    const response = await fetch('/api/wechat/bind', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as BindWechatResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(extractMessage(payload));
    }

    setBound(Boolean(payload.bound));
    setCanUnbind(Boolean(payload.canUnbind));
    setWechatDisplayName(payload.wechatDisplayName ?? null);

    if (payload.bound) {
      setQrCodeDataUrl('');
      setUrlLink('');
      setFallbackMode(null);
      setBindToken('');
      setExpiresAt('');
      if (!preserveNotice) {
        setNotice('');
      }
    }

    return payload;
  };

  const generateQrCode = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/wechat/bind', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as BindWechatResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(extractMessage(payload));
      }

      setBound(Boolean(payload.bound));
      setCanUnbind(Boolean(payload.canUnbind));
      setWechatDisplayName(payload.wechatDisplayName ?? null);
      setQrCodeDataUrl(payload.qrCodeDataUrl ?? '');
      setUrlLink(payload.urlLink ?? '');
      setFallbackMode(payload.fallbackMode ?? null);
      setBindToken(payload.bindToken ?? '');
      setExpiresAt(formatDateTime(payload.expiresAt));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const status = await loadStatus(false);
        if (!cancelled && !status.bound) {
          await generateQrCode();
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.70ef99b814f2"));
          setNoticeLevel('error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bound) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const status = await loadStatus();
        if (status.bound) {
          setNotice(siteCopy("site.app.accounts.wechat.bind.bindwechatclient.ce7ab931f04a"));
          setNoticeLevel('success');
        }
      } catch {
        // Polling failure should not interrupt the page; the user can refresh manually.
      }
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [bound]);

  const handleRegenerate = async () => {
    setNotice('');
    setNoticeLevel('success');
    try {
      await generateQrCode();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.491485a5068b"));
      setNoticeLevel('error');
    }
  };

  const handleUnbind = async () => {
    if (unbinding) return;

    setUnbinding(true);
    setNotice('');
    try {
      const response = await fetch('/api/app/bindings/wechat', {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(extractMessage(payload));
      }

      setNotice(siteCopy("site.app.accounts.wechat.bind.bindwechatclient.078385a4fe0c"));
      setNoticeLevel('success');
      await loadStatus();
      await generateQrCode();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : siteCopy("site.app.accounts.wechat.bind.bindwechatclient.b7bc66c3b948"));
      setNoticeLevel('error');
    } finally {
      setUnbinding(false);
    }
  };

  const handleCopyBindToken = async () => {
    if (!bindToken || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(bindToken);
      setNotice(siteCopy("site.app.accounts.wechat.bind.bindwechatclient.5c50d2a1c673"));
      setNoticeLevel('success');
    } catch {
      setNotice(siteCopy("site.app.accounts.wechat.bind.bindwechatclient.ea646417f61a"));
      setNoticeLevel('error');
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_10px_30px_rgba(17,24,39,0.04)] space-y-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.45em] text-gray-400"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.85596547efae" /></p>
            <h1 className="text-3xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.a43fbc9984ad" /></h1>
            <p className="text-sm leading-7 text-gray-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.572fbc4e2685" /></p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-[#f8fafc] px-6 py-12 text-center text-sm text-gray-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.55cc8c216144" /></div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5 rounded-3xl border border-black/5 bg-[#fff9e8] p-6">
                <div className="space-y-2">
                  <div className="text-lg font-semibold text-[#8a6000]">
                    {bound ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.d6274c2b7533" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.1a7fb664a490" />}
                  </div>
                  <p className="text-sm leading-7 text-gray-600">
                    {bound ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.b4adad277367" values={{value1: String(wechatDisplayName ? `：${wechatDisplayName}` : '，如果需要可直接解绑渠道，资产不会拆分。')}} /> : fallbackMode === 'manual_code' ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.d0d802fc8a47" /> : fallbackMode === 'mini_program_code' ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.f834bc216f31" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.40fe070f625f" />}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.35em] text-gray-400"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.88965a117581" /></div>
                    <div className="mt-2 text-xl font-semibold text-[#171717]">{bound ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.b3addb5e3f54" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.3bf179d8d045" />}</div>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.35em] text-gray-400"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.f96046ad89f9" /></div>
                    <div className="mt-2 text-base font-medium text-[#171717]">{expiresAt || <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.9b98a53ad926" />}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!bound ? (
                    <button
                      className="inline-flex items-center justify-center rounded-full bg-[#8a6000] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#714e00] disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={handleRegenerate}
                      disabled={generating}
                    >
                      {generating ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.26eab253a08e" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.e7b03c58db34" />}
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-6 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={handleUnbind}
                      disabled={!canUnbind || unbinding}
                    >
                      {unbinding ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.154b0027abbd" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.5fc5e28ee6a9" />}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.35em] text-gray-400"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.72c2ebfbc37f" /></div>
                  {bound ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.e0d20a7a0e48" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.f34c92ef0d86" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.d895a7e54cd3" /></li>
                    </ol>
                  ) : fallbackMode === 'manual_code' ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.fb931fafb133" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.6185219b669e" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.5aca2bf8034d" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.74e465997cb4" /></li>
                    </ol>
                  ) : fallbackMode === 'mini_program_code' ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.d025b3482d75" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.361130c06dd3" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.9accb5e7f3ad" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.27d196ab5973" /></li>
                    </ol>
                  ) : (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.c59d41ebd99b" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.503a188e0317" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.9accb5e7f3ad" /></li>
                      <li><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.27d196ab5973" /></li>
                    </ol>
                  )}
                </div>

                {notice ? (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      noticeLevel === 'error'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <SiteText namespace="site.app.accounts.wechat.bind.bindwechatclient" value={notice} />
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-black/5 bg-[#f8fafc] p-6 text-center space-y-4">
                <div className="text-sm font-medium text-gray-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.7140156d9563" /></div>
                {bound ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-12 text-sm text-emerald-600"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.6856607ceb4a" /></div>
                ) : fallbackMode === 'manual_code' && bindToken ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-left">
                      <div className="text-xs uppercase tracking-[0.3em] text-amber-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.3c2f34d27275" /></div>
                      <div className="mt-3 break-all rounded-xl bg-white px-3 py-3 font-mono text-sm text-[#8a6000]">
                        {formatBindToken(bindToken)}
                      </div>
                    </div>
                    <p className="text-xs leading-6 text-gray-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.fc30db41b09e" /></p>
                    <button
                      type="button"
                      onClick={handleCopyBindToken}
                      className="inline-flex items-center justify-center rounded-full border border-[#8a6000]/20 px-4 py-2 text-xs font-medium text-[#8a6000] transition hover:bg-[#8a6000]/5"
                    ><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.0d776c4be545" /></button>
                  </div>
                ) : qrCodeDataUrl ? (
                  <div className="space-y-3">
                    <div className="mx-auto inline-flex rounded-[28px] bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.08)]">
                      <Image
                        src={qrCodeDataUrl}
                        alt={siteCopy("site.app.accounts.wechat.bind.bindwechatclient.d634221cd4cc")}
                        width={240}
                        height={240}
                        unoptimized
                      />
                    </div>
                    <p className="text-xs leading-6 text-gray-500">
                      {urlLink ? <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.f5a18a88c2c3" /> : <SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.6069a4c1f182" />}
                    </p>
                    {urlLink ? (
                      <a
                        className="block break-all text-xs text-[#8a6000] underline decoration-dotted"
                        href={urlLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {urlLink}
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-12 text-sm text-gray-500"><SiteText copyKey="site.app.accounts.wechat.bind.bindwechatclient.a6631f9f7375" /></div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
