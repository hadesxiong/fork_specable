import type { Extension } from '@codemirror/state'
import { showMinimap } from '@replit/codemirror-minimap'

const colours = {
  background: '#09090b', // zinc-950
  overlay: 'rgba(168, 85, 247, 0.15)', // purple-500/15
}

export function createMinimapExtension(): Extension {
  return showMinimap.compute(['doc'], () => ({
    create: () => {
      const dom = document.createElement('div')
      dom.style.backgroundColor = colours.background
      return { dom }
    },
    displayText: 'blocks',
    showOverlay: 'mouse-over',
  }))
}
