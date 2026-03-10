import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  block?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Icon element (Material Symbols or custom) */
  icon?: ReactNode;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
}

/**
 * Pale Blue Dot Button Component
 *
 * A contemplative button design inspired by Carl Sagan's perspective.
 * Features soft shadows, subtle gradients, and cosmic depth.
 *
 * @example
 * ```tsx
 * <Button variant="primary">Create Page</Button>
 * <Button variant="secondary" size="sm">Cancel</Button>
 * <Button variant="icon" icon={<span className="material-symbols-outlined">add</span>} />
 * <Button variant="danger" loading>Deleting...</Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      block = false,
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) => {
    const classes = [
      'pbd-btn',
      `pbd-btn-${variant}`,
      size !== 'md' && `pbd-btn-${size}`,
      block && 'pbd-btn-block',
      loading && 'pbd-btn-loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...rest}
      >
        {icon && iconPosition === 'left' && icon}
        {children}
        {icon && iconPosition === 'right' && icon}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Button Group Component
 *
 * Groups buttons together with consistent spacing.
 *
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="secondary">Cancel</Button>
 *   <Button variant="primary">Confirm</Button>
 * </ButtonGroup>
 * ```
 */
interface ButtonGroupProps {
  children: ReactNode;
  /** Spacing between buttons */
  spacing?: 'normal' | 'compact' | 'attached';
  className?: string;
}

export function ButtonGroup({
  children,
  spacing = 'normal',
  className = '',
}: ButtonGroupProps) {
  const classes = [
    'pbd-btn-group',
    spacing === 'compact' && 'pbd-btn-group-compact',
    spacing === 'attached' && 'pbd-btn-group-attached',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}
