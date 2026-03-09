/**
 * themes.js — ArcheAudio bundled themes
 *
 * Each theme is a flat object mapping CSS variable names (without
 * the leading --) to values.  The apply function writes them onto
 * :root so every component picks them up instantly with no reload.
 *
 * To add your own theme: copy any entry below, give it a unique id,
 * fill in the values, and add a swatch color for the picker grid.
 */

const THEMES = {

  /* ── Default ─────────────────────────────────────────────── */
  archeaudio: {
    label:  'ArcheAudio',
    swatch: '#00c8ff',
    dark:   true,
    vars: {
      'bg':        '#060a12',
      'surface':   '#0a1020',
      'surface2':  '#0e1628',
      'surface3':  '#121d32',

      'border':      '#1a2a45',
      'border-hi':   '#274060',
      'border-glow': 'rgba(0, 200, 255, 0.25)',

      'text':        '#8bbcd8',
      'text-dim':    '#5880A6',
      'text-mid':    '#6a96b8',
      'text-bright': '#c8e4f8',
      'text-white':  '#e8f4ff',

      'accent':      '#00c8ff',
      'accent-dim':  'rgba(0, 200, 255, 0.08)',
      'accent-lo':   'rgba(0, 200, 255, 0.15)',
      'accent-glow': '0 0 12px rgba(0, 200, 255, 0.4), 0 0 24px rgba(0, 200, 255, 0.15)',

      'green':     '#00ff88',
      'green-lo':  'rgba(0, 255, 136, 0.12)',
      'yellow':    '#ffcc00',
      'yellow-lo': 'rgba(255, 204, 0, 0.12)',
      'red':       '#ff4466',
      'red-lo':    'rgba(255, 68, 102, 0.12)',

      'glow-status-dot': '0 0 8px #00ff88',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(0, 200, 255, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #060a12, 0 0 8px rgba(0, 200, 255, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #060a12, 0 0 12px rgba(0, 200, 255, 0.4), 0 0 24px rgba(0, 200, 255, 0.15)',
      'glow-vu-green':   '0 0 4px #00ff88',
      'glow-vu-yellow':  '0 0 4px #ffcc00',
      'glow-vu-red':     '0 0 4px #ff4466',

      'crt-opacity':  '0.06',
      'crt-line-gap': '3px',
    },
  },

  /* ── Catppuccin Mocha ────────────────────────────────────── */
  'ctp-mocha': {
    label:  'Catppuccin Mocha',
    swatch: '#cba6f7',
    dark:   true,
    vars: {
      'bg':        '#1e1e2e',
      'surface':   '#181825',
      'surface2':  '#1e1e2e',
      'surface3':  '#313244',

      'border':      '#313244',
      'border-hi':   '#45475a',
      'border-glow': 'rgba(203, 166, 247, 0.25)',

      'text':        '#cdd6f4',
      'text-dim':    '#636780',
      'text-mid':    '#a6adc8',
      'text-bright': '#cdd6f4',
      'text-white':  '#ffffff',

      'accent':      '#cba6f7',
      'accent-dim':  'rgba(203, 166, 247, 0.08)',
      'accent-lo':   'rgba(203, 166, 247, 0.15)',
      'accent-glow': '0 0 12px rgba(203, 166, 247, 0.4), 0 0 24px rgba(203, 166, 247, 0.15)',

      'green':     '#a6e3a1',
      'green-lo':  'rgba(166, 227, 161, 0.12)',
      'yellow':    '#f9e2af',
      'yellow-lo': 'rgba(249, 226, 175, 0.12)',
      'red':       '#f38ba8',
      'red-lo':    'rgba(243, 139, 168, 0.12)',

      'glow-status-dot': '0 0 8px #a6e3a1',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(203, 166, 247, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #1e1e2e, 0 0 8px rgba(203, 166, 247, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #1e1e2e, 0 0 12px rgba(203, 166, 247, 0.4), 0 0 24px rgba(203, 166, 247, 0.15)',
      'glow-vu-green':   '0 0 4px #a6e3a1',
      'glow-vu-yellow':  '0 0 4px #f9e2af',
      'glow-vu-red':     '0 0 4px #f38ba8',

      'crt-opacity': '0',
    },
  },

  /* ── Catppuccin Macchiato ────────────────────────────────── */
  'ctp-macchiato': {
    label:  'Catppuccin Macchiato',
    swatch: '#c6a0f6',
    dark:   true,
    vars: {
      'bg':        '#24273a',
      'surface':   '#1e2030',
      'surface2':  '#24273a',
      'surface3':  '#363a4f',

      'border':      '#363a4f',
      'border-hi':   '#494d64',
      'border-glow': 'rgba(198, 160, 246, 0.25)',

      'text':        '#cad3f5',
      'text-dim':    '#5b6078',
      'text-mid':    '#a5adcb',
      'text-bright': '#cad3f5',
      'text-white':  '#ffffff',

      'accent':      '#c6a0f6',
      'accent-dim':  'rgba(198, 160, 246, 0.08)',
      'accent-lo':   'rgba(198, 160, 246, 0.15)',
      'accent-glow': '0 0 12px rgba(198, 160, 246, 0.4), 0 0 24px rgba(198, 160, 246, 0.15)',

      'green':     '#a6da95',
      'green-lo':  'rgba(166, 218, 149, 0.12)',
      'yellow':    '#eed49f',
      'yellow-lo': 'rgba(238, 212, 159, 0.12)',
      'red':       '#ed8796',
      'red-lo':    'rgba(237, 135, 150, 0.12)',

      'glow-status-dot': '0 0 8px #a6da95',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(198, 160, 246, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #24273a, 0 0 8px rgba(198, 160, 246, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #24273a, 0 0 12px rgba(198, 160, 246, 0.4), 0 0 24px rgba(198, 160, 246, 0.15)',
      'glow-vu-green':   '0 0 4px #a6da95',
      'glow-vu-yellow':  '0 0 4px #eed49f',
      'glow-vu-red':     '0 0 4px #ed8796',

      'crt-opacity': '0',
    },
  },

  /* ── Catppuccin Frappé ───────────────────────────────────── */
  'ctp-frappe': {
    label:  'Catppuccin Frappé',
    swatch: '#ca9ee6',
    dark:   true,
    vars: {
      'bg':        '#303446',
      'surface':   '#292c3c',
      'surface2':  '#303446',
      'surface3':  '#414559',

      'border':      '#414559',
      'border-hi':   '#51576d',
      'border-glow': 'rgba(202, 158, 230, 0.25)',

      'text':        '#c6d0f5',
      'text-dim':    '#626880',
      'text-mid':    '#a5adce',
      'text-bright': '#c6d0f5',
      'text-white':  '#ffffff',

      'accent':      '#ca9ee6',
      'accent-dim':  'rgba(202, 158, 230, 0.08)',
      'accent-lo':   'rgba(202, 158, 230, 0.15)',
      'accent-glow': '0 0 12px rgba(202, 158, 230, 0.4), 0 0 24px rgba(202, 158, 230, 0.15)',

      'green':     '#a6d189',
      'green-lo':  'rgba(166, 209, 137, 0.12)',
      'yellow':    '#e5c890',
      'yellow-lo': 'rgba(229, 200, 144, 0.12)',
      'red':       '#e78284',
      'red-lo':    'rgba(231, 130, 132, 0.12)',

      'glow-status-dot': '0 0 8px #a6d189',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(202, 158, 230, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #303446, 0 0 8px rgba(202, 158, 230, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #303446, 0 0 12px rgba(202, 158, 230, 0.4), 0 0 24px rgba(202, 158, 230, 0.15)',
      'glow-vu-green':   '0 0 4px #a6d189',
      'glow-vu-yellow':  '0 0 4px #e5c890',
      'glow-vu-red':     '0 0 4px #e78284',

      'crt-opacity': '0',
    },
  },

  /* ── Catppuccin Latte (light) ────────────────────────────── */
  'ctp-latte': {
    label:  'Catppuccin Latte',
    swatch: '#8839ef',
    dark:   false,
    vars: {
      'bg':        '#eff1f5',
      'surface':   '#e6e9ef',
      'surface2':  '#dce0e8',
      'surface3':  '#ccd0da',

      'border':      '#ccd0da',
      'border-hi':   '#bcc0cc',
      'border-glow': 'rgba(136, 57, 239, 0.2)',

      'text':        '#4c4f69',
      'text-dim':    '#7E818C',
      'text-mid':    '#6c6f85',
      'text-bright': '#4c4f69',
      'text-white':  '#1e1e2e',

      'accent':      '#8839ef',
      'accent-dim':  'rgba(136, 57, 239, 0.08)',
      'accent-lo':   'rgba(136, 57, 239, 0.12)',
      'accent-glow': '0 0 10px rgba(136, 57, 239, 0.3), 0 0 20px rgba(136, 57, 239, 0.1)',

      'green':     '#40a02b',
      'green-lo':  'rgba(64, 160, 43, 0.1)',
      'yellow':    '#df8e1d',
      'yellow-lo': 'rgba(223, 142, 29, 0.1)',
      'red':       '#d20f39',
      'red-lo':    'rgba(210, 15, 57, 0.1)',

      'glow-status-dot': '0 0 6px #40a02b',
      'glow-logo-icon':  'drop-shadow(0 0 5px rgba(136, 57, 239, 0.5))',
      'glow-vol-thumb':  '0 0 0 2px #eff1f5, 0 0 6px rgba(136, 57, 239, 0.3)',
      'glow-vol-hover':  '0 0 0 2px #eff1f5, 0 0 10px rgba(136, 57, 239, 0.3), 0 0 20px rgba(136, 57, 239, 0.1)',
      'glow-vu-green':   '0 0 3px #40a02b',
      'glow-vu-yellow':  '0 0 3px #df8e1d',
      'glow-vu-red':     '0 0 3px #d20f39',

      'crt-opacity': '0',
    },
  },

  /* ── Nord ────────────────────────────────────────────────── */
  nord: {
    label:  'Nord',
    swatch: '#88c0d0',
    dark:   true,
    vars: {
      'bg':        '#2e3440',
      'surface':   '#3b4252',
      'surface2':  '#434c5e',
      'surface3':  '#4c566a',

      'border':      '#4c566a',
      'border-hi':   '#5e81ac',
      'border-glow': 'rgba(136, 192, 208, 0.25)',

      'text':        '#d8dee9',
      'text-dim':    '#949EB5',
      'text-mid':    '#81a1c1',
      'text-bright': '#eceff4',
      'text-white':  '#eceff4',

      'accent':      '#88c0d0',
      'accent-dim':  'rgba(136, 192, 208, 0.08)',
      'accent-lo':   'rgba(136, 192, 208, 0.15)',
      'accent-glow': '0 0 12px rgba(136, 192, 208, 0.4), 0 0 24px rgba(136, 192, 208, 0.15)',

      'green':     '#a3be8c',
      'green-lo':  'rgba(163, 190, 140, 0.12)',
      'yellow':    '#ebcb8b',
      'yellow-lo': 'rgba(235, 203, 139, 0.12)',
      'red':       '#bf616a',
      'red-lo':    'rgba(191, 97, 106, 0.12)',

      'glow-status-dot': '0 0 8px #a3be8c',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(136, 192, 208, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #2e3440, 0 0 8px rgba(136, 192, 208, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #2e3440, 0 0 12px rgba(136, 192, 208, 0.4), 0 0 24px rgba(136, 192, 208, 0.15)',
      'glow-vu-green':   '0 0 4px #a3be8c',
      'glow-vu-yellow':  '0 0 4px #ebcb8b',
      'glow-vu-red':     '0 0 4px #bf616a',

      'crt-opacity': '0',
    },
  },

  /* ── Gruvbox Dark ────────────────────────────────────────── */
  gruvbox: {
    label:  'Gruvbox',
    swatch: '#d79921',
    dark:   true,
    vars: {
      'bg':        '#1d2021',
      'surface':   '#282828',
      'surface2':  '#32302f',
      'surface3':  '#3c3836',

      'border':      '#3c3836',
      'border-hi':   '#504945',
      'border-glow': 'rgba(215, 153, 33, 0.25)',

      'text':        '#ebdbb2',
      'text-dim':    '#AB9B8E',
      'text-mid':    '#a89984',
      'text-bright': '#fbf1c7',
      'text-white':  '#fbf1c7',

      'accent':      '#d79921',
      'accent-dim':  'rgba(215, 153, 33, 0.08)',
      'accent-lo':   'rgba(215, 153, 33, 0.15)',
      'accent-glow': '0 0 12px rgba(215, 153, 33, 0.4), 0 0 24px rgba(215, 153, 33, 0.15)',

      'green':     '#98971a',
      'green-lo':  'rgba(152, 151, 26, 0.12)',
      'yellow':    '#d79921',
      'yellow-lo': 'rgba(215, 153, 33, 0.12)',
      'red':       '#cc241d',
      'red-lo':    'rgba(204, 36, 29, 0.12)',

      'glow-status-dot': '0 0 8px #98971a',
      'glow-logo-icon':  'drop-shadow(0 0 6px rgba(215, 153, 33, 0.6))',
      'glow-vol-thumb':  '0 0 0 2px #1d2021, 0 0 8px rgba(215, 153, 33, 0.4)',
      'glow-vol-hover':  '0 0 0 2px #1d2021, 0 0 12px rgba(215, 153, 33, 0.4), 0 0 24px rgba(215, 153, 33, 0.15)',
      'glow-vu-green':   '0 0 4px #98971a',
      'glow-vu-yellow':  '0 0 4px #d79921',
      'glow-vu-red':     '0 0 4px #cc241d',

      'crt-opacity': '0.04',
    },
  },
};

/**
 * applyTheme(id)
 * Writes all CSS variables for the given theme id onto :root.
 * Falls back to 'archeaudio' if the id is unknown.
 */
function applyTheme(id) {
  const theme = THEMES[id] ?? THEMES['archeaudio'];
  const root  = document.documentElement;
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(`--${key}`, val);
  }
}
