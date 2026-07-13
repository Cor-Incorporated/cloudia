import { AppMode } from '../types';

/** 本番 Contact 埋め込みは intake 固定。デモのみ ?mode=ambassador */
export function resolveAppMode(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '',
): AppMode {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath.endsWith('/contact/chat/ambassador')) return 'ambassador';
  const params = new URLSearchParams(search);
  return params.get('mode') === 'ambassador' ? 'ambassador' : 'intake';
}
