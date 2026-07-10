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

/**
 * 提供アセット（表情差分 8 枚）との対応:
 * 01 喜び / 02 怒り / 03 悲しみ / 04 楽しみ /
 * 05 驚き / 06 照れ / 07 考え中 / 08 ドヤ顔
 */
export const AVATAR_ASSETS: Record<Emotion, AvatarAsset> = {
  [Emotion.HAPPY]: {
    src: '/assets/avatar/cloudia-happy.png',
    labelJa: '喜び',
    labelEn: 'Happy',
    placeholderColor: '#f59e0b',
    symbol: '＾',
  },
  [Emotion.ANGRY]: {
    src: '/assets/avatar/cloudia-angry.png',
    labelJa: '怒り',
    labelEn: 'Angry',
    placeholderColor: '#ef4444',
    symbol: '×',
  },
  [Emotion.SAD]: {
    src: '/assets/avatar/cloudia-sad.png',
    labelJa: '悲しみ',
    labelEn: 'Sad',
    placeholderColor: '#60a5fa',
    symbol: '＿',
  },
  [Emotion.ENJOYING]: {
    src: '/assets/avatar/cloudia-enjoying.png',
    labelJa: '楽しみ',
    labelEn: 'Enjoying',
    placeholderColor: '#34d399',
    symbol: '〜',
  },
  [Emotion.SURPRISED]: {
    src: '/assets/avatar/cloudia-surprised.png',
    labelJa: '驚き',
    labelEn: 'Surprised',
    placeholderColor: '#a78bfa',
    symbol: '！',
  },
  [Emotion.SHY]: {
    src: '/assets/avatar/cloudia-shy.png',
    labelJa: '照れ',
    labelEn: 'Shy',
    placeholderColor: '#f472b6',
    symbol: '///',
  },
  [Emotion.THINKING]: {
    src: '/assets/avatar/cloudia-thinking.png',
    labelJa: '考え中',
    labelEn: 'Thinking',
    placeholderColor: '#94a3b8',
    symbol: '…',
  },
  [Emotion.PROUD]: {
    src: '/assets/avatar/cloudia-proud.png',
    labelJa: 'ドヤ顔',
    labelEn: 'Proud',
    placeholderColor: '#fbbf24',
    symbol: '★',
  },
};

export const getAvatarAsset = (emotion: Emotion): AvatarAsset =>
  AVATAR_ASSETS[emotion] ?? AVATAR_ASSETS[Emotion.ENJOYING];
