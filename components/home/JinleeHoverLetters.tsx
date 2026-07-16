"use client";

import type { CSSProperties, FocusEvent, PointerEvent } from 'react';

type LetterVideo = {
  letter: string;
  label: string;
  mp4: string;
  webm?: string;
};

type LetterWallSize = 'default' | 'hero' | 'compare';

const letters: LetterVideo[] = [
  {
    letter: 'V',
    label: 'VALORANT tactical clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/74d9d9fd8664d1c431b4b82d007f968eacb3e8b4.mp4?accountingTag=VAL',
  },
  {
    letter: 'L',
    label: 'League of Legends champion clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/bbc27473157462adacf0de441a8796268eb2d0ac.mp4?accountingTag=LoL',
  },
  {
    letter: 'V',
    label: 'VALORANT agent clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/f6ccf20dfe3f6a24ea9216bb8afaaa66740c715d.mp4?accountingTag=VAL',
  },
  {
    letter: 'L',
    label: 'League of Legends gameplay clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/1f5b2cf01a1cf2afa1ce61febee6e2e900808347.mp4?accountingTag=LoL',
  },
  {
    letter: 'V',
    label: 'VALORANT media clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/game_data/82ab63d9255f9fbbea7c13e00cd46b09ff90d25b.mp4?accountingTag=VAL',
  },
  {
    letter: 'L',
    label: 'League of Legends mode clip',
    mp4: 'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/0a9b9f8dacb54086c58c1af8aa880d7cf6d7fea6.mp4?accountingTag=LoL',
  },
];

function escapeSvgText(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return replacements[char] ?? char;
  });
}

function isCjkCharacter(letter: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(letter);
}

function buildLetterMask(letter: string) {
  const isCjk = isCjkCharacter(letter);
  const viewBox = isCjk ? '0 0 300 300' : '0 0 220 300';
  const x = isCjk ? '150' : '110';
  const y = isCjk ? '158' : '246';
  const fontSize = isCjk ? '254' : '286';
  const fontFamily = isCjk
    ? 'Noto Serif SC, Songti SC, STSong, SimSun, serif'
    : 'Arial Black, Impact, sans-serif';
  const baseline = isCjk ? ' dominant-baseline="middle"' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><text x="${x}" y="${y}" text-anchor="middle"${baseline} font-family="${fontFamily}" font-size="${fontSize}" font-weight="900">${escapeSvgText(letter)}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function playVideo(event: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) {
  const video = event.currentTarget.querySelector('video');
  if (!(video instanceof HTMLVideoElement)) return;
  video.currentTime = 0;
  video.loop = true;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function stopVideo(event: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) {
  const video = event.currentTarget.querySelector('video');
  if (!(video instanceof HTMLVideoElement)) return;
  video.pause();
  video.currentTime = 0;
  video.loop = false;
}

function HoverLetter({
  item,
  index,
  maskSize,
}: {
  item: LetterVideo;
  index: number;
  maskSize: string;
}) {
  const mask = buildLetterMask(item.letter);
  const maskStyle = {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: maskSize,
    maskSize,
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  } satisfies CSSProperties;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.label}: hover to play video`}
      className="group relative h-full min-h-0 flex-1 cursor-pointer outline-none transition duration-500 hover:-translate-y-3 focus-visible:-translate-y-3"
      onPointerEnter={playVideo}
      onPointerLeave={stopVideo}
      onFocus={playVideo}
      onBlur={stopVideo}
      style={{ transitionDelay: `${index * 30}ms` }}
    >
      <div className="absolute inset-0 rounded-[2rem] bg-white/[0.025] opacity-0 blur-xl transition duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />
      <div
        className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#fff7ed] via-[#9a8f84] to-[#27211d] shadow-[0_30px_80px_rgba(0,0,0,0.36)]"
        style={maskStyle}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-0 saturate-[1.2] contrast-[1.05] transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          muted
          playsInline
          preload="metadata"
        >
          <source src={item.mp4} type="video/mp4" />
          {item.webm ? <source src={item.webm} type="video/webm" /> : null}
        </video>
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-30 transition duration-500 group-hover:opacity-70 group-focus-visible:opacity-70"
        style={maskStyle}
      >
        <div className="h-full w-full bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.82),transparent_22%),linear-gradient(to_bottom,transparent,rgba(255,112,67,0.42))]" />
      </div>
    </div>
  );
}

function buildWordLetters(word: string) {
  const characters = Array.from(word.trim()).filter((char) => char.trim().length > 0);
  const safeCharacters = characters.length > 0 ? characters : Array.from('JINLEE');

  return safeCharacters.map((char, index) => {
    const source = letters[index % letters.length];
    return {
      ...source,
      letter: char,
      label: `锦鲤视频字 ${char}`,
    };
  });
}

export function JinleeHoverLetters({
  showIntro = true,
  className = '',
  size = 'default',
  word = 'JINLEE',
}: {
  showIntro?: boolean;
  className?: string;
  size?: LetterWallSize;
  word?: string;
}) {
  const wordLetters = buildWordLetters(word);
  const containerSizeClass = {
    default: 'h-[34vw] min-h-[220px] max-h-[430px]',
    hero: 'h-[40vw] min-h-[320px] max-h-[520px]',
    compare: 'h-[28vw] min-h-[240px] max-h-[390px]',
  }[size];
  const letterMaskSize = {
    default: '100% 100%',
    hero: '132% 132%',
    compare: '126% 126%',
  }[size];
  const sectionSpacingClass = showIntro ? 'mt-16' : '';

  return (
    <section className={`relative mx-auto max-w-7xl ${sectionSpacingClass} ${className}`}>
      {showIntro ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.52em] text-orange-200/70">
              锦鲤互动
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#fff7ed] md:text-4xl">
              JINLEE 字母视频墙
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/45">
            鼠标划过每个字母会播放视频。正式版可以换成游戏片段、陪玩语音房或锦鲤社区视频。
          </p>
        </div>
      ) : null}
      <div className={`flex ${containerSizeClass} gap-2 overflow-hidden rounded-[2rem] border border-white/10 bg-black/18 px-3 py-4 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur sm:gap-3 md:px-5`}>
        {wordLetters.map((item, index) => (
          <HoverLetter key={`${item.letter}-${index}-${item.mp4}`} item={item} index={index} maskSize={letterMaskSize} />
        ))}
      </div>
    </section>
  );
}
