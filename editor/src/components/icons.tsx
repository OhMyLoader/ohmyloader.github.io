import type { JSX } from 'solid-js';

/** Small stroke icons, sized by the caller; they inherit the surrounding text color. */

function Icon(props: { class?: string; children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class ?? 'h-3.5 w-3.5'}
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export function CubeIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </Icon>
  );
}

export function ChevronIcon(props: { open?: boolean; class?: string }) {
  return (
    <Icon class={`${props.class ?? 'h-3.5 w-3.5'} transition-transform ${props.open ? 'rotate-90' : ''}`}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function PlusIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function TrashIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  );
}

export function UploadIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </Icon>
  );
}

export function DownloadIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </Icon>
  );
}

export function AlertIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function CopyIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

export function CheckIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function FolderIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </Icon>
  );
}

export function FileIcon(props: { class?: string }) {
  return (
    <Icon class={props.class}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </Icon>
  );
}
