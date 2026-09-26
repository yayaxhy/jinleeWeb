import Image from 'next/image';
import Link from 'next/link';

const couponImage = '/brand/dlm-v1/prizes/13-special-9-zhe-voucher.png';
const crownCouponImage = '/brand/dlm-v1/prizes/17-day-crown-75-voucher.png';
const characterArt = '/brand/dlm-v1/operations/18-thankBoss.gif';

export function OpeningBenefitsTeaser() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-8 pt-2 md:pb-12">
      <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-[#ffb8cc]/70 bg-[#fff6f1] px-6 py-8 text-[#563b4d] shadow-[0_25px_70px_rgba(255,128,159,0.2)] md:px-10 md:py-10">
        <div className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-[#ffd7e1] blur-2xl" />
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-[#fbd26b]/35 blur-2xl" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#f7a5bd_1.1px,transparent_1.1px)] [background-size:16px_16px]" />

        <div className="pointer-events-none absolute -bottom-6 left-[38%] hidden h-28 w-28 -rotate-6 overflow-hidden rounded-[1.6rem] bg-white shadow-[0_12px_14px_rgba(78,72,155,0.2)] md:block">
          <Image
            src={characterArt}
            alt="抽奖角色插画"
            fill
            sizes="144px"
            unoptimized
            className="object-contain"
          />
        </div>
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_0.92fr]">
          <div className="max-w-xl">
            <p className="inline-flex rounded-full bg-[#ffcfda] px-3 py-1 text-xs font-black tracking-[0.2em] text-[#9e3b5c]">
              OPENING PARTY · 限定福利
            </p>
            <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#5e3248] md:text-5xl">
              开业福利，
              <br />
              今天也要被宠到。
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-[#896577] md:text-base">
              每天领券、每周攒福利，活动期内任意两笔点单或打赏每笔超过
              ¥100，还有额外惊喜。可领取资格和券的到期日，都能在福利页与背包里查看。
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-[#86445e]">
              <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                每日特殊 9 折券
              </span>
              <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                满 ¥1,000 领日冠 75 折
              </span>
              <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                两笔消费超 ¥100 加赠
              </span>
            </div>
            <Link
              href="/opening-benefits"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#e95d86] px-6 py-3 text-sm font-black text-white shadow-[0_10px_0_#bc4166,0_18px_26px_rgba(196,65,101,0.25)] transition hover:-translate-y-0.5 hover:bg-[#f06a91] active:translate-y-1 active:shadow-[0_5px_0_#bc4166]"
            >
              去领取我的福利 <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="relative mx-auto h-[260px] w-full max-w-[450px] sm:h-[290px]">
            <div className="absolute inset-x-8 bottom-3 top-3 rounded-[2rem] bg-[#ffe0a7]/70" />
            <Image
              src={couponImage}
              alt="特殊九折券"
              width={650}
              height={433}
              className="absolute left-0 top-3 w-[78%] -rotate-6 drop-shadow-[0_20px_17px_rgba(173,62,97,0.24)] transition duration-300 hover:-rotate-3 hover:scale-[1.02]"
            />
            <Image
              src={crownCouponImage}
              alt="日冠七五折券"
              width={650}
              height={433}
              className="absolute bottom-0 right-0 w-[68%] rotate-6 drop-shadow-[0_20px_17px_rgba(173,62,97,0.2)] transition duration-300 hover:rotate-3 hover:scale-[1.02]"
            />
            <span className="absolute right-4 top-2 grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-[#ff8eaa] text-2xl shadow-lg">
              ✦
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
