'use client';

/* eslint-disable @next/next/no-img-element -- Local file previews use temporary blob URLs. */
import Image from 'next/image';
import Link from 'next/link';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpTrayIcon, CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SITE_LOGO } from '@/lib/site';
import styles from './application.module.css';
import { ASSESSMENT_LABELS, MAX_JOIN_GAMES, validateJoinApplication, type Assessment, type JoinErrors, type JoinImage } from '@/lib/join-application';
import { prepareJoinImage } from '@/lib/join-image';

const ValidationContext = createContext<JoinErrors>({});
const LOGIN_URL = '/api/discord/login?callbackUrl=%2Fjoin';
type Attachment = { id: string; name: string; url: string; file: File };
type Game = { id: number; name: string; level: string; price: string; unit: string };
const GAME_NAMES = ['Valorant / 无畏契约', '英雄联盟', '三角洲行动', 'APEX', 'Overwatch / 守望先锋', 'CS2', '永劫无间', '云顶之弈', 'Steam 小游戏', '语音聊天', '其他'];
const SECTIONS = [['basics', '基本资料', '让我们认识你'], ['assessment', '考核资料'], ['games', '游戏项目']] as const;
const MAX_IMAGES = 1;

function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const ownedUrls = urls.current;
    return () => { ownedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  function add(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length > MAX_IMAGES) {
      setError('每组只需选择 1 张图片。');
      return;
    }
    if (incoming.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    if (incoming.some((file) => file.size === 0)) {
      setError('图片文件为空，请重新选择。');
      return;
    }
    const added = incoming.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { id: crypto.randomUUID(), name: file.name, url, file };
    });
    if (!added.length) return;
    items.forEach((item) => { URL.revokeObjectURL(item.url); urls.current.delete(item.url); });
    setItems(added);
    setError('');
  }
  function remove(id: string) {
    const item = items.find((value) => value.id === id);
    if (item) { URL.revokeObjectURL(item.url); urls.current.delete(item.url); }
    setItems((previous) => previous.filter((value) => value.id !== id));
    setError('');
  }
  return { items, error, add, remove };
}

function Field({ label, htmlFor, children, hint, optional = false }: { label: string; htmlFor: string; children: ReactNode; hint?: string; optional?: boolean }) {
  const error = useContext(ValidationContext)[htmlFor];
  return <div className={styles.field}>
    <label htmlFor={htmlFor}>{label}<span className={optional ? styles.optional : styles.required}>{optional ? '选填' : '*'}</span></label>
    {children}
    {hint && <p className={styles.hint}>{hint}</p>}
    {error && <p id={`${htmlFor}-error`} className={styles.error}>{error}</p>}
  </div>;
}

function Section({ index, children }: { index: number; children: ReactNode }) {
  const [id, title, description] = SECTIONS[index];
  return <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
    <div className={styles.sectionHeading}>
      <span className={styles.sectionNumber}>0{index + 1}</span>
      <div><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
    </div>
    <div className={styles.sectionBody}>{children}</div>
  </section>;
}

function Upload({ id, title, description, attachments, optional = false }: { id: string; title: string; description: ReactNode; attachments: ReturnType<typeof useAttachments>; optional?: boolean }) {
  const error = useContext(ValidationContext)[id] || attachments.error;
  return <div className={styles.uploadGroup}>
    <p className={styles.uploadTitle}>{title}<span className={optional ? styles.optional : styles.required}>{optional ? '选填' : '*'}</span><span className={styles.uploadCount}>{attachments.items.length} / {MAX_IMAGES}</span></p>
    <p className={styles.hint}>{description}</p>
    <label className={styles.uploadZone} htmlFor={id}>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`选择${title}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { attachments.add(event.target.files); event.target.value = ''; }} />
      <span className={styles.uploadIcon}><ArrowUpTrayIcon /></span>
      <span><strong>{attachments.items.length ? '点击更换图片' : '点击选择图片'}</strong><small>JPG、PNG · 1 张图片 · 不限制图片大小</small></span>
      <PlusIcon className={styles.uploadPlus} />
    </label>
    {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
    {attachments.items.length > 0 && <ul className={styles.thumbnails}>
      {attachments.items.map((item) => <li key={item.id}>
        <img src={item.url} alt={`${title}：${item.name}`} />
        <span title={item.name}>{item.name}</span>
        <button type="button" onClick={() => attachments.remove(item.id)} aria-label={`移除${item.name}`}><XMarkIcon /></button>
      </li>)}
    </ul>}
  </div>;
}

function Choice({ name, value, checked, onChange, title, children }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; children: ReactNode }) {
  return <label className={`${styles.choice} ${checked ? styles.choiceSelected : ''}`}>
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
    <span className={styles.checkbox} aria-hidden="true">{checked && <CheckIcon />}</span>
    <span><strong>{title}</strong><small>{children}</small></span>
  </label>;
}

export function ApplicationForm({ discordId }: { discordId: string | null }) {
  const [fields, setFields] = useState({ discord: discordId ?? '', nickname: '', gender: '', voice: '', region: '', otherGames: '', intro: '', guild: '', inviter: '', wechat: '', card: '', heroes: '', sourceGuild: '' });
  const [exclusive, setExclusive] = useState('');
  const [assessment, setAssessment] = useState<Assessment>('unassessed');
  const [tier, setTier] = useState('');
  const [games, setGames] = useState<Game[]>([{ id: 1, name: '', level: '', price: '', unit: '小时' }]);
  const nextGameId = useRef(2);
  const rankImages = useAttachments();
  const records = useAttachments();
  const passedRecords = useAttachments();
  const photos = useAttachments();
  const [previewOpen, setPreviewOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<JoinErrors>({});
  const [busy, setBusy] = useState<'preparing' | 'sending' | null>(null);
  const sending = useRef(false);
  const [sendError, setSendError] = useState('');
  const [loginExpired, setLoginExpired] = useState(false);
  const [uncertainId, setUncertainId] = useState('');
  const [receipt, setReceipt] = useState<{ applicationId: string; submittedAt: string } | null>(null);
  const hasMasterDetails = assessment !== 'unassessed' && tier.includes('大神');

  useEffect(() => {
    if (!previewOpen) return;
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = overflow; };
  }, [previewOpen]);

  function input(key: keyof typeof fields) {
    return { id: key, name: key, value: fields[key], 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined, onChange: (event: { target: { value: string } }) => setFields((previous) => ({ ...previous, [key]: event.target.value })) };
  }
  function updateGame(id: number, key: keyof Omit<Game, 'id'>, value: string) {
    setGames((previous) => previous.map((game) => game.id === id ? { ...game, [key]: value } : game));
  }
  function displayErrors(values: JoinErrors) {
    const mapped: JoinErrors = {};
    for (const [key, message] of Object.entries(values)) {
      const match = /^(game|level|price)-(\d+)$/.exec(key);
      const id = match ? `${match[1]}-${games[Number(match[2])]?.id ?? 1}` : key;
      mapped[id] = message;
    }
    setErrors(mapped);
    if (Object.keys(mapped).length) requestAnimationFrame(() => errorSummary.current?.focus());
  }
  function validate() {
    const result = validateJoinApplication({ fields, assessment, exclusive, tier, games }, discordId ?? '');
    const uploadErrors: JoinErrors = {};
    for (const [id, label, attachments, required] of [
      ['personal-photos', '名片使用图片', photos, true],
      ['rank-images', '游戏段位截图', rankImages, false],
      ...(assessment === 'transfer' ? [['assessment-records', '其他公会考核记录', records, true]] : []),
      ...(assessment === 'passed' ? [['passed-records', '考核区通过记录', passedRecords, true]] : []),
    ] as [string, string, ReturnType<typeof useAttachments>, boolean][]) {
      if (attachments.error) uploadErrors[id] = attachments.error;
      else if (required && !attachments.items.length) uploadErrors[id] = `请上传${label}。`;
    }
    const allErrors = { ...result.errors, ...uploadErrors };
    displayErrors(allErrors);
    return Object.keys(allErrors).length ? null : result.data;
  }
  function openPreview() {
    if (busy || receipt || !validate()) return;
    setSendError('');
    setPreviewOpen(true);
  }
  async function submitApplication() {
    if (sending.current || receipt) return;
    const application = validate();
    if (!application) { setPreviewOpen(false); return; }
    sending.current = true;
    setBusy('preparing');
    setSendError('');
    setLoginExpired(false);
    setUncertainId('');
    try {
      const selected: [JoinImage['kind'], Attachment | undefined][] = [
        ['photo', photos.items[0]], ['rank', rankImages.items[0]],
        ...(assessment === 'transfer' ? [['transfer', records.items[0]] as [JoinImage['kind'], Attachment]] : []),
        ...(assessment === 'passed' ? [['passed', passedRecords.items[0]] as [JoinImage['kind'], Attachment]] : []),
      ];
      const images: JoinImage[] = [];
      for (const [kind, item] of selected) {
        if (item) {
          try { images.push(await prepareJoinImage(item.file, kind)); }
          catch { throw new Error(`无法处理图片“${item.name}”，请返回重新选择清晰的 JPG、PNG 或 WebP 图片。`); }
        }
      }
      setBusy('sending');
      const response = await fetch('/api/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application, images }), signal: AbortSignal.timeout(60000),
      }).catch(() => { throw new Error('网络连接中断，暂时无法确认发送结果。请稍后使用相同内容重试。'); });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (data.fields && typeof data.fields === 'object') { displayErrors(data.fields); setPreviewOpen(false); }
        setLoginExpired(data.code === 'login_required');
        setUncertainId(typeof data.applicationId === 'string' ? data.applicationId : '');
        throw new Error(typeof data.error === 'string' ? data.error : '暂时无法确认发送结果，请稍后使用相同内容重试。');
      }
      setReceipt({ applicationId: data.applicationId, submittedAt: data.submittedAt });
      setPreviewOpen(false);
      requestAnimationFrame(() => document.getElementById('application-result')?.focus());
    } catch (error) {
      setSendError(error instanceof Error && error.name !== 'TimeoutError' ? error.message : '暂时无法确认发送结果，请稍后使用相同内容重试。');
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }
  const rows = [
    ['Discord ID', fields.discord], ['公会昵称', fields.nickname], ['性别', fields.gender], ['音色', fields.voice],
    ['是否独家入驻', exclusive], ['所在地区', fields.region], ['个人简介', fields.intro], ['其他游戏', fields.otherGames],
    ['申请方式', ASSESSMENT_LABELS[assessment]],
    ...(assessment === 'transfer' ? [['来源公会', fields.sourceGuild]] : []),
    ...(assessment !== 'unassessed' ? [['考核过的水平', tier]] : []),
    ...(hasMasterDetails ? [['大神名片类型', fields.card], ['擅长英雄／位置', fields.heroes]] : []),
    ['当前挂名公会', fields.guild], ['邀请人', fields.inviter], ['微信号', fields.wechat],
  ];

  return <ValidationContext.Provider value={errors}><div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" prefetch={false} className={styles.brand} aria-label="DLMClub 首页"><Image src={SITE_LOGO} width={40} height={40} alt="" /><span>DLM<span className={styles.brandLight}>CLUB</span><small>点了么娱乐公会</small></span></Link>
        <div className={styles.headerRight}><span className={styles.previewBadge}><span />入职申请</span><Link href="/" prefetch={false}><ArrowLeftIcon />返回官网</Link></div>
      </div>
    </header>
    <main className={styles.main}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}><span />DLM TALENT RECRUITMENT</p>
        <h1>DLM 电竞<span>入职申请表</span></h1>
      </div>
      {!discordId && <div className={styles.notice}><div><strong>先登录 Discord，再填写申请</strong><p>登录后会自动带入你的 Discord ID，方便 HR 联系你。</p></div><Link href={LOGIN_URL} className={styles.primaryButton}>使用 Discord 登录<ArrowRightIcon /></Link></div>}
      {receipt && <div id="application-result" className={styles.notice} role="status" tabIndex={-1}><div><strong>申请已发送给 HR</strong><p>申请编号：{receipt.applicationId}</p><p>请留意 Discord 和微信消息，HR 会联系你跟进。</p></div><Link href="/" className={styles.primaryButton}>返回官网<ArrowLeftIcon /></Link></div>}
      <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); openPreview(); }}>
        {Object.keys(errors).length > 0 && <div className={styles.validationSummary} ref={errorSummary} tabIndex={-1} role="alert"><strong>请检查以下资料：</strong><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><a href={`#${id}`} onClick={(event) => { event.preventDefault(); document.getElementById(id)?.focus(); document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>{message}</a></li>)}</ul></div>}
        <fieldset className={styles.applicationFields} disabled={!discordId || Boolean(busy) || Boolean(receipt)}>
        <Section index={0}>
          <div className={styles.twoColumns}>
            <Field label="Discord ID" htmlFor="discord" hint={discordId ? "已通过 Discord 登录验证，提交时自动带入。" : "请先登录 Discord，登录后自动填写。"}><input {...input('discord')} placeholder="登录后自动填写" readOnly inputMode="numeric" maxLength={20} /></Field>
            <Field label="公会昵称" htmlFor="nickname"><input {...input('nickname')} placeholder="希望大家怎么称呼你" maxLength={32} /></Field>
            <Field label="性别" htmlFor="gender"><select {...input('gender')}><option value="">请选择</option><option>男</option><option>女</option><option>其他</option><option>不愿透露</option></select></Field>
            <Field label="音色" htmlFor="voice"><input {...input('voice')} placeholder="例如：甜美、温柔、元气、少年音" maxLength={80} /></Field>
            <Field label="所在地区" htmlFor="region" hint="填写目前所在的国家／地区和城市。"><input {...input('region')} placeholder="例如：德国，意大利" maxLength={100} /></Field>
            <Field label="微信号" htmlFor="wechat"><input {...input('wechat')} placeholder="用于 HR 后续联系" maxLength={64} /></Field>
          </div>
          <fieldset id="exclusive" tabIndex={-1} className={styles.fieldset}><legend>是否独家入驻<span className={styles.required}>*</span><span className={styles.legendHint}>请如实填写</span></legend>
            <div className={styles.twoColumns}><Choice name="exclusive" value="yes" checked={exclusive === '是'} onChange={() => setExclusive('是')} title="是，独家入驻">仅在欧服 Discord 平台 DLM 娱乐接单</Choice><Choice name="exclusive" value="no" checked={exclusive === '否'} onChange={() => setExclusive('否')} title="否，非独家入驻">请在下方如实填写当前挂名公会</Choice></div>
            {errors.exclusive && <p className={styles.error}>{errors.exclusive}</p>}
          </fieldset>
          <div className={styles.twoColumns}><Field label="当前挂名公会" htmlFor="guild"><input {...input('guild')} placeholder="有则如实填写，没有请填“无”" maxLength={200} /></Field><Field label="邀请人" htmlFor="inviter" optional><input {...input('inviter')} placeholder="邀请人的昵称或 Discord ID" maxLength={100} /></Field></div>
          <Field label="个人简介" htmlFor="intro" ><textarea {...input('intro')} rows={2} placeholder="放在名片上的介绍。" maxLength={20} /><span className={styles.characterCount}>{fields.intro.length} / 20</span></Field>
          <Upload id="personal-photos" title="名片使用图片" description={<>请选择清晰的图片。如果是真人照，请使用本人照片。<br />使用假照/网红照/网图会罚款50到200。</>} attachments={photos} />
        </Section>
        <Section index={1}>
          <fieldset className={styles.fieldset}><legend>申请方式<span className={styles.required}>*</span><span className={styles.legendHint}>以下三项三选一</span></legend>
            <div className={styles.assessmentChoices}>
              <Choice name="assessment" value="unassessed" checked={assessment === 'unassessed'} onChange={() => setAssessment('unassessed')} title="尚未考核">小姐姐可以免考核入职</Choice>
              <Choice name="assessment" value="transfer" checked={assessment === 'transfer'} onChange={() => setAssessment('transfer')} title="平移考核记录">请上传其他公会的考核记录</Choice>
              <Choice name="assessment" value="passed" checked={assessment === 'passed'} onChange={() => setAssessment('passed')} title="已考核通过">请上传考核区的通过记录</Choice>
            </div>
          </fieldset>
          <Upload id="rank-images" title="游戏段位截图" description="可选上传能看清游戏昵称和当前段位的截图。" attachments={rankImages} optional />
          {assessment !== 'unassessed' && <div className={styles.conditional}>
            <div className={styles.conditionalHeading}><span />{assessment === 'transfer' ? '平移申请' : '已考核通过'} · 补充资料</div>
            {assessment === 'transfer' ? <>
              <Upload id="assessment-records" title="其他公会考核记录" description="请提供考核项目及结果的记录。" attachments={records} />
              <Field label="来源公会" htmlFor="sourceGuild"><input {...input('sourceGuild')} placeholder="请填写提供考核记录的公会名称" maxLength={100} /></Field>
            </> : <Upload id="passed-records" title="考核区通过记录" description="请上传考核区的通过记录。" attachments={passedRecords} />}
            <Field label="考核过的水平" htmlFor="tier"><input id="tier" aria-invalid={Boolean(errors.tier)} aria-describedby={errors.tier ? 'tier-error' : undefined} value={tier} onChange={(event) => setTier(event.target.value)} placeholder="请填写考核项目及水平，例如：VAL 技术、VAL 大神" maxLength={100} /></Field>
            {hasMasterDetails && <div className={styles.masterFields}><p>大神名片资料</p><div className={styles.twoColumns}><Field label="大神名片类型" htmlFor="card"><input {...input('card')} placeholder="例如：瓦 Jett" maxLength={80} /></Field><Field label="擅长英雄／位置" htmlFor="heroes"><input {...input('heroes')} placeholder="例如：Jett、Reyna / 一突" maxLength={150} /></Field></div></div>}
            <p className={styles.hint}>填写你已有的考核结果由 HR 核实。</p>
          </div>}
        </Section>
        <Section index={2}>
          <div className={styles.fieldTitle}><p>主营项目及水平<span className={styles.required}>*</span></p><span>可添加多个项目，分别填写报价</span></div>
          <div className={styles.gameList}>{games.map((game, index) => <div key={game.id} className={styles.gameRow}>
            <div className={styles.gameHeading}><span>项目 {String(index + 1).padStart(2, '0')}</span>{games.length > 1 && <button type="button" className={styles.removeGame} aria-label={`删除项目 ${index + 1}`} onClick={() => setGames((previous) => previous.filter((entry) => entry.id !== game.id))}><XMarkIcon />移除</button>}</div>
            <div className={styles.gameFields}>
              <Field label="游戏／项目" htmlFor={`game-${game.id}`}><input id={`game-${game.id}`} aria-invalid={Boolean(errors[`game-${game.id}`])} aria-describedby={errors[`game-${game.id}`] ? `game-${game.id}-error` : undefined} list="game-options" value={game.name} onChange={(event) => updateGame(game.id, 'name', event.target.value)} placeholder="选择或输入游戏" maxLength={80} /></Field>
              <Field label="游戏水平／段位" htmlFor={`level-${game.id}`}><input id={`level-${game.id}`} aria-invalid={Boolean(errors[`level-${game.id}`])} aria-describedby={errors[`level-${game.id}`] ? `level-${game.id}-error` : undefined} value={game.level} onChange={(event) => updateGame(game.id, 'level', event.target.value)} placeholder="例如：超凡入圣" maxLength={100} /></Field>
              <Field label="单价" htmlFor={`price-${game.id}`}><div className={styles.priceInput}><span>¥</span><input id={`price-${game.id}`} aria-invalid={Boolean(errors[`price-${game.id}`])} aria-describedby={errors[`price-${game.id}`] ? `price-${game.id}-error` : undefined} type="number" min="0" step="0.01" value={game.price} onChange={(event) => updateGame(game.id, 'price', event.target.value)} placeholder="0.00" /><select aria-label={`项目 ${index + 1} 计价单位`} value={game.unit} onChange={(event) => updateGame(game.id, 'unit', event.target.value)}><option value="小时">/ 小时</option><option value="局">/ 局</option></select></div></Field>
            </div>
          </div>)}</div>
          <datalist id="game-options">{GAME_NAMES.map((name) => <option key={name} value={name} />)}</datalist>
          <button type="button" className={styles.addGame} disabled={games.length >= MAX_JOIN_GAMES} onClick={() => { const id = nextGameId.current++; setGames((previous) => [...previous, { id, name: '', level: '', price: '', unit: '小时' }]); }}><PlusIcon />{games.length >= MAX_JOIN_GAMES ? `最多 ${MAX_JOIN_GAMES} 个项目` : '添加主营项目'}</button>
          <Field label="其他游戏" htmlFor="otherGames" ><textarea {...input('otherGames')} rows={2} placeholder="例如：双人成行、胡闹厨房、饥荒……" maxLength={500} /></Field>
        </Section>
        </fieldset>
        {!receipt && <div className={styles.formFooter}><div><strong>期待认识真实的你。</strong><p>提交后，表格和图片将发送给 DLM HR，仅用于入职审核。</p></div><button type="submit" className={styles.primaryButton} disabled={!discordId || Boolean(busy)}>预览并提交<ArrowRightIcon /></button></div>}
        {sendError && !previewOpen && <p className={styles.error} role="alert">{sendError}</p>}
      </form>
      <footer className={styles.footer}><span>DLMCLUB · 点了么娱乐公会</span><span>让每一场游戏，都有好队友。</span></footer>
    </main>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="application-preview-title" onClose={() => setPreviewOpen(false)} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) setPreviewOpen(false); }}>
      <div className={styles.dialogHeader}><div><p>APPLICATION PREVIEW</p><h2 id="application-preview-title">DLM 电竞入职申请表</h2></div><button type="button" disabled={Boolean(busy)} onClick={() => setPreviewOpen(false)} aria-label="关闭申请预览"><XMarkIcon /></button></div>
      <div className={styles.dialogBody}><p className={styles.dialogNotice}>请确认以下资料和图片。点击“确认提交给 HR”后，申请才会发送。</p>
        <dl className={styles.summary}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value.trim() ? styles.emptyValue : undefined}>{value.trim() || '未填写'}</dd></div>)}</dl>
        <div className={styles.summaryGames}><h3>主营项目及报价</h3>{games.map((game, index) => <div key={game.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{game.name || '项目未填写'}</strong><p>{game.level || '水平未填写'}</p></div><b>{game.price ? `¥${game.price} / ${game.unit}` : '单价未填写'}</b></div>)}</div>
        {[{ title: '游戏段位截图', items: rankImages.items }, ...(assessment === 'transfer' ? [{ title: '其他公会考核记录', items: records.items }] : []), ...(assessment === 'passed' ? [{ title: '考核区通过记录', items: passedRecords.items }] : []), { title: '名片使用图片', items: photos.items }].map((group) => <div className={styles.summaryImages} key={group.title}><h3>{group.title}<span>{group.items.length} 张</span></h3>{group.items.length ? <div>{group.items.map((item) => <img key={item.id} src={item.url} alt={`${group.title}：${item.name}`} />)}</div> : <p>尚未选择图片</p>}</div>)}
      </div>
      {sendError && <div className={styles.submitError} role="alert"><p>{sendError}</p>{uncertainId && <p>申请编号：{uncertainId}</p>}{loginExpired && <Link href={LOGIN_URL}>重新登录 Discord</Link>}</div>}
      <div className={styles.dialogFooter}><button type="button" disabled={Boolean(busy)} className={styles.secondaryButton} onClick={() => setPreviewOpen(false)}>返回修改</button><button type="button" disabled={Boolean(busy) || loginExpired || Boolean(uncertainId)} className={styles.primaryButton} onClick={submitApplication}>{busy === 'preparing' ? '正在处理图片…' : busy === 'sending' ? '正在发送…' : '确认提交给 HR'}<ArrowRightIcon /></button></div>
    </dialog>
  </div></ValidationContext.Provider>;
}
