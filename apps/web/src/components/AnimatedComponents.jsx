import React from 'react';
import { motion } from 'framer-motion';

// Animation variants
export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6 }
  }
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    }
  }
};

export const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
};

export const slideInLeftVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

export const slideInRightVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

// Reusable animated components
export const AnimatedContainer = ({ children, delay = 0, ...props }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-100px' }}
    variants={{
      hidden: { opacity: 0, y: 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay, ease: 'easeOut' }
      }
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const AnimatedCard = ({ children, className = '', hoverScale = 1.02, ...props }) => (
  <motion.div
    className={className}
    whileHover={{ scale: hoverScale }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    {...props}
  >
    {children}
  </motion.div>
);

export const AnimatedButton = ({ children, className = '', onClick, ...props }) => (
  <motion.button
    className={className}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    onClick={onClick}
    {...props}
  >
    {children}
  </motion.button>
);

export const AnimatedText = ({ children, delay = 0, className = '', ...props }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    {...props}
  >
    {children}
  </motion.div>
);

export const AnimatedGradient = ({ children, className = '', ...props }) => (
  <motion.div
    className={`${className} animate-gradient-shift`}
    style={{
      backgroundSize: '200% 200%',
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const StaggeredList = ({ children, className = '', ...props }) => (
  <motion.div
    className={className}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true }}
    variants={staggerContainerVariants}
    {...props}
  >
    {React.Children.map(children, (child) =>
      React.cloneElement(child, {
        variants: fadeUpVariants,
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true }
      })
    )}
  </motion.div>
);

export const FloatingElement = ({ children, delay = 0, className = '', ...props }) => (
  <motion.div
    className={className}
    animate={{ y: [0, -20, 0] }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const PulseRing = ({ className = '', ...props }) => (
  <motion.div
    className={className}
    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
    {...props}
  />
);

export const GlowEffect = ({ children, className = '', color = 'blue', ...props }) => (
  <motion.div
    className={className}
    animate={{
      boxShadow: [
        `0 0 20px rgba(59, 130, 246, 0.3)`,
        `0 0 40px rgba(59, 130, 246, 0.6)`,
        `0 0 20px rgba(59, 130, 246, 0.3)`
      ]
    }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const CountUp = ({ end = 100, duration = 2, className = '', ...props }) => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      setCount(prev => {
        const next = prev + increment;
        return next >= end ? end : next;
      });
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [end, duration]);

  return (
    <motion.span className={className} {...props}>
      {Math.floor(count)}
    </motion.span>
  );
};
