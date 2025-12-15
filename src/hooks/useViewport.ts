import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

interface ViewportState {
  isMobile: boolean;
  width: number;
  height: number;
}

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>(() => ({
    isMobile: typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const handleResize = () => {
      setState({
        isMobile: window.innerWidth < MOBILE_BREAKPOINT,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
