import { forwardRef } from 'react';
import { cn } from '../utils/cn.js';

/**
 * Card: bordered surface. Props: as (tag, 'div'), padded (default true), interactive (hover state),
 * flat (no border emphasis), className, plus native props.
 */
const Card = forwardRef(function Card({ as: Tag = 'div', padded = true, interactive, className, children, ...rest }, ref) {
  return (
    <Tag ref={ref} className={cn('card', padded && 'card--padded', interactive && 'card--interactive', className)} {...rest}>
      {children}
    </Tag>
  );
});

export default Card;
