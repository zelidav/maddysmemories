interface Props {
  variant:
    | 'daffodil' | 'tulip' | 'leaf'
    | 'daffodil-mini' | 'tulip-mini' | 'leaf-mini';
  className?: string;
}

export default function FloralAccent({ variant, className }: Props) {
  switch (variant) {
    case 'daffodil':
      return (
        <svg className={className} viewBox="0 0 60 60" fill="none" aria-hidden="true">
          <g>
            <ellipse cx="30" cy="20" rx="6" ry="14" fill="#F5C842" />
            <ellipse cx="20" cy="22" rx="6" ry="14" fill="#F5C842" transform="rotate(-50 20 22)" />
            <ellipse cx="40" cy="22" rx="6" ry="14" fill="#F5C842" transform="rotate(50 40 22)" />
            <ellipse cx="22" cy="32" rx="6" ry="14" fill="#F5C842" transform="rotate(-110 22 32)" />
            <ellipse cx="38" cy="32" rx="6" ry="14" fill="#F5C842" transform="rotate(110 38 32)" />
            <circle cx="30" cy="27" r="6" fill="#E8574A" />
            <circle cx="30" cy="27" r="3.5" fill="#FBE7A6" />
            <path d="M30 33 Q26 50 30 60" stroke="#7DAF6E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M28 50 q-8 -2 -10 -10" stroke="#7DAF6E" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'tulip':
      return (
        <svg className={className} viewBox="0 0 60 60" fill="none" aria-hidden="true">
          <g>
            <path d="M30 10 C20 12, 18 28, 22 32 L38 32 C42 28, 40 12, 30 10 Z" fill="#E8574A" />
            <path d="M22 32 C24 24, 28 22, 30 22 L30 32 Z" fill="#C73E32" />
            <path d="M38 32 C36 24, 32 22, 30 22 L30 32 Z" fill="#C73E32" />
            <path d="M30 32 Q26 50 30 60" stroke="#7DAF6E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M30 45 q10 -3 14 -12" stroke="#7DAF6E" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'leaf':
      return (
        <svg className={className} viewBox="0 0 60 60" fill="none" aria-hidden="true">
          <path d="M10 50 C 20 20, 40 10, 55 8 C 50 30, 35 50, 10 50 Z" fill="#7DAF6E" />
          <path d="M14 46 C 24 28, 38 18, 50 12" stroke="#5e8e51" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'daffodil-mini':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <circle cx="12" cy="11" r="3.5" fill="#E8574A" />
          <ellipse cx="12" cy="6" rx="2.2" ry="4.5" fill="#F5C842" />
          <ellipse cx="6.5" cy="9" rx="2.2" ry="4.5" fill="#F5C842" transform="rotate(-60 6.5 9)" />
          <ellipse cx="17.5" cy="9" rx="2.2" ry="4.5" fill="#F5C842" transform="rotate(60 17.5 9)" />
          <ellipse cx="8" cy="15" rx="2.2" ry="4.5" fill="#F5C842" transform="rotate(-120 8 15)" />
          <ellipse cx="16" cy="15" rx="2.2" ry="4.5" fill="#F5C842" transform="rotate(120 16 15)" />
          <circle cx="12" cy="11" r="1.6" fill="#FBE7A6" />
        </svg>
      );
    case 'tulip-mini':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path d="M12 4 C7 5, 6 14, 8 16 L16 16 C18 14, 17 5, 12 4 Z" fill="#E8574A" />
          <path d="M8 16 C9 12, 11 11, 12 11 L12 16 Z" fill="#C73E32" />
          <path d="M16 16 C15 12, 13 11, 12 11 L12 16 Z" fill="#C73E32" />
          <path d="M12 16 V 22" stroke="#7DAF6E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'leaf-mini':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path d="M4 20 C 8 8, 16 4, 22 3 C 20 12, 14 20, 4 20 Z" fill="#7DAF6E" />
          <path d="M6 18 C 10 11, 16 7, 20 5" stroke="#5e8e51" strokeWidth="1" fill="none" />
        </svg>
      );
  }
}
