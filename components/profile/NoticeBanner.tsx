'use client';

type NoticeLevel = 'info' | 'success' | 'error';

type NoticeBannerProps = {
  level: NoticeLevel;
  message: string;
  title?: string;
  onDismiss?: () => void;
};

const STYLE_MAP: Record<
  NoticeLevel,
  {
    container: string;
    icon: string;
    iconClass: string;
    title: string;
    titleClass: string;
    messageClass: string;
    buttonClass: string;
  }
> = {
  info: {
    container: 'border-[#5c43a3]/20 bg-[#f4efff]',
    icon: 'i',
    iconClass: 'bg-[#5c43a3] text-white',
    title: '操作提示',
    titleClass: 'text-[#3f2b7b]',
    messageClass: 'text-[#4f4373]',
    buttonClass: 'border-[#5c43a3]/20 text-[#4a3388] hover:bg-[#5c43a3]/8',
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50',
    icon: '✓',
    iconClass: 'bg-emerald-600 text-white',
    title: '操作成功',
    titleClass: 'text-emerald-800',
    messageClass: 'text-emerald-900/90',
    buttonClass: 'border-emerald-200 text-emerald-800 hover:bg-emerald-100',
  },
  error: {
    container: 'border-red-200 bg-red-50',
    icon: '!',
    iconClass: 'bg-red-600 text-white',
    title: '操作失败',
    titleClass: 'text-red-800',
    messageClass: 'text-red-900/90',
    buttonClass: 'border-red-200 text-red-800 hover:bg-red-100',
  },
};

export function NoticeBanner({ level, message, title, onDismiss }: NoticeBannerProps) {
  const style = STYLE_MAP[level];

  return (
    <div
      role={level === 'error' ? 'alert' : 'status'}
      aria-live={level === 'error' ? 'assertive' : 'polite'}
      className={`rounded-2xl border px-4 py-4 shadow-sm ${style.container}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.iconClass}`}
          aria-hidden="true"
        >
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${style.titleClass}`}>{title ?? style.title}</p>
          <p className={`mt-1 text-sm leading-6 ${style.messageClass}`}>{message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${style.buttonClass}`}
          >
            关闭
          </button>
        ) : null}
      </div>
    </div>
  );
}
