import { cloneElement, useId, useState } from 'react';

/**
 * Tooltip shown on hover and keyboard focus. Props: content (string), children (a single focusable element), side ('top'|'bottom').
 * For icon-only buttons prefer IconButton (it has an aria-label); use Tooltip to add extra explanation.
 */
export default function Tooltip({ content, children, side = 'top' }) {
  const [open, setOpen] = useState(false);
  const id = `tt${useId().replace(/:/g, '')}`;
  if (!content) return children;
  return (
    <span className="tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && <span role="tooltip" id={id} className={`tooltip__bubble tooltip__bubble--${side}`}>{content}</span>}
    </span>
  );
}
