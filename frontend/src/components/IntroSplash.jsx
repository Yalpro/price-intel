import React, { useState, useEffect, useRef } from 'react';
import { AnapriceLogo } from './AnapriceLogo';

/**
 * Anaprice Approved Intro Splash Experience
 * Plays on every full browser page load/refresh (~4s playback with instant tap-to-skip)
 */
export const IntroSplash = ({ onComplete }) => {
  const [fading, setFading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  const handleFinish = () => {
    setFading(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 400);
  };

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery && mediaQuery.matches) {
      handleFinish();
      return;
    }

    // Maximum 4.5s timeout safety fallback so video plays naturally (~4 seconds total)
    const maxTimer = setTimeout(() => {
      handleFinish();
    }, 4500);

    return () => clearTimeout(maxTimer);
  }, [onComplete]);

  return (
    <div 
      onClick={handleFinish}
      className={`fixed inset-0 z-50 bg-[#0A0E0C] flex flex-col items-center justify-center cursor-pointer transition-opacity duration-400 select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {!videoError ? (
        <div className="relative max-w-md w-full aspect-video flex items-center justify-center overflow-hidden rounded-2xl bg-[#0A0E0C]">
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
        <div className="flex flex-col items-center space-y-4 animate-fade-in-up">
          <AnapriceLogo size={72} showText={false} />
          <h1 className="text-3xl font-sora font-bold text-textPrimary tracking-tight">Anaprice</h1>
          <p className="text-xs font-mono uppercase text-accentMint tracking-widest">Wholesale Price Intelligence</p>
        </div>
      )}

      <div className="absolute bottom-8 text-xs text-textSecondary opacity-60 font-mono">
        Tap anywhere to skip
      </div>
    </div>
  );
};

export default IntroSplash;
