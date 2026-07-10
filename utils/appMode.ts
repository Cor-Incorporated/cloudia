import { AppMode } from '../types';

/** 本番 Contact 埋め込みは intake 固定。デモのみ ?mode=ambassador */
export function resolveAppMode(search: string = typeof window !== 'undefined' ? window.location.search : ''): AppMode {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'ambassador' ? 'ambassador' : 'intake';
}
