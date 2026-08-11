import React, { useState, useEffect, useRef } from 'react';
import AnapriceLogo from './AnapriceLogo';

/**
 * Anaprice Approved Intro Splash Experience
 * Plays ONLY on the public homepage / landing page (~4s playback with instant tap-to-skip).
 * Includes subtle premium tagline fade-in below the video card.
 */
export const IntroSplash = ({ onComplete }) => {
  const [fading, setFading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const videoRef = useRef(null);

  const handleFinish = () => {
    setFading(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 400);
  };

  useEffect(() => {
    // Fade in tagline 400ms after logo animation begins
    const taglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 400);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery && mediaQuery.matches) {
      handleFinish();
      return;
    }

    // Maximum 4.5s timeout safety fallback
    const maxTimer = setTimeout(() => {
      handleFinish();
    }, 4500);

    return () => {
      clearTimeout(taglineTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  return (
    <div 
      onClick={handleFinish}
      className={`fixed inset-0 z-50 bg-[#0A0E0C] flex flex-col items-center justify-center p-4 cursor-pointer transition-opacity duration-400 select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center max-w-md w-full">
        {!videoError ? (
          <div className="relative w-full aspect-video flex items-center justify-center overflow-hidden rounded-2xl bg-[#0A0E0C]">
            <video
              ref={videoRef}
              src="/brand/anaprice-intro.mp4"
              autoPlay
              muted
              playsInline
              onEnded={handleFinish}
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <AnapriceLogo size={72} showText={false} />
            <h1 className="text-3xl font-sora font-bold text-textPrimary tracking-tight">Anaprice</h1>
          </div>
        )}

        {/* Premium Brand Tagline */}
        <p className={`mt-6 sm:mt-8 text-sm sm:text-base font-sora font-semibold text-[#A7F3D0] tracking-wide text-center transition-all duration-700 ${
          showTagline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}>
          Smarter Buying. Better Margins.
        </p>
      </div>

      <div className="absolute bottom-8 text-xs text-textSecondary opacity-60 font-mono">
        Tap anywhere to skip
      </div>
    </div>
  );
};

export default IntroSplash;
