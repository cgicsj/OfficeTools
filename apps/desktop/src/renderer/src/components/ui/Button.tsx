import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ButtonVariant;
};

export const Button = ({
  children,
  icon,
  variant = 'secondary',
  className = '',
  type = 'button',
  ...buttonProps
}: ButtonProps): JSX.Element => {
  const classNames = ['button', `button--${variant}`, className].filter(Boolean).join(' ');

  return (
    <button className={classNames} type={type} {...buttonProps}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span className="button__label">{children}</span>
    </button>
  );
};

