import { Clapperboard, Facebook, Globe, Instagram, Linkedin, Youtube } from 'lucide-react';
import { platformLabel } from '../utils/constants.js';
import { cn } from '../utils/cn.js';

function XMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.75 3h3.05l-6.66 7.6L22 21h-6.13l-4.8-6.28L5.58 21H2.53l7.12-8.14L2 3h6.28l4.34 5.74L17.75 3Zm-1.07 16.2h1.69L7.4 4.7H5.58l11.1 14.5Z" />
    </svg>
  );
}

const ICONS = { instagram: Instagram, youtube: Youtube, youtube_shorts: Clapperboard, facebook: Facebook, linkedin: Linkedin, other: Globe };

/**
 * PlatformIcon. Props: platform (slug), size (16), withLabel (show the name next to the icon), className.
 * Decorative unless withLabel is false and `title` is wanted: the slug label is exposed via title.
 */
export default function PlatformIcon({ platform, size = 16, withLabel = false, className }) {
  const slug = String(platform || 'other').toLowerCase();
  const Icon = ICONS[slug];
  const label = platformLabel(slug);
  const glyph = slug === 'x' ? <XMark size={size} /> : Icon ? <Icon size={size} aria-hidden="true" /> : <Globe size={size} aria-hidden="true" />;
  return (
    <span className={cn('platform-icon', withLabel && 'platform-icon--label', className)} title={label} aria-label={withLabel ? undefined : label} role={withLabel ? undefined : 'img'}>
      {glyph}
      {withLabel && <span>{label}</span>}
    </span>
  );
}
