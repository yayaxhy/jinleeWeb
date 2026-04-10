"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';

type BindWechatResponse = {
  ok: boolean;
  bound?: boolean;
  canUnbind?: boolean;
  wechatDisplayName?: string | null;
  qrCodeDataUrl?: string;
  urlLink?: string;
  expiresAt?: string;
  error?: string;
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

const extractMessage = (payload?: { error?: string } | null) => {
  switch (payload?.error) {
    case 'unauthorized':
      return '当前登录态无效，请重新登录后再试。';
    case 'unsupported_session_source':
      return '当前页面只支持网站端发起绑定微信。';
    case 'jinlee_user_not_found':
      return '当前账号未找到，请重新登录后再试。';
    case 'last_login_method_forbidden':
      return '至少还要保留一种登录方式，不能解绑最后一个渠道。';
    case 'channel_not_bound':
      return '当前账号还没有绑定微信。';
    case 'bind_failed':
      return '绑定二维码生成失败，请稍后再试。';
    case 'unbind_failed':
      return '解绑失败，请稍后再试。';
    default:
      return payload?.error ?? '操作失败，请稍后再试。';
  }
};

export default function BindWechatClient() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [bound, setBound] = useState(false);
  const [canUnbind, setCanUnbind] = useState(false);
  const [wechatDisplayName, setWechatDisplayName] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [urlLink, setUrlLink] = useState('');
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
          setNotice(error instanceof Error ? error.message : '绑定状态加载失败。');
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
          setNotice('微信已绑定成功。');
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
      setNotice(error instanceof Error ? error.message : '二维码生成失败。');
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

      setNotice('微信渠道已解绑，资产保持不变。');
      setNoticeLevel('success');
      await loadStatus();
      await generateQrCode();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '解绑失败。');
      setNoticeLevel('error');
    } finally {
      setUnbinding(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_10px_30px_rgba(17,24,39,0.04)] space-y-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.45em] text-gray-400">Bind WeChat</p>
            <h1 className="text-3xl font-semibold tracking-wide text-[#8a6000]">网站端绑定微信</h1>
            <p className="text-sm leading-7 text-gray-500">
              网站会生成一个二维码。你用微信扫一扫后会直接打开小程序绑定页，确认后当前网站账号和微信账号会合并成同一个
              Jinlee 业务用户。
            </p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-[#f8fafc] px-6 py-12 text-center text-sm text-gray-500">
              正在同步绑定状态...
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5 rounded-3xl border border-black/5 bg-[#fff9e8] p-6">
                <div className="space-y-2">
                  <div className="text-lg font-semibold text-[#8a6000]">
                    {bound ? '当前已绑定微信' : '当前未绑定微信'}
                  </div>
                  <p className="text-sm leading-7 text-gray-600">
                    {bound
                      ? `已绑定微信${wechatDisplayName ? `：${wechatDisplayName}` : '，如果需要可直接解绑渠道，资产不会拆分。'}`
                      : '扫描右侧二维码后，小程序会自动确认当前微信账号并完成绑定。'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.35em] text-gray-400">渠道状态</div>
                    <div className="mt-2 text-xl font-semibold text-[#171717]">{bound ? '已绑定' : '未绑定'}</div>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.35em] text-gray-400">二维码有效期</div>
                    <div className="mt-2 text-base font-medium text-[#171717]">{expiresAt || '生成后显示'}</div>
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
                      {generating ? '生成中...' : '重新生成二维码'}
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-6 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={handleUnbind}
                      disabled={!canUnbind || unbinding}
                    >
                      {unbinding ? '解绑中...' : '解绑微信'}
                    </button>
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
                    {notice}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-black/5 bg-[#f8fafc] p-6 text-center space-y-4">
                <div className="text-sm font-medium text-gray-500">微信扫一扫</div>
                {bound ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-12 text-sm text-emerald-600">
                    当前账号已经绑定微信，不需要再扫码。
                  </div>
                ) : qrCodeDataUrl ? (
                  <div className="space-y-3">
                    <div className="mx-auto inline-flex rounded-[28px] bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.08)]">
                      <Image
                        src={qrCodeDataUrl}
                        alt="WeChat bind QR"
                        width={240}
                        height={240}
                        unoptimized
                      />
                    </div>
                    <p className="text-xs leading-6 text-gray-500">
                      如果微信无法直接识别二维码，也可以复制下面的链接在手机微信里打开。
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
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-12 text-sm text-gray-500">
                    正在生成二维码...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
