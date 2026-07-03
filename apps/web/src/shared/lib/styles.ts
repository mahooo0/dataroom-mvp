/**
 * Shared style tokens & class-name helpers.
 *
 * `GRADIENT_BTN` — signature blue gradient CTA. Locked to the light
 * treatment even in dark mode (project convention). Slap on any button
 * that should feel like the primary action.
 *
 *   linear-gradient(to bottom right,
 *     rgba(137, 190, 255, 0.10),
 *     rgba(137, 190, 255, 0.70))
 *
 * Hover ramps opacity 18% → 85%.
 */
export const GRADIENT_BTN = [
  'relative overflow-hidden',
  'bg-white text-neutral-900 border border-[#EAEAEA] shadow-sm',
  'dark:bg-white dark:text-neutral-900 dark:border-[#EAEAEA]',
  'transition-[filter,box-shadow] duration-200',
  'before:absolute before:inset-0 before:z-0 before:content-[""]',
  'before:bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.10),rgba(137,190,255,0.70))]',
  'before:opacity-100 before:transition-opacity before:duration-200',
  'hover:before:bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.18),rgba(137,190,255,0.85))]',
  'focus-visible:ring-2 focus-visible:ring-[#89BEFF]/60',
].join(' ')

/**
 * Same palette but pumped for the "active" affordance in a sidebar.
 * Uses !important background because sidebar rows often carry hover
 * classes that would otherwise win.
 */
export const GRADIENT_SIDEBAR_ACTIVE = [
  'relative overflow-hidden',
  '!bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.18),rgba(137,190,255,0.55))]',
  'text-neutral-900 dark:text-neutral-900',
].join(' ')

/**
 * Subtle blue tint useful for framing surfaces (auth cards, hero
 * outlines). Doesn't dominate — just a whisper of the brand blue.
 */
export const FRAME_BLUE_TINT = [
  'ring-1 ring-[#89BEFF]/25',
  'shadow-[0_1px_0_rgba(137,190,255,0.15),0_20px_60px_-30px_rgba(137,190,255,0.35)]',
].join(' ')
