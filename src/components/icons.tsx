/** SF-Symbols-flavoured line icons: rounded caps, 1.75 stroke, 24px grid. */
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: Props, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ));

export const ListIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <circle cx="4.2" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ));

export const ForkIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M7 3v6a2.5 2.5 0 0 0 5 0V3" />
      <path d="M9.5 11.5V21" />
      <path d="M17.5 3c-1.4 1.2-2 3-2 5.2 0 1.8.7 3 2 3.3V21" />
    </>
  ));

export const PieIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15z" />
    </>
  ));

export const GearIcon = (p: Props) =>
  base(p, (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7" />
    </>
  ));

export const PlusIcon = (p: Props) => base(p, <path d="M12 5v14M5 12h14" />);

export const XIcon = (p: Props) => base(p, <path d="M6 6l12 12M18 6L6 18" />);

export const CheckIcon = (p: Props) => base(p, <path d="M4.5 12.5l5 5 10-11" />);

export const TrashIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.5 6.5l.8 12.2A1.5 1.5 0 0 0 8.8 20h6.4a1.5 1.5 0 0 0 1.5-1.3l.8-12.2" />
      <path d="M10.5 10v6M13.5 10v6" />
    </>
  ));

export const ChevronLeftIcon = (p: Props) => base(p, <path d="M14.5 5.5 8 12l6.5 6.5" />);
export const ChevronRightIcon = (p: Props) => base(p, <path d="M9.5 5.5 16 12l-6.5 6.5" />);

export const PencilIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ));

export const AlertIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ));

export const BackspaceIcon = (p: Props) =>
  base(p, (
    <>
      <path d="M8.5 5.5H19A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H8.5L3 12z" />
      <path d="M11.5 9.5l5 5M16.5 9.5l-5 5" />
    </>
  ));
