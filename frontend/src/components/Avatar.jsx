import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { initials } from '../utils/format.js';

/** Avatar: image with initials fallback. Props: name, src, size (px, 32), className. */
export default function Avatar({ name = '', src, size = 32, className }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src && !failed) {
    return <img className={cn('avatar', className)} src={src} alt="" style={style} onError={() => setFailed(true)} />;
  }
  return (
    <span className={cn('avatar avatar--initials', className)} style={style} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}
