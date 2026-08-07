import React from 'react';

/**
 * Approved Anaprice Primary Brand Logo Component
 * Uses the official approved circular 'a' mark image (/brand/anaprice-logo.png)
 */
export const AnapriceMark = ({ size = 32, className = '' }) => (
  <img
    src="/brand/anaprice-logo.png"
    alt="Anaprice Logo Mark"
    width={size}
    height={size}
    style={{ width: `${size}px`, height: `${size}px` }}
    className={`rounded-full shrink-0 object-contain ${className}`}
  />
);

export const AnapriceLogo = ({ size = 32, showText = true, className = '', textClassName = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <AnapriceMark size={size} />
    {showText && (
      <span className={`font-sora font-bold tracking-tight text-textPrimary text-xl ${textClassName}`}>
        Anaprice
      </span>
    )}
  </div>
);

export default AnapriceLogo;
