export type CopyImageSlot = {
  key: string;
  placement: 'image' | 'thumbnail' | 'background';
  defaultSrc?: string;
};
export type CopyImageBinding = {
  unitId: string;
  variantId?: string;
  examples?: Readonly<Record<string, string | number>>;
  images: readonly CopyImageSlot[];
};
export type CopyImageOnlyUnit = {
  id: string;
  title: string;
  source: string;
  imageKey: string;
};
