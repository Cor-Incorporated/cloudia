import React, { useEffect, useState, memo } from 'react';
import { Emotion } from '../types';
import { getAvatarAsset } from '../constants/avatarAssets';
import { useLanguage } from '../contexts/LanguageContext';

interface ExpressionAvatarProps {
  emotion: Emotion;
  size?: number;
  className?: string;
  /** 吹き出し横などラベル不要時 */
  compact?: boolean;
}

/**
 * 表情アイコンアバター（3D/VRM 非依存）。
 * 正式画像: public/assets/avatar/cloudia-{emotion}.png
 * 未配置・ロード失敗時は色付きプレースホルダを表示し、チャットは止めない。
 */
const ExpressionAvatar: React.FC<ExpressionAvatarProps> = ({
  emotion,
  size = 144,
  className = '',
  compact = false,
}) => {
  const { locale } = useLanguage();
  const asset = getAvatarAsset(emotion);
  const [imageFailed, setImageFailed] = useState(false);
  const [displayedEmotion, setDisplayedEmotion] = useState(emotion);

  useEffect(() => {
    setImageFailed(false);
    setDisplayedEmotion(emotion);
  }, [emotion]);

  const label = locale === 'ja' ? asset.labelJa : asset.labelEn;
  const showPlaceholder = imageFailed;
  const symbolClass = size <= 48 ? 'text-base' : 'text-4xl';

  return (
    <div
      className={`flex flex-col items-center ${compact ? 'gap-0' : 'gap-2'} ${className}`}
      role="img"
      aria-label={`Cloudia: ${label}`}
    >
      <div
        className="relative overflow-hidden rounded-full shadow-md ring-2 ring-white/15 transition-opacity duration-300"
        style={{ width: size, height: size }}
      >
        {showPlaceholder ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center text-white select-none"
            style={{ backgroundColor: asset.placeholderColor }}
            aria-hidden="true"
          >
            <span className={`${symbolClass} font-light leading-none opacity-90`}>{asset.symbol}</span>
            {!compact && size > 64 && (
              <span className="mt-1 text-xs font-medium tracking-wide opacity-90">{label}</span>
            )}
          </div>
        ) : (
          <img
            key={displayedEmotion}
            src={asset.src}
            alt=""
            width={size}
            height={size}
            className="h-full w-full object-cover transition-opacity duration-300"
            onError={() => setImageFailed(true)}
            draggable={false}
          />
        )}
      </div>
      {!compact && (
        <p className="text-xs text-gray-400 sr-only sm:not-sr-only sm:text-center">{label}</p>
      )}
    </div>
  );
};

export default memo(ExpressionAvatar);
