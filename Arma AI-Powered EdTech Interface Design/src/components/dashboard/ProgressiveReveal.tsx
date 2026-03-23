import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ProgressiveRevealProps {
  children: React.ReactNode;
  sectionId: string;
  delay?: number;
  staggerDelay?: number;
}

/**
 * Wrapper component for progressive reveal effect
 * Shows content with smooth fade-in animation after specified delay
 */
export const ProgressiveReveal: React.FC<ProgressiveRevealProps> = ({
  children,
  sectionId,
  delay = 0,
  staggerDelay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay + staggerDelay);

    return () => clearTimeout(timer);
  }, [delay, staggerDelay]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ProgressiveRevealGroupProps {
  sections: Array<{
    id: string;
    content: React.ReactNode;
    delay?: number;
  }>;
  baseDelay?: number;
  staggerDelay?: number;
}

/**
 * Group component for revealing multiple sections in sequence
 * Automatically staggers the reveal of each section
 */
export const ProgressiveRevealGroup: React.FC<ProgressiveRevealGroupProps> = ({
  sections,
  baseDelay = 800,
  staggerDelay = 600,
}) => {
  return (
    <>
      {sections.map((section, index) => (
        <ProgressiveReveal
          key={section.id}
          sectionId={section.id}
          delay={section.delay || baseDelay}
          staggerDelay={index * staggerDelay}
        >
          {section.content}
        </ProgressiveReveal>
      ))}
    </>
  );
};

/**
 * Hook for managing reveal state of multiple sections
 */
export function useRevealSections(sectionIds: string[], baseDelay?: number) {
  const [revealedSections, setRevealedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset when sections change
    setRevealedSections({});

    const delay = baseDelay || 800;
    const timers = sectionIds.map((sectionId, index) => {
      return setTimeout(() => {
        setRevealedSections((prev) => ({
          ...prev,
          [sectionId]: true,
        }));
      }, delay + index * 600);
    });

    return () => timers.forEach(clearTimeout);
  }, [sectionIds, baseDelay]);

  return revealedSections;
}
