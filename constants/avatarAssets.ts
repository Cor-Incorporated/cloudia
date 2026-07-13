import { Emotion } from '../types';

export interface AvatarAsset {
  /** public 配下の PNG パス */
  src: string;
  labelJa: string;
  labelEn: string;
  /** 画像欠落時の CSS プレースホルダ色 */
  placeholderColor: string;
  symbol: string;
}

const assetPath = (filename: string): string => {
  const base = import.meta.env?.BASE_URL || '/';
  return `${base.replace(/\/?$/, '/')}assets/avatar/${filename}`;
};

/**
 * 提供アセット（表情差分 8 枚）との対応:
 * 01 喜び / 02 怒り / 03 悲しみ / 04 楽しみ /
 * 05 驚き / 06 照れ / 07 考え中 / 08 ドヤ顔
 */
export const AVATAR_ASSETS: Record<Emotion, AvatarAsset> = {
  [Emotion.HAPPY]: {
    src: assetPath('cloudia-happy.png'),
    labelJa: '喜び',
    labelEn: 'Happy',
    placeholderColor: '#f59e0b',
    symbol: '＾',
  },
  [Emotion.ANGRY]: {
    src: assetPath('cloudia-angry.png'),
    labelJa: '怒り',
    labelEn: 'Angry',
    placeholderColor: '#ef4444',
    symbol: '×',
  },
  [Emotion.SAD]: {
    src: assetPath('cloudia-sad.png'),
    labelJa: '悲しみ',
    labelEn: 'Sad',
    placeholderColor: '#60a5fa',
    symbol: '＿',
  },
  [Emotion.ENJOYING]: {
    src: assetPath('cloudia-enjoying.png'),
    labelJa: '楽しみ',
    labelEn: 'Enjoying',
    placeholderColor: '#34d399',
    symbol: '〜',
  },
  [Emotion.SURPRISED]: {
    src: assetPath('cloudia-surprised.png'),
    labelJa: '驚き',
    labelEn: 'Surprised',
    placeholderColor: '#a78bfa',
    symbol: '！',
  },
  [Emotion.SHY]: {
    src: assetPath('cloudia-shy.png'),
    labelJa: '照れ',
    labelEn: 'Shy',
    placeholderColor: '#f472b6',
    symbol: '///',
  },
  [Emotion.THINKING]: {
    src: assetPath('cloudia-thinking.png'),
    labelJa: '考え中',
    labelEn: 'Thinking',
    placeholderColor: '#94a3b8',
    symbol: '…',
  },
  [Emotion.PROUD]: {
    src: assetPath('cloudia-proud.png'),
    labelJa: 'ドヤ顔',
    labelEn: 'Proud',
    placeholderColor: '#fbbf24',
    symbol: '★',
  },
};

export const getAvatarAsset = (emotion: Emotion): AvatarAsset =>
  AVATAR_ASSETS[emotion] ?? AVATAR_ASSETS[Emotion.ENJOYING];
