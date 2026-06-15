import { motion } from 'framer-motion';

const PAD = 8;
const RADIUS = 12;

export default function TutorialOverlay({ targetRect, step }) {
  const blockClicks = !step?.prefill && !step?.allowInteraction;

  return (
    <>
      {/* Dark backdrop — blocks clicks on everything behind (pointer-events-none when prefill/allowInteraction) */}
      <motion.div
        className={`fixed inset-0 bg-black/55${blockClicks ? '' : ' pointer-events-none'}`}
        style={{ zIndex: 9998 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Spotlight ring — visual highlight around target */}
      {targetRect && (
        <motion.div
          className="fixed pointer-events-none"
          style={{
            zIndex: 9999,
            borderRadius: RADIUS,
            boxShadow: '0 0 0 3px rgba(34,197,94,0.35), 0 0 20px rgba(34,197,94,0.12)',
            background: 'rgba(255,255,255,0.04)',
          }}
          initial={false}
          animate={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </>
  );
}
