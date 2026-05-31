<template>
  <n-popover
    trigger="focus"
    placement="bottom"
    :show="showPopover"
    :style="{ padding: 0 }"
    raw
    @update:show="onPopoverUpdate"
  >
    <template #trigger>
      <n-input-number
        :value="value"
        :min="min"
        :max="max"
        :step="step"
        :placeholder="placeholder"
        :style="{ width: '100%' }"
        :show-button="showButton"
        @update:value="onInputUpdate"
        @focus="onFocus"
      >
        <template #prefix v-if="$slots.prefix">
          <slot name="prefix" />
        </template>
      </n-input-number>
    </template>

    <div class="calc-panel" @mousedown.prevent>
      <!-- 表达式显示 -->
      <div class="calc-display">
        <div class="calc-expr">{{ displayExpr || '0' }}</div>
        <div class="calc-result" v-if="previewResult !== null">
          = {{ previewResult }}
        </div>
      </div>

      <!-- 按钮网格 -->
      <div class="calc-grid">
        <button class="calc-btn calc-btn--fn" @click="clear">AC</button>
        <button class="calc-btn calc-btn--fn" @click="backspace">⌫</button>
        <button class="calc-btn calc-btn--fn" @click="inputOp('%')">%</button>
        <button class="calc-btn calc-btn--op" @click="inputOp('÷')">÷</button>

        <button class="calc-btn" @click="inputNum('7')">7</button>
        <button class="calc-btn" @click="inputNum('8')">8</button>
        <button class="calc-btn" @click="inputNum('9')">9</button>
        <button class="calc-btn calc-btn--op" @click="inputOp('×')">×</button>

        <button class="calc-btn" @click="inputNum('4')">4</button>
        <button class="calc-btn" @click="inputNum('5')">5</button>
        <button class="calc-btn" @click="inputNum('6')">6</button>
        <button class="calc-btn calc-btn--op" @click="inputOp('-')">−</button>

        <button class="calc-btn" @click="inputNum('1')">1</button>
        <button class="calc-btn" @click="inputNum('2')">2</button>
        <button class="calc-btn" @click="inputNum('3')">3</button>
        <button class="calc-btn calc-btn--op" @click="inputOp('+')">+</button>

        <button class="calc-btn calc-btn--zero" @click="inputNum('0')">0</button>
        <button class="calc-btn" @click="inputDot">.</button>
        <button class="calc-btn calc-btn--eq" @click="calculate">=</button>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NPopover, NInputNumber } from 'naive-ui'
import { Parser } from 'expr-eval'

const props = withDefaults(defineProps<{
  value: number | null
  min?: number
  max?: number
  step?: number
  placeholder?: string
  showButton?: boolean
}>(), {
  min: undefined,
  max: undefined,
  step: 1,
  placeholder: '0.00',
  showButton: false,
})

const emit = defineEmits<{
  (e: 'update:value', val: number | null): void
}>()

const showPopover = ref(false)
const expr = ref('')
const justCalculated = ref(false)

// 表达式展示（将符号转为显示用）
const displayExpr = computed(() => {
  return expr.value
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
})

// 实时预览计算结果
const previewResult = computed(() => {
  if (!expr.value) return null
  try {
    const val = evaluate(expr.value)
    if (val === null || !isFinite(val)) return null
    // 如果表达式末尾是运算符，显示预览
    if (/[+\-*/%]$/.test(expr.value)) {
      return formatNum(val)
    }
    return null
  } catch {
    return null
  }
})

function evaluate(expression: string): number | null {
  if (!expression) return null
  try {
    // 移除末尾的运算符
    let clean = expression.replace(/[+\-*/%]+$/, '')
    if (!clean) return null
    // 处理百分号
    clean = clean.replace(/(\d+\.?\d*)%/g, '($1/100)')
    const parser = new Parser()
    const result = parser.evaluate(clean)
    return typeof result === 'number' ? result : null
  } catch {
    return null
  }
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  // 最多保留8位小数，去除尾部零
  return parseFloat(n.toFixed(8)).toString()
}

function onInputUpdate(val: number | null) {
  emit('update:value', val)
}

function onFocus() {
  showPopover.value = true
  // 如果有当前值，加载到表达式中
  if (props.value !== null && !expr.value) {
    expr.value = String(props.value)
  }
}

function onPopoverUpdate(show: boolean) {
  showPopover.value = show
  if (!show) {
    // 关闭时，如果有未确认的表达式，自动计算
    if (expr.value) {
      const result = evaluate(expr.value)
      if (result !== null && isFinite(result)) {
        emit('update:value', Math.round(result * 100) / 100)
      }
    }
    expr.value = ''
    justCalculated.value = false
  }
}

function inputNum(n: string) {
  if (justCalculated.value) {
    // 刚按了等号，输入新数字时清空表达式
    expr.value = n
    justCalculated.value = false
  } else {
    expr.value += n
  }
}

function inputDot() {
  if (justCalculated.value) {
    expr.value = '0.'
    justCalculated.value = false
    return
  }
  // 检查当前数字是否已有小数点
  const parts = expr.value.split(/[+\-*/%]/)
  const lastNum = parts[parts.length - 1]
  if (!lastNum.includes('.')) {
    expr.value += lastNum === '' ? '0.' : '.'
  }
}

function inputOp(op: string) {
  justCalculated.value = false
  const internalOp = op === '×' ? '*' : op === '÷' ? '/' : op
  // 替换末尾的运算符
  if (/[+\-*/%]$/.test(expr.value)) {
    expr.value = expr.value.slice(0, -1) + internalOp
  } else if (expr.value) {
    expr.value += internalOp
  }
}

function clear() {
  expr.value = ''
  justCalculated.value = false
}

function backspace() {
  if (justCalculated.value) {
    clear()
    return
  }
  expr.value = expr.value.slice(0, -1)
}

function calculate() {
  if (!expr.value) return
  const result = evaluate(expr.value)
  if (result !== null && isFinite(result)) {
    const rounded = Math.round(result * 100) / 100
    emit('update:value', rounded)
    expr.value = String(rounded)
    justCalculated.value = true
  }
}
</script>

<style scoped>
.calc-panel {
  width: 260px;
  padding: 10px;
  background: var(--bg-card, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.calc-display {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--border-subtle, rgba(0,0,0,0.04));
  border-radius: 8px;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
}

.calc-expr {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1F2937);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
  line-height: 1.3;
}

.calc-result {
  font-size: 13px;
  color: var(--text-muted, #9CA3AF);
  margin-top: 2px;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.calc-btn {
  height: 40px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--bg-card, #f8f9fa);
  color: var(--text-primary, #1F2937);
  display: flex;
  align-items: center;
  justify-content: center;
}

.calc-btn:hover {
  background: rgba(96, 165, 250, 0.12);
}

.calc-btn:active {
  transform: scale(0.95);
  background: rgba(96, 165, 250, 0.2);
}

.calc-btn--fn {
  background: rgba(96, 165, 250, 0.08);
  color: #60A5FA;
  font-weight: 600;
}

.calc-btn--fn:hover {
  background: rgba(96, 165, 250, 0.18);
}

.calc-btn--op {
  background: rgba(96, 165, 250, 0.12);
  color: #60A5FA;
  font-weight: 600;
  font-size: 18px;
}

.calc-btn--op:hover {
  background: rgba(96, 165, 250, 0.22);
}

.calc-btn--eq {
  background: linear-gradient(135deg, #60A5FA, #3B82F6);
  color: #fff;
  font-weight: 700;
  font-size: 18px;
}

.calc-btn--eq:hover {
  background: linear-gradient(135deg, #3B82F6, #2563EB);
}

.calc-btn--zero {
  grid-column: span 2;
}

/* 暗色主题适配 */
:root.theme-dark .calc-panel {
  background: #161B22;
}

:root.theme-dark .calc-btn {
  background: rgba(255,255,255,0.06);
  color: #E6EDF3;
}

:root.theme-dark .calc-btn:hover {
  background: rgba(96, 165, 250, 0.15);
}

:root.theme-dark .calc-btn--fn,
:root.theme-dark .calc-btn--op {
  background: rgba(96, 165, 250, 0.12);
  color: #60A5FA;
}

:root.theme-dark .calc-display {
  background: rgba(255,255,255,0.04);
}
</style>
