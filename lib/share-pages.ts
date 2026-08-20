export const SHAREABLE_PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'business', label: 'Business breakdown' },
  { id: 'audience', label: 'Audience' },
  { id: 'google', label: 'Google Ads' },
  { id: 'meta', label: 'Meta Ads' },
  { id: 'taxonomy', label: 'Media plan' },
] as const;

export type SharePageId = (typeof SHAREABLE_PAGES)[number]['id'];