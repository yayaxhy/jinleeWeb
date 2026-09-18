'use client';

import Script from 'next/script';
import { useState } from 'react';

type WechatBridge = {
  miniProgram?: {
    navigateBack?: (options?: { delta?: number }) => void;
  };
};

export default function BindResultActions() {
  const [hint, setHint] = useState('');

  const returnToMiniProgram = () => {
    const bridge = (window as Window & { wx?: WechatBridge }).wx?.miniProgram;
    if (bridge?.navigateBack) {
      bridge.navigateBack({ delta: 1 });
      return;
    }

    setHint('当前页面在系统浏览器中，请切回微信并在绑定页检查结果。');
  };

  return (
    <>
      <Script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js" strategy="afterInteractive" />
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold text-[#f5deb0]"
        onClick={returnToMiniProgram}
      >
        返回微信小程序
      </button>
      {hint ? <p className="text-xs leading-6 text-amber-700">{hint}</p> : null}
    </>
  );
}
