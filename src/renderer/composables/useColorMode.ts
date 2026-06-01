import { ref, computed } from 'vue'

export type ColorMode = 'cn' | 'west'

// 模块级单例状态
const colorMode = ref<ColorMode>('west')

let initialized = false

async function initColorMode() {
  if (initialized) return
  try {
    const settings = await window.electronAPI.getSettings() as { key: string; value: string }[]
    const found = settings.find(s => s.key === 'color_mode')
    if (found && (found.value === 'cn' || found.value === 'west')) {
      colorMode.value = found.value as ColorMode
    }
  } catch { /* 忽略 */ }
  applyToDOM(colorMode.value)
  initialized = true
}

function applyToDOM(mode: ColorMode) {
  document.documentElement.dataset.colorMode = mode
}

export function useColorMode() {
  // 首次使用时初始化
  if (!initialized) initColorMode()

  const profitClass = computed(() => 'text-profit')
  const lossClass = computed(() => 'text-loss')

  async function setColorMode(mode: ColorMode) {
    colorMode.value = mode
    applyToDOM(mode)
    try {
      await window.electronAPI.updateSetting('color_mode', mode)
    } catch { /* 忽略 */ }
  }

  /** 根据值的正负返回对应的 CSS 类名 */
  function valueClass(isPositive: boolean): string {
    return isPositive ? 'text-profit' : 'text-loss'
  }

  /** 根据 Decimal 的正负返回对应的 CSS 类名 */
  function amountClass(isNegative: boolean): string {
    return isNegative ? 'text-loss' : 'text-profit'
  }

  return {
    colorMode,
    setColorMode,
    profitClass,
    lossClass,
    valueClass,
    amountClass,
  }
}
