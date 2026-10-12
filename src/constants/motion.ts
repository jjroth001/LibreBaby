import {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
} from 'react-native-reanimated';

/**
 * Shared layout animations so everything moves with the same timing. Reanimated
 * follows the system "Remove animations" setting by default, so these turn off for
 * people who've asked for reduced motion.
 */
export const Motion = {
  /** Something appearing: a card, a submenu's options. */
  enter: FadeInDown.duration(220),
  /** Something going away. */
  exit: FadeOut.duration(160),
  /** Content swapping in place (e.g. a different day's list). */
  fadeIn: FadeIn.duration(200),
  /** Siblings gliding to their new position when something above them appears or leaves. */
  layout: LinearTransition.duration(220),
  /** Snackbar rising from / sinking to the bottom edge. */
  rise: FadeInDown.duration(200),
  sink: FadeOutDown.duration(160),
};
