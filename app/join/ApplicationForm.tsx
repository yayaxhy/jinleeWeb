'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


/* eslint-disable @next/next/no-img-element -- Local file previews use temporary blob URLs. */
import Image from 'next/image';
import Link from 'next/link';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpTrayIcon, CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DISCORD_INVITE_URL, SITE_LOGO } from '@/lib/site';
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
    <label htmlFor={htmlFor}>{label}<span className={optional ? styles.optional : styles.required}>{optional ? <SiteText copyKey="site.app.join.applicationform.924b8c1dd07b" /> : '*'}</span></label>
    {children}
    {hint && <p className={styles.hint}>{hint}</p>}
    {error && <p id={`${htmlFor}-error`} className={styles.error}><SiteText namespace="site.app.join.applicationform" value={error} /></p>}
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
  const siteCopy = useSiteCopy();
  const error = useContext(ValidationContext)[id] || attachments.error;
  return <div className={styles.uploadGroup}>
    <p className={styles.uploadTitle}>{title}<span className={optional ? styles.optional : styles.required}>{optional ? <SiteText copyKey="site.app.join.applicationform.924b8c1dd07b" /> : '*'}</span><span className={styles.uploadCount}>{attachments.items.length} / {MAX_IMAGES}</span></p>
    <p className={styles.hint}>{description}</p>
    <label className={styles.uploadZone} htmlFor={id}>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label={siteCopy("site.app.join.applicationform.7dfa88e2563b", {value1: String(title)})} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { attachments.add(event.target.files); event.target.value = ''; }} />
      <span className={styles.uploadIcon}><ArrowUpTrayIcon /></span>
      <span><strong>{attachments.items.length ? <SiteText copyKey="site.app.join.applicationform.c70264022122" /> : <SiteText copyKey="site.app.join.applicationform.4f528c177134" />}</strong><small><SiteText copyKey="site.app.join.applicationform.519a20439d67" /></small></span>
      <PlusIcon className={styles.uploadPlus} />
    </label>
    {error && <p id={`${id}-error`} className={styles.error} role="alert"><SiteText namespace="site.app.join.applicationform" value={error} /></p>}
    {attachments.items.length > 0 && <ul className={styles.thumbnails}>
      {attachments.items.map((item) => <li key={item.id}>
        <img src={item.url} alt={siteCopy("site.app.join.applicationform.e9cd8dc12918", {value1: String(title), value2: String(item.name)})} />
        <span title={item.name}>{item.name}</span>
        <button type="button" onClick={() => attachments.remove(item.id)} aria-label={siteCopy("site.app.join.applicationform.dcf206159d29", {value1: String(item.name)})}><XMarkIcon /></button>
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
  const siteCopy = useSiteCopy();
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
  const [membershipRequired, setMembershipRequired] = useState(false);
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
    setMembershipRequired(false);
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
          catch { throw new Error(siteCopy("site.app.join.applicationform.d1dd65c775a4", {value1: String(item.name)})); }
        }
      }
      setBusy('sending');
      const response = await fetch('/api/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application, images }), signal: AbortSignal.timeout(60000),
      }).catch(() => { throw new Error(siteCopy("site.app.join.applicationform.4e2a7f3cf9e1")); });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (data.fields && typeof data.fields === 'object') { displayErrors(data.fields); setPreviewOpen(false); }
        setLoginExpired(data.code === 'login_required');
        setMembershipRequired(data.code === 'discord_membership_required');
        setUncertainId(typeof data.applicationId === 'string' ? data.applicationId : '');
        throw new Error(typeof data.error === 'string' ? data.error : siteCopy("site.app.join.applicationform.23a1d28a457a"));
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
        <Link href="/" prefetch={false} className={styles.brand} aria-label={siteCopy("site.app.join.applicationform.b7f4b9462cd0")}><Image src={SITE_LOGO} width={40} height={40} alt={""} /><span><SiteText copyKey="site.app.join.applicationform.fa228b4727d6" /><span className={styles.brandLight}><SiteText copyKey="site.app.join.applicationform.bdb3c096791a" /></span><small><SiteText copyKey="site.app.join.applicationform.7a183c580075" /></small></span></Link>
        <div className={styles.headerRight}><span className={styles.previewBadge}><span /><SiteText copyKey="site.app.join.applicationform.0612bfe2360d" /></span><Link href="/" prefetch={false}><ArrowLeftIcon /><SiteText copyKey="site.app.join.applicationform.2f0018b92363" /></Link></div>
      </div>
    </header>
    <main className={styles.main}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}><span /><SiteText copyKey="site.app.join.applicationform.243acaeecd6f" /></p>
        <h1><SiteText copyKey="site.app.join.applicationform.d92a0403e804" /><span><SiteText copyKey="site.app.join.applicationform.da8389cfb0a7" /></span></h1>
      </div>
      {!discordId && <div className={styles.notice}><div><strong><SiteText copyKey="site.app.join.applicationform.3870cbf40c98" /></strong><p><SiteText copyKey="site.app.join.applicationform.e31cc2817b40" /></p></div><Link href={LOGIN_URL} className={styles.primaryButton}><SiteText copyKey="site.app.join.applicationform.1f39c0d17884" /><ArrowRightIcon /></Link></div>}
      {receipt && <div id="application-result" className={styles.notice} role="status" tabIndex={-1}><div><strong><SiteText copyKey="site.app.join.applicationform.30050a039799" /></strong><p><SiteText copyKey="site.app.join.applicationform.c73521adcfed" /></p></div><Link href="/" className={styles.primaryButton}><SiteText copyKey="site.app.join.applicationform.2f0018b92363" /><ArrowLeftIcon /></Link></div>}
      <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); openPreview(); }}>
        {Object.keys(errors).length > 0 && <div className={styles.validationSummary} ref={errorSummary} tabIndex={-1} role="alert"><strong><SiteText copyKey="site.app.join.applicationform.c0bcc3117a57" /></strong><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><a href={`#${id}`} onClick={(event) => { event.preventDefault(); document.getElementById(id)?.focus(); document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}><SiteText namespace="site.app.join.applicationform" value={message} /></a></li>)}</ul></div>}
        <fieldset className={styles.applicationFields} disabled={!discordId || Boolean(busy) || Boolean(receipt)}>
        <Section index={0}>
          <div className={styles.twoColumns}>
            <Field label={siteCopy("site.app.join.applicationform.de14c2aa9b39")} htmlFor="discord" hint={discordId ? siteCopy("site.app.join.applicationform.fc60380116c8") : siteCopy("site.app.join.applicationform.8e37e3fe8f51")}><input {...input('discord')} placeholder={siteCopy("site.app.join.applicationform.82cffa7461ee")} readOnly inputMode="numeric" maxLength={20} /></Field>
            <Field label={siteCopy("site.app.join.applicationform.059e0dd290c4")} htmlFor="nickname"><input {...input('nickname')} placeholder={siteCopy("site.app.join.applicationform.4e97e187b3ca")} maxLength={32} /></Field>
            <Field label={siteCopy("site.app.join.applicationform.fe8aa4ef93bd")} htmlFor="gender"><select {...input('gender')}><option value=""><SiteText copyKey="site.app.join.applicationform.382f4b5559b3" /></option><option value="男"><SiteText copyKey="site.app.join.applicationform.51625d909cf3" /></option><option value="女"><SiteText copyKey="site.app.join.applicationform.26bc84961cad" /></option></select></Field>
            <Field label={siteCopy("site.app.join.applicationform.c4301894a290")} htmlFor="voice"><input {...input('voice')} placeholder={siteCopy("site.app.join.applicationform.2adfe7176cf6")} maxLength={80} /></Field>
            <Field label={siteCopy("site.app.join.applicationform.829177f6e5a4")} htmlFor="region" hint={siteCopy("site.app.join.applicationform.48965118ab8a")}><input {...input('region')} placeholder={siteCopy("site.app.join.applicationform.01fad157abdc")} maxLength={100} /></Field>
            <Field label={siteCopy("site.app.join.applicationform.ec63fe9cedf6")} htmlFor="wechat"><input {...input('wechat')} placeholder={siteCopy("site.app.join.applicationform.58fd9ddb63bc")} maxLength={64} /></Field>
          </div>
          <fieldset id="exclusive" tabIndex={-1} className={styles.fieldset}><legend><SiteText copyKey="site.app.join.applicationform.4326f5f8cc8a" /><span className={styles.required}>*</span><span className={styles.legendHint}><SiteText copyKey="site.app.join.applicationform.29473ae84081" /></span></legend>
            <div className={styles.twoColumns}><Choice name="exclusive" value="yes" checked={exclusive === '是'} onChange={() => setExclusive('是')} title={siteCopy("site.app.join.applicationform.6f40f207999e")}><SiteText copyKey="site.app.join.applicationform.ea46d9dd7dfc" /></Choice><Choice name="exclusive" value="no" checked={exclusive === '否'} onChange={() => setExclusive('否')} title={siteCopy("site.app.join.applicationform.cb0c02b7b972")}><SiteText copyKey="site.app.join.applicationform.a553dfaf3b43" /></Choice></div>
            {errors.exclusive && <p className={styles.error}>{errors.exclusive}</p>}
          </fieldset>
          <div className={styles.twoColumns}><Field label={siteCopy("site.app.join.applicationform.0e5f38cee80f")} htmlFor="guild"><input {...input('guild')} placeholder={siteCopy("site.app.join.applicationform.2d6d28f9a150")} maxLength={200} /></Field><Field label={siteCopy("site.app.join.applicationform.242dcf8cea56")} htmlFor="inviter" optional><input {...input('inviter')} placeholder={siteCopy("site.app.join.applicationform.28c38c617964")} maxLength={100} /></Field></div>
          <Field label={siteCopy("site.app.join.applicationform.43255c4b6997")} htmlFor="intro" ><textarea {...input('intro')} rows={2} placeholder={siteCopy("site.app.join.applicationform.7700ce900e95")} maxLength={20} /><span className={styles.characterCount}>{fields.intro.length} / 20</span></Field>
          <Upload id="personal-photos" title={siteCopy("site.app.join.applicationform.21a456194384")} description={<><SiteText copyKey="site.app.join.applicationform.photo.instructions" /><br /><SiteText copyKey="site.app.join.applicationform.photo.penalty" /></>} attachments={photos} />
        </Section>
        <Section index={1}>
          <fieldset className={styles.fieldset}><legend><SiteText copyKey="site.app.join.applicationform.c3b3224d1405" /><span className={styles.required}>*</span><span className={styles.legendHint}><SiteText copyKey="site.app.join.applicationform.68c7006e3833" /></span></legend>
            <div className={styles.assessmentChoices}>
              <Choice name="assessment" value="unassessed" checked={assessment === 'unassessed'} onChange={() => setAssessment('unassessed')} title={siteCopy("site.app.join.applicationform.7b4bd45a8b23")}><SiteText copyKey="site.app.join.applicationform.a7e94f11c4a4" /></Choice>
              <Choice name="assessment" value="transfer" checked={assessment === 'transfer'} onChange={() => setAssessment('transfer')} title={siteCopy("site.app.join.applicationform.18a5b6077797")}><SiteText copyKey="site.app.join.applicationform.43c8cb83bfda" /></Choice>
              <Choice name="assessment" value="passed" checked={assessment === 'passed'} onChange={() => setAssessment('passed')} title={siteCopy("site.app.join.applicationform.27d00de9c01a")}><SiteText copyKey="site.app.join.applicationform.03017eeec42d" /></Choice>
            </div>
          </fieldset>
          <Upload id="rank-images" title={siteCopy("site.app.join.applicationform.db3d76944979")} description={siteCopy("site.app.join.applicationform.2fad410f783f")} attachments={rankImages} optional />
          {assessment !== 'unassessed' && <div className={styles.conditional}>
            <div className={styles.conditionalHeading}><span />{assessment === 'transfer' ? <SiteText copyKey="site.app.join.applicationform.ff1331412957" /> : <SiteText copyKey="site.app.join.applicationform.27d00de9c01a" />}<SiteText copyKey="site.app.join.applicationform.047fbea58319" /></div>
            {assessment === 'transfer' ? <>
              <Upload id="assessment-records" title={siteCopy("site.app.join.applicationform.f5d825af156b")} description={siteCopy("site.app.join.applicationform.3fff5f4a0379")} attachments={records} />
              <Field label={siteCopy("site.app.join.applicationform.82ab38b963d6")} htmlFor="sourceGuild"><input {...input('sourceGuild')} placeholder={siteCopy("site.app.join.applicationform.17164f43db8a")} maxLength={100} /></Field>
            </> : <Upload id="passed-records" title={siteCopy("site.app.join.applicationform.4a38bb315be2")} description={siteCopy("site.app.join.applicationform.1957a342bf95")} attachments={passedRecords} />}
            <Field label={siteCopy("site.app.join.applicationform.dd48e443744a")} htmlFor="tier"><input id="tier" aria-invalid={Boolean(errors.tier)} aria-describedby={errors.tier ? 'tier-error' : undefined} value={tier} onChange={(event) => setTier(event.target.value)} placeholder={siteCopy("site.app.join.applicationform.38321ab84c5c")} maxLength={100} /></Field>
            {hasMasterDetails && <div className={styles.masterFields}><p><SiteText copyKey="site.app.join.applicationform.c2825cc01334" /></p><div className={styles.twoColumns}><Field label={siteCopy("site.app.join.applicationform.169d482b89ff")} htmlFor="card"><input {...input('card')} placeholder={siteCopy("site.app.join.applicationform.dfdcad98b810")} maxLength={80} /></Field><Field label={siteCopy("site.app.join.applicationform.c5801d82adb1")} htmlFor="heroes"><input {...input('heroes')} placeholder={siteCopy("site.app.join.applicationform.4d014b4055a7")} maxLength={150} /></Field></div></div>}
            <p className={styles.hint}><SiteText copyKey="site.app.join.applicationform.e485f3b1d6cd" /></p>
          </div>}
        </Section>
        <Section index={2}>
          <div className={styles.fieldTitle}><p><SiteText copyKey="site.app.join.applicationform.5f68c9555b73" /><span className={styles.required}>*</span></p><span><SiteText copyKey="site.app.join.applicationform.cbcafa2eaa3c" /></span></div>
          <div className={styles.gameList}>{games.map((game, index) => <div key={game.id} className={styles.gameRow}>
            <div className={styles.gameHeading}><span><SiteText copyKey="site.app.join.applicationform.599b829d2f93" />{String(index + 1).padStart(2, '0')}</span>{games.length > 1 && <button type="button" className={styles.removeGame} aria-label={siteCopy("site.app.join.applicationform.f0bfc3ceba54", {value1: String(index + 1)})} onClick={() => setGames((previous) => previous.filter((entry) => entry.id !== game.id))}><XMarkIcon /><SiteText copyKey="site.app.join.applicationform.2f752c005ec5" /></button>}</div>
            <div className={styles.gameFields}>
              <Field label={siteCopy("site.app.join.applicationform.763ef1ba9a5c")} htmlFor={`game-${game.id}`}><input id={`game-${game.id}`} aria-invalid={Boolean(errors[`game-${game.id}`])} aria-describedby={errors[`game-${game.id}`] ? `game-${game.id}-error` : undefined} list="game-options" value={game.name} onChange={(event) => updateGame(game.id, 'name', event.target.value)} placeholder={siteCopy("site.app.join.applicationform.e5f1ce66cfc8")} maxLength={80} /></Field>
              <Field label={siteCopy("site.app.join.applicationform.7b2d5d633c9a")} htmlFor={`level-${game.id}`}><input id={`level-${game.id}`} aria-invalid={Boolean(errors[`level-${game.id}`])} aria-describedby={errors[`level-${game.id}`] ? `level-${game.id}-error` : undefined} value={game.level} onChange={(event) => updateGame(game.id, 'level', event.target.value)} placeholder={siteCopy("site.app.join.applicationform.ad461aa9af5f")} maxLength={100} /></Field>
              <Field label={siteCopy("site.app.join.applicationform.0b370511a765")} htmlFor={`price-${game.id}`}><div className={styles.priceInput}><span>¥</span><input id={`price-${game.id}`} aria-invalid={Boolean(errors[`price-${game.id}`])} aria-describedby={errors[`price-${game.id}`] ? `price-${game.id}-error` : undefined} type="number" min="0" step="0.01" value={game.price} onChange={(event) => updateGame(game.id, 'price', event.target.value)} placeholder={siteCopy.text("0.00", "site.app.join.applicationform")} /><select aria-label={siteCopy("site.app.join.applicationform.edcee40ed129", {value1: String(index + 1)})} value={game.unit} onChange={(event) => updateGame(game.id, 'unit', event.target.value)}><option value="小时">/ 小时</option><option value="局">/ 局</option></select></div></Field>
            </div>
          </div>)}</div>
          <datalist id="game-options">{GAME_NAMES.map((name) => <option key={name} value={name} />)}</datalist>
          <button type="button" className={styles.addGame} disabled={games.length >= MAX_JOIN_GAMES} onClick={() => { const id = nextGameId.current++; setGames((previous) => [...previous, { id, name: '', level: '', price: '', unit: '小时' }]); }}><PlusIcon />{games.length >= MAX_JOIN_GAMES ? <SiteText copyKey="site.app.join.applicationform.ed5d84d7177c" values={{value1: String(MAX_JOIN_GAMES)}} /> : <SiteText copyKey="site.app.join.applicationform.71ab693d1a13" />}</button>
          <Field label={siteCopy("site.app.join.applicationform.04d3ffc8a012")} htmlFor="otherGames" optional><textarea {...input('otherGames')} rows={2} placeholder={siteCopy("site.app.join.applicationform.0852c1ceffb6")} maxLength={500} /></Field>
        </Section>
        </fieldset>
        {!receipt && <div className={styles.formFooter}><div><strong><SiteText copyKey="site.app.join.applicationform.b4de692de5d0" /></strong><p><SiteText copyKey="site.app.join.applicationform.1260d9b5dbbf" /></p></div><button type="submit" className={styles.primaryButton} disabled={!discordId || Boolean(busy)}><SiteText copyKey="site.app.join.applicationform.0577dbc6f6af" /><ArrowRightIcon /></button></div>}
        {sendError && !previewOpen && <p className={styles.error} role="alert">{sendError}</p>}
      </form>
      <footer className={styles.footer}><span><SiteText copyKey="site.app.join.applicationform.7c23d632063f" /></span><span><SiteText copyKey="site.app.join.applicationform.10a046039bd5" /></span></footer>
    </main>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="application-preview-title" onClose={() => setPreviewOpen(false)} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) setPreviewOpen(false); }}>
      <div className={styles.dialogHeader}><div><p><SiteText copyKey="site.app.join.applicationform.2a88a05faabe" /></p><h2 id="application-preview-title"><SiteText copyKey="site.app.join.applicationform.40e2bac81db9" /></h2></div><button type="button" disabled={Boolean(busy)} onClick={() => setPreviewOpen(false)} aria-label={siteCopy("site.app.join.applicationform.032fc4ad2392")}><XMarkIcon /></button></div>
      <div className={styles.dialogBody}><p className={styles.dialogNotice}><SiteText copyKey="site.app.join.applicationform.e1d5f82c28df" /></p>
        <dl className={styles.summary}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value.trim() ? styles.emptyValue : undefined}>{value.trim() || <SiteText copyKey="site.app.join.applicationform.287a1d10348b" />}</dd></div>)}</dl>
        <div className={styles.summaryGames}><h3><SiteText copyKey="site.app.join.applicationform.7cb36cd3d41e" /></h3>{games.map((game, index) => <div key={game.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{game.name || <SiteText copyKey="site.app.join.applicationform.e97c86b9306a" />}</strong><p>{game.level || <SiteText copyKey="site.app.join.applicationform.257ec9ebc061" />}</p></div><b>{game.price ? <SiteText copyKey="site.app.join.applicationform.2a8dc1838c28" values={{value1: String(game.price), value2: String(game.unit)}} /> : <SiteText copyKey="site.app.join.applicationform.5a5a604deb8b" />}</b></div>)}</div>
        {[{ title: siteCopy("site.app.join.applicationform.db3d76944979"), items: rankImages.items }, ...(assessment === 'transfer' ? [{ title: siteCopy("site.app.join.applicationform.f5d825af156b"), items: records.items }] : []), ...(assessment === 'passed' ? [{ title: siteCopy("site.app.join.applicationform.4a38bb315be2"), items: passedRecords.items }] : []), { title: siteCopy("site.app.join.applicationform.21a456194384"), items: photos.items }].map((group) => <div className={styles.summaryImages} key={group.title}><h3>{group.title}<span>{group.items.length}<SiteText copyKey="site.app.join.applicationform.9273cc90ea18" /></span></h3>{group.items.length ? <div>{group.items.map((item) => <img key={item.id} src={item.url} alt={siteCopy("site.app.join.applicationform.e9cd8dc12918", {value1: String(group.title), value2: String(item.name)})} />)}</div> : <p><SiteText copyKey="site.app.join.applicationform.549bb78bd2f2" /></p>}</div>)}
      </div>
      {sendError && <div className={styles.submitError} role="alert"><p>{sendError}</p>{uncertainId && <p><SiteText copyKey="site.app.join.applicationform.a58b214bfd9f" />{uncertainId}</p>}{loginExpired && <Link href={LOGIN_URL}><SiteText copyKey="site.app.join.applicationform.e51c78df3bdd" /></Link>}{membershipRequired && <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}><SiteText copyKey="site.app.join.applicationform.4fcca05e8733" /><ArrowRightIcon /></a>}</div>}
      <div className={styles.dialogFooter}><button type="button" disabled={Boolean(busy)} className={styles.secondaryButton} onClick={() => setPreviewOpen(false)}><SiteText copyKey="site.app.join.applicationform.9a233f23b4ec" /></button><button type="button" disabled={Boolean(busy) || loginExpired || Boolean(uncertainId)} className={styles.primaryButton} onClick={submitApplication}>{busy === 'preparing' ? <SiteText copyKey="site.app.join.applicationform.2402420b805d" /> : busy === 'sending' ? <SiteText copyKey="site.app.join.applicationform.a822c08742d9" /> : membershipRequired ? <SiteText copyKey="site.app.join.applicationform.f1a9aae2f4e7" /> : <SiteText copyKey="site.app.join.applicationform.d3877dc1f70a" />}<ArrowRightIcon /></button></div>
    </dialog>
  </div></ValidationContext.Provider>;
}
