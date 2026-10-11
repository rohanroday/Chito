// Chito "Gompa" design tokens — keep in sync with DESIGN.md §2–§4.

export const colors = {
  maroon: '#7B1E28',
  maroon700: '#5E141D',
  maroon50: '#F7E9EA',
  gold: '#FFD60A',
  goldDeep: '#C99700',
  gold50: '#FFF7D1',
  turquoise: '#0F7C80',
  turquoise50: '#E3F3F3',
  lapis: '#22408F',
  leaf: '#2E9E3E',
  leaf50: '#EAF7EC',
  vermilion: '#D63A2A',
  vermilion50: '#FCEBE9',
  saffron: '#E98A15',
  parchment: '#FBF4E6',
  card: '#FFFDF7',
  sand: '#F2E8D5',
  line: '#E8DCC4',
  wood: '#5A3A26',
  ink: '#24150F',
  muted: '#7A6A5E',
  subtle: '#A99B8E',
  white: '#FFFFFF',
} as const;

// Prayer-flag order: sky, air, fire, water, earth
export const flagColors = ['#2563C9', '#FFFFFF', '#D63A2A', '#2E9E3E', '#FFD60A'] as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const fonts = {
  display: 'YatraOne_400Regular',
  body: 'Mukta_400Regular',
  medium: 'Mukta_500Medium',
  semibold: 'Mukta_600SemiBold',
  bold: 'Mukta_700Bold',
} as const;

export const shadow = {
  shadowColor: '#5A3A26',
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;
