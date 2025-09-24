import { useEffect, useState, useRef } from 'react';

/**
 * Hook to detect when a camera tile is visible on screen
 * Helps optimize performance by only analyzing visible tiles
 */
export function useVisibilityOptimization(elementRef: React.RefObject<HTMLElement>) {
  const [isVisible, setIsVisible] = useState(true); // Assume visible initially
  const [isIntersecting, setIsIntersecting] = useState(true);
  const observerRef = useRef<IntersectionObserver>();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Create intersection observer to detect visibility
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting);
        
        // Consider visible if at least 25% is visible
        const isNowVisible = entry.intersectionRatio > 0.25;
        setIsVisible(isNowVisible);
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1.0], // Multiple thresholds for better detection
        rootMargin: '50px' // Start detecting slightly before element comes into view
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [elementRef]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsVisible(false);
      } else if (isIntersecting) {
        setIsVisible(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isIntersecting]);

  return {
    isVisible,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0 // Simplified for this use case
  };
}

/**
 * Hook to throttle function calls for performance
 * Useful for reducing rendering or API call frequency
 */
export function useThrottledCallback<T extends any[]>(
  callback: (...args: T) => void,
  delay: number,
  deps: React.DependencyList = []
) {
  const lastCallTime = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttledCallback = (...args: T) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime.current;

    // If enough time has passed, call immediately
    if (timeSinceLastCall >= delay) {
      lastCallTime.current = now;
      callback(...args);
    } else {
      // Otherwise, schedule for later
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallTime.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastCall);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);

  return throttledCallback;
}

/**
 * Hook to detect if the app is running in reduced motion mode
 * Helps provide accessibility-friendly animations
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}