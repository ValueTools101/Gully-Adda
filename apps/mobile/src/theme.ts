/** Warm desi-nostalgia palette with a 90s sticker/poster feel. */
export const colors = {
  cream: '#FFF4DC',
  paper: '#FFFDF6',
  ink: '#2B1B17',
  inkSoft: '#6B5248',
  saffron: '#FF9933',
  mustard: '#F2C14E',
  maroon: '#7A1F3D',
  pink: '#E84A8A',
  teal: '#1FA2A6',
  leaf: '#3E9E4F',
  sky: '#3B7DD8',
  night: '#1E1A3A',
  nightSoft: '#2E2858',
  danger: '#D64545',
  white: '#FFFFFF',
  shadow: '#2B1B17',
};

/** Seat colours (Ludo uses the first four, other games reuse them for players). */
export const seatColors = ['#E53935', '#43A047', '#FDD835', '#1E88E5', '#8E24AA', '#FB8C00', '#00ACC1', '#6D4C41', '#D81B60', '#7CB342', '#5E35B1', '#546E7A'];

export const fonts = {
  display: 'Baloo2_800ExtraBold',
  heading: 'Baloo2_700Bold',
  body: 'Poppins_400Regular',
  bodyBold: 'Poppins_600SemiBold',
};

export const radius = { sm: 10, md: 16, lg: 24 };
export const space = (n: number) => n * 4;

/** Minimum touch target (Android guideline is 48dp). */
export const TAP = 52;

/** Hard offset "sticker" shadow used across the UI. */
export const retroShadow = { boxShadow: `3px 4px 0px ${colors.shadow}` } as const;
export const retroShadowSmall = { boxShadow: `2px 2px 0px ${colors.shadow}` } as const;
