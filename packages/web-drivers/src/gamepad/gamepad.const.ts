// Black masks for virtual keys
export const ONES =
  0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn;

// D pad
export const V_KEY_UP = 0xffn;
export const V_KEY_RIGHT = 0xffn << 8n;
export const V_KEY_DOWN = 0xffn << 16n;

export const V_KEY_LEFT = 0xffn << 24n;

// Face buttons
export const V_KEY_NORTH = 0xffn << 32n;
export const V_KEY_EAST = 0xffn << 40n;
export const V_KEY_SOUTH = 0xffn << 48n;
export const V_KEY_WEST = 0xffn << 56n;

// Analog
export const V_KEY_LSR = 0xffn << 64n;
export const V_KEY_RSR = 0xffn << 72n;
export const V_KEY_LSA = 0xffn << 80n;
export const V_KEY_RSA = 0xffn << 88n;
export const V_KEY_LSB = 0xffn << 96n;
export const V_KEY_RSB = 0xffn << 104n;

// Shoulder & Trigger
export const V_KEY_LB = 0xffn << 112n;
export const V_KEY_RB = 0xffn << 120n;
export const V_KEY_LT = 0xffn << 128n;
export const V_KEY_RT = 0xffn << 136n;

// Menu
export const V_KEY_START = 0xffn << 144n;
export const V_KEY_SELECT = 0xffn << 152n;
export const V_KEY_HOME = 0xffn << 160n;

// Mouse Pad
export const V_KEY_MOUSE_X = 0xffn << 168n;
export const V_KEY_MOUSE_Y = 0xffn << 176n;
