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
  fallbackMode?: 'manual_code';
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
    case 'jinlee_user_not_found':
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
      if (detail?.toLowerCase().includes('no scheme permission')) {
        return '微信绑定链接生成失败：当前小程序未开通 URL Link / Scheme 权限，请在微信后台开通相应能力。';
      }
      return detail
        ? `微信绑定链接生成失败：${detail}`
        : '微信绑定链接生成失败，请联系管理员检查小程序路径与环境配置。';
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [bound, setBound] = useState(false);
  const [canUnbind, setCanUnbind] = useState(false);
  const [wechatDisplayName, setWechatDisplayName] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [urlLink, setUrlLink] = useState('');
  const [fallbackMode, setFallbackMode] = useState<'manual_code' | null>(null);
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

  const handleCopyBindToken = async () => {
    if (!bindToken || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(bindToken);
      setNotice('绑定码已复制，请在小程序绑定页粘贴使用。');
      setNoticeLevel('success');
    } catch {
      setNotice('绑定码复制失败，请手动复制。');
      setNoticeLevel('error');
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
              当前页面用于把网站账号和微信小程序账号绑定到同一个 Jinlee 业务用户。系统会优先生成微信可识别的绑定二维码；如果
              当前小程序账号没有 URL Link 权限，则会自动切换为手动绑定码模式。
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
                      : fallbackMode === 'manual_code'
                        ? '当前小程序无法直接扫码拉起，请复制右侧绑定码，在手机端打开小程序绑定页后粘贴完成关联。'
                        : '扫描右侧二维码后，会进入微信小程序绑定页；确认后当前网站账号和微信账号会合并成同一个 Jinlee 业务用户。'}
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
                      {generating ? '生成中...' : '重新生成绑定信息'}
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

                <div className="rounded-2xl bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.35em] text-gray-400">详细流程</div>
                  {bound ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li>当前网站账号已经和微信账号完成绑定。</li>
                      <li>后续你可以继续使用网站端或微信小程序登录同一个 Jinlee 用户。</li>
                      <li>如需切换微信账号，可先解绑后重新发起绑定。</li>
                    </ol>
                  ) : fallbackMode === 'manual_code' ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li>点击右侧“复制绑定码”。</li>
                      <li>在手机端打开 Jinlee 微信小程序，进入绑定页。</li>
                      <li>把绑定码粘贴到小程序输入框并确认提交。</li>
                      <li>提交成功后，当前网站账号和微信账号会合并成同一个 Jinlee 业务用户。</li>
                    </ol>
                  ) : (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-600">
                      <li>使用微信扫描右侧二维码。</li>
                      <li>微信会打开 Jinlee 小程序绑定页。</li>
                      <li>在小程序里确认绑定当前微信账号。</li>
                      <li>绑定完成后，网站端刷新即可看到已绑定状态。</li>
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
                ) : fallbackMode === 'manual_code' && bindToken ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-left">
                      <div className="text-xs uppercase tracking-[0.3em] text-amber-500">手动绑定码</div>
                      <div className="mt-3 break-all rounded-xl bg-white px-3 py-3 font-mono text-sm text-[#8a6000]">
                        {formatBindToken(bindToken)}
                      </div>
                    </div>
                    <p className="text-xs leading-6 text-gray-500">
                      当前小程序没有 URL Link 权限，不能直接扫码拉起。请在手机端打开 Jinlee 小程序绑定页，并粘贴上面的绑定码完成关联。
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyBindToken}
                      className="inline-flex items-center justify-center rounded-full border border-[#8a6000]/20 px-4 py-2 text-xs font-medium text-[#8a6000] transition hover:bg-[#8a6000]/5"
                    >
                      复制绑定码
                    </button>
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
