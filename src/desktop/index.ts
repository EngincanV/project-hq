// Desktop-only pieces (Electron). Everything here renders nothing in a browser.
export { getDesktop, isDesktop, type DesktopApi, type DesktopUpdateState } from './bridge';
export { DesktopUpdateBanner } from './DesktopUpdateBanner';
