export type Tone = 'red' | 'gold' | 'ink' | 'olive';

export type MediaAsset =
  | {
      type: 'image';
      src: string;
      alt: string;
    }
  | {
      type: 'video';
      mp4: string;
      webm?: string;
      poster?: string;
      alt: string;
    };

export type NavItem = {
  label: string;
  href: string;
};

export type HeroCard = {
  letter: string;
  title: string;
  text: string;
  tone: Tone;
  media: MediaAsset;
};

export type StoryCard = {
  title: string;
  eyebrow: string;
  text: string;
  media: MediaAsset;
};

export type GalleryCard = {
  title: string;
  caption: string;
  media: MediaAsset;
};

export type TicketTier = {
  name: string;
  audience: string;
  price: string;
  note: string;
  features: string[];
  media: MediaAsset;
};

const WEBFLOW_ASSET_ROOT =
  '/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed';

function asset(path: string) {
  return `${WEBFLOW_ASSET_ROOT}/${path}`;
}

export const defaultNewHomeContent = {
  seo: {
    title: 'Warhol Arts Rebuilt',
    description:
      'A maintainable Next.js edition of the Warhol-inspired landing page, rebuilt from local assets and editable content blocks.',
  },
  navItems: [
    { label: 'Intro', href: '#hero' },
    { label: 'Elvis', href: '#elvis' },
    { label: 'Quote', href: '#quote' },
    { label: 'Monroe', href: '#monroe' },
    { label: 'Expo', href: '#expo' },
    { label: 'Tickets', href: '#tickets' },
  ] satisfies NavItem[],
  hero: {
    eyebrow: 'Prague, Czech Republic // 2025',
    title: 'Andy Warhol, rebuilt as a page you can actually edit.',
    description:
      'This version keeps the loud editorial tone of the reference, but the page is now split into reusable components, local media, and plain content data you can change without touching a giant mirrored HTML file.',
    primaryCta: {
      label: 'See ticket layouts',
      href: '#tickets',
    },
    secondaryCta: {
      label: 'Open 404 room',
      href: '/newhome/404',
    },
    stats: [
      { value: '80+', label: 'works referenced' },
      { value: '6', label: 'editable sections' },
      { value: '100%', label: 'local asset paths' },
    ],
    background: asset('671909bf803b9bd37a5e3c97_bg-hero_andy.avif'),
    logo: asset('67195098c93410168b7a9196_Logo.svg'),
  },
  heroCards: [
    {
      letter: 'W',
      title: 'Cow Wallpaper',
      text: 'Pattern, fame, repetition, and a surface that refuses to stay quiet.',
      tone: 'red',
      media: {
        type: 'video',
        mp4: asset('6919c78fa82e91cc2c752b23_Cow_video_mp4.mp4'),
        webm: asset('6919c78fa82e91cc2c752b23_Cow_video_webm.webm'),
        poster: asset('6932f3234e126028668334e4_sticker_cow.webp'),
        alt: 'Animated cow artwork panel.',
      },
    },
    {
      letter: 'A',
      title: 'Marilyn Loop',
      text: 'The portrait becomes rhythm when color is treated like a broadcast signal.',
      tone: 'gold',
      media: {
        type: 'video',
        mp4: asset('6919c7b78fde4561a84e233b_Marilyn_video_mp4.mp4'),
        webm: asset('6919c7b78fde4561a84e233b_Marilyn_video_webm.webm'),
        poster: asset('671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5.avif'),
        alt: 'Animated Marilyn Monroe artwork panel.',
      },
    },
    {
      letter: 'R',
      title: 'Pete Rose',
      text: 'Celebrity becomes product once the face is ready for endless replay.',
      tone: 'ink',
      media: {
        type: 'video',
        mp4: asset('6919ccd90a94a7e0a7915eec_Pete-Rose_video-new_mp4.mp4'),
        webm: asset('6919ccd90a94a7e0a7915eec_Pete-Rose_video-new_webm.webm'),
        poster: asset('67308335b3d89a8fcc3c0ed1_c929525a29c79a3351ecde820b3c3b31a964278b-1003x1000.avif'),
        alt: 'Animated Pete Rose artwork panel.',
      },
    },
    {
      letter: 'H',
      title: 'Royal Print',
      text: 'A portrait can stay regal and still feel machine-made at the same time.',
      tone: 'olive',
      media: {
        type: 'video',
        mp4: asset('6919c7bb8db2cf6fcdb42e9c_Queen-Elizabeth-II_video_mp4.mp4'),
        webm: asset('6919c7bb8db2cf6fcdb42e9c_Queen-Elizabeth-II_video_webm.webm'),
        poster: asset('673083353fd2ebb2fce968e1_9b2e61f0e0d8a6ec8d56b4bc8c84e8ec6795aee9-1000x1249.avif'),
        alt: 'Animated Queen Elizabeth artwork panel.',
      },
    },
    {
      letter: 'O',
      title: 'Ingrid Frame',
      text: 'Soft glamour, hard cropping, and a cinematic stare turned into a specimen.',
      tone: 'gold',
      media: {
        type: 'video',
        mp4: asset('6919c7b3ccd7c46fc1cf5431_Ingrid-Bergman-With-Hat_video_mp4.mp4'),
        webm: asset('6919c7b3ccd7c46fc1cf5431_Ingrid-Bergman-With-Hat_video_webm.webm'),
        poster: asset('67308335ee33049f98f63de0_5b2ca188f26b4be22f83dcb7ef064a1e460db942-1316x2000.avif'),
        alt: 'Animated Ingrid Bergman artwork panel.',
      },
    },
    {
      letter: 'L',
      title: 'Jimmy Carter',
      text: 'The political image flattens into the same bright arena as pop celebrity.',
      tone: 'red',
      media: {
        type: 'video',
        mp4: asset('6919c7c51e45f5c5b6368400_Jimmy-Carter_video_mp4.mp4'),
        webm: asset('6919c7c51e45f5c5b6368400_Jimmy-Carter_video_webm.webm'),
        poster: asset('673083364440cf072bc513ef_211e3dd626ecfd3eb995276943ee81cb2a238463-1920x2968.avif'),
        alt: 'Animated Jimmy Carter artwork panel.',
      },
    },
  ] satisfies HeroCard[],
  spotlight: {
    sectionNumber: '001',
    sectionTitle: 'Four Elvises',
    kicker: 'Mass media as choreography',
    heading: 'A single image repeated until it feels like velocity.',
    body: 'This section is now just data plus a component. You can swap the text, replace the image, move the bullets, or even replace the whole layout without untangling Webflow runtime code.',
    points: [
      'Edit the headline and body copy in one content file.',
      'Replace the artwork or supporting cards with any local image/video path.',
      'Duplicate the section component to add another featured work.',
    ],
    feature: {
      type: 'image',
      src: asset('6719f97569304d338ba273b0_elvis-presley-4.avif'),
      alt: 'Four Elvises feature image.',
    } satisfies MediaAsset,
  },
  storyCards: [
    {
      eyebrow: 'Factory logic',
      title: 'Screenprint as a system',
      text: 'The work stays glamorous, but the process turns the icon into inventory.',
      media: {
        type: 'image',
        src: asset('6755a51958b8db2a614d0745_andy_1.avif'),
        alt: 'Andy Warhol portrait artwork.',
      },
    },
    {
      eyebrow: 'Shot and replayed',
      title: 'Violence wrapped in polish',
      text: 'A cowboy pose becomes branding, and branding becomes myth.',
      media: {
        type: 'image',
        src: asset('6755a51922638acab5c5ef17_andy_7.avif'),
        alt: 'Andy Warhol artwork detail.',
      },
    },
    {
      eyebrow: 'Contemporary result',
      title: 'Built for rearrangement',
      text: 'This section can become a carousel, a two-column story, or a new component entirely.',
      media: {
        type: 'image',
        src: asset('693c21f124713c22f02782b0_photo-us.webp'),
        alt: 'Editorial exhibition photo.',
      },
    },
  ] satisfies StoryCard[],
  quote: {
    text: 'In the future, everybody will be world-famous for 15 minutes.',
    attribution: 'Andy Warhol',
    supportingText:
      'Now it lives in a section component, so the quote, attribution, and side notes can be replaced without touching layout code.',
  },
  gallery: {
    sectionNumber: '002',
    sectionTitle: 'Monroe Grid',
    intro:
      'A configurable gallery section for portraits, copy blocks, or product tiles. Replace any card below by editing the array, not the markup structure.',
  },
  galleryCards: [
    {
      title: 'Electric Pink',
      caption: 'High contrast color blocks and soft edges.',
      media: {
        type: 'image',
        src: asset('671a9b553bbff2f4d647087a_Marilyn_Monroe_1.avif'),
        alt: 'Marilyn Monroe portrait in bright tones.',
      },
    },
    {
      title: 'Off-register Blue',
      caption: 'Slight misalignment becomes part of the look.',
      media: {
        type: 'image',
        src: asset('671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2.avif'),
        alt: 'Marilyn Monroe portrait in blue tones.',
      },
    },
    {
      title: 'Hard Yellow',
      caption: 'Color behaves like signage instead of skin.',
      media: {
        type: 'image',
        src: asset('671a9b55878ce1c00230864d_Marilyn_Monroe_3.avif'),
        alt: 'Marilyn Monroe portrait in yellow tones.',
      },
    },
    {
      title: 'Print Noise',
      caption: 'Texture stays visible so the image never feels too clean.',
      media: {
        type: 'image',
        src: asset('671a9b557f48c7dfeeedec36_Marilyn_Monroe_4.avif'),
        alt: 'Marilyn Monroe portrait with print texture.',
      },
    },
    {
      title: 'Afterimage',
      caption: 'Repeated faces start to feel like a public memory.',
      media: {
        type: 'image',
        src: asset('671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5.avif'),
        alt: 'Marilyn Monroe portrait with saturated color treatment.',
      },
    },
    {
      title: 'Signal Fade',
      caption: 'A portrait can read like both glamour and static.',
      media: {
        type: 'image',
        src: asset('671a9b553d235fe76002511f_Marilyn_Monroe_6.avif'),
        alt: 'Marilyn Monroe portrait with soft grain and color.',
      },
    },
  ] satisfies GalleryCard[],
  lab: {
    sectionNumber: '003',
    sectionTitle: 'Pop Fragments',
    heading: 'Use one section as a sandbox for new layouts, stickers, promos, or campaign blocks.',
    text: 'This area intentionally mixes media types. It is useful when you want to test a new layout module before rolling it out across the rest of the page.',
    chips: ['Campaign banner', 'Sticker layer', 'SVG shape', 'Product callout'],
    poster: asset('6923010d6cec67374a34b2d7_banner_mouth.webp'),
    sticker: asset('6932f3234e126028668334e4_sticker_cow.webp'),
    colaVisual: asset('6932ada7a7b613eba979c0ad_721188c26b8b1b025ef6abd0de9862b1_cola_visual.svg'),
    paints: [
      asset('6921d275ea88b11f73b5e83d_paint_red.svg'),
      asset('6921d2758b543c94a5d92b96_paint_yellow.svg'),
      asset('6921d27589707490722d179f_paint_blue.svg'),
    ],
  },
  expo: {
    sectionNumber: '004',
    sectionTitle: 'Expo Notes',
    intro:
      'The schedule and metric cards below are plain arrays. Add a new stop, rename a field, or reorder the blocks without rewriting the section.',
    metrics: [
      { value: '14/11', label: 'opening night' },
      { value: '22/11', label: 'public run ends' },
      { value: '3', label: 'editable content columns' },
    ],
    schedule: [
      {
        title: 'Arrival',
        text: 'Hero, identity, and exhibition framing live in one block.',
      },
      {
        title: 'Portrait wall',
        text: 'Use a grid for works, testimonials, merch, or sponsor units.',
      },
      {
        title: 'Ticket conversion',
        text: 'Swap cards, prices, labels, or CTA copy from the content file.',
      },
    ],
    featureCards: [
      {
        title: 'Editorial image',
        caption: 'A supporting image can be changed independently from the copy.',
        media: {
          type: 'image',
          src: asset('693c21f124713c22f02782b0_photo-us.webp'),
          alt: 'Exhibition production photo.',
        },
      },
      {
        title: 'Readable structure',
        caption: 'Each component owns one job instead of one huge page script.',
        media: {
          type: 'image',
          src: asset('6922f8d45ff23fcb91dc3a56_9413a510f4469f79faa7d4a985fb1f95_banner_lips.webp'),
          alt: 'Pop art lips illustration.',
        },
      },
    ] satisfies GalleryCard[],
  },
  tickets: {
    sectionNumber: '005',
    sectionTitle: 'Ticket Blocks',
    intro:
      'These cards are fully local and data-driven. Add a new plan, rename a feature, or point the CTA at your own booking flow later.',
  },
  ticketTiers: [
    {
      name: 'Personal',
      audience: 'Solo visitors',
      price: '$24',
      note: 'Best for a self-paced visit through the full exhibition route.',
      features: ['Timed entry window', 'Printed guide', 'Priority on weekends'],
      media: {
        type: 'image',
        src: asset('67936942815e4c168ed2e35f_ticket-personal-book-matter.avif'),
        alt: 'Personal ticket graphic.',
      },
    },
    {
      name: 'Student',
      audience: 'Learners and researchers',
      price: '$16',
      note: 'For art students, classes, and anyone studying visual culture.',
      features: ['Discounted admission', 'Archive notes', 'Flexible re-entry'],
      media: {
        type: 'image',
        src: asset('6793694222b9091b44302424_ticket-student-book-matter.avif'),
        alt: 'Student ticket graphic.',
      },
    },
    {
      name: 'Group',
      audience: 'Clubs and teams',
      price: '$54',
      note: 'A shared entry option with room for custom itinerary notes later.',
      features: ['Up to 4 guests', 'Shared booking reference', 'Host greeting block'],
      media: {
        type: 'image',
        src: asset('67936942c4c3db8d0547074d_ticket-group-book-matter.avif'),
        alt: 'Group ticket graphic.',
      },
    },
  ] satisfies TicketTier[],
  cta: {
    heading: 'Make this page yours next.',
    text: 'Swap the palette, drop in your own sections, connect the CTA to a real booking flow, or replace the whole hero with a product launch. The structure is meant to be edited.',
    action: {
      label: 'Back to top',
      href: '#hero',
    },
  },
  footer: {
    caption: 'Curated for fast iteration, local media, and future layout changes.',
    links: [
      { label: 'Instagram', href: 'https://www.instagram.com/blacklead.studio/' },
      { label: 'Dribbble', href: 'https://dribbble.com/blacklead-studio' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/blacklead-studio/' },
    ],
  },
};

export const defaultNewHome404Content = {
  title: 'The artwork moved, not the structure.',
  text: 'This 404 page is now a normal Next.js route too. Edit the copy, swap the art, or rebuild the layout without depending on the mirrored Webflow page.',
  homeHref: '/newhome',
  homeLabel: 'Return to newhome',
  media: {
    type: 'image',
    src: asset('678f81ec384996366052d5f7_404-mask-3-1.avif'),
    alt: 'Abstract Warhol inspired 404 artwork.',
  } satisfies MediaAsset,
};

export type NewHomeContent = typeof defaultNewHomeContent;
export type NewHome404Content = typeof defaultNewHome404Content;

export type NewHomeContentDocument = {
  newHomeContent: NewHomeContent;
  newHome404Content: NewHome404Content;
};

export const defaultNewHomeContentDocument: NewHomeContentDocument = {
  newHomeContent: defaultNewHomeContent,
  newHome404Content: defaultNewHome404Content,
};
