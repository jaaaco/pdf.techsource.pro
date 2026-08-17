/**
 * The icon set from the design doc.
 *
 * These are the same 24x24 stroked outlines the mocks use, inlined rather
 * than pulled from an icon package: the whole set below is smaller than the
 * tree-shaken slice of any library, and it keeps `stroke="currentColor"` so
 * every icon follows the text colour through the theme swap without a prop.
 *
 * All of them are decorative - the surrounding button or link carries the
 * label - so they are `aria-hidden` by default. Pass `title` on the rare one
 * that has to stand on its own.
 */

import React from 'react'

export interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
  title?: string
  style?: React.CSSProperties
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 20,
  className,
  strokeWidth = 2,
  title,
  style,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title && <title>{title}</title>}
    {children}
  </svg>
)

export const UploadIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5" />
    <path d="M12 3v13" />
  </Svg>
)

export const DownloadIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Svg>
)

export const CompressIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m7 20 5-5 5 5" />
    <path d="m7 4 5 5 5-5" />
  </Svg>
)

export const MergeIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m12 2 10 5-10 5L2 7l10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </Svg>
)

export const SplitIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88" />
    <path d="M14.8 14.8 20 20" />
    <path d="M8.12 8.12 12 12" />
  </Svg>
)

export const OcrIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 9h10" />
    <path d="M7 13h7" />
  </Svg>
)

export const ShieldIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)

export const FileIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </Svg>
)

export const TrashIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
)

export const PlusIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
)

export const CheckIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const CloseIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
)

export const ArrowRightIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
)

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
)

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const ChevronUpIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m18 15-6-6-6 6" />
  </Svg>
)

export const HomeIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
)

export const GridIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </Svg>
)

export const BookIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </Svg>
)

export const MoreIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Svg>
)

export const MoonIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Svg>
)

export const SunIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m5 5 1.5 1.5" />
    <path d="M17.5 17.5 19 19" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M5 19l1.5-1.5" />
    <path d="M17.5 6.5 19 5" />
  </Svg>
)

export const GripIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Svg>
)

export const InfoIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Svg>
)

export const AlertIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Svg>
)

export const ScaleIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </Svg>
)

export const BugIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="m8 2 1.88 1.88" />
    <path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
    <path d="M6 13H2" />
    <path d="M22 13h-4" />
  </Svg>
)

export const MailIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Svg>
)

export const SearchIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)

export const GitHubIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </Svg>
)
