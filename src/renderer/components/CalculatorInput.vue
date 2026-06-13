<template>
  <n-popover
    trigger="manual"
    placement="bottom"
    :show="showPopover"
    :style="{ padding: 0 }"
    :to="false"
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
      <!-- 可编辑的表达式输入框 -->
      <div class="calc-display">
        <input
          ref="calcInputRef"
          class="calc-expr-input"
          v-model="expr"
          @keydown="onCalcKeydown"
          placeholder="0"
          autocomplete="off"
        />
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
import { ref, computed, nextTick, watch } from 'vue'
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
const calcInputRef = ref<HTMLInputElement | null>(null)
const loadedFromValue = ref(false)

// 监听外部 value 变化：当弹窗打开期间外部值变了，同步到表达式
watch(() => props.value, (newVal) => {
  if (showPopover.value && !loadedFromValue.value && newVal !== null) {
    expr.value = String(newVal)
    loadedFromValue.value = true
  }
})

// 实时预览计算结果
const previewResult = computed(() => {
  if (!expr.value) return null
  try {
    const val = evaluate(expr.value)
    if (val === null || !isFinite(val)) return null
    if (val === 0 && expr.value !== '0' && !expr.value.startsWith('0')) return null
    if (/[+\-*/%]$/.test(expr.value)) {
      return formatNum(val)
    }
    return formatNum(val)
  } catch {
    return null
  }
})

function evaluate(expression: string): number | null {
  if (!expression) return null
  try {
    let clean = expression.replace(/[+\-*/%]+$/, '')
    if (!clean) return null
    clean = clean.replace(/(\d+\.?\d*)%/g, '($1/100)')
    const parser = new Parser()
    const result = parser.evaluate(clean)
    return typeof result === 'number' ? result : null
  } catch {
    return null
  }
}

function formatNum(n: number): string {
  if (!isFinite(n)) return 'Error'
  if (Number.isInteger(n)) return n.toString()
  return parseFloat(n.toFixed(8)).toString()
}

function onInputUpdate(val: number | null) {
  emit('update:value', val)
}

function onFocus() {
  if (!showPopover.value) {
    openCalculator()
  }
}

function openCalculator() {
  showPopover.value = true
  // 每次打开时用主输入框的当前值初始化表达式，方便用户直接修改
  // null 时留空（placeholder 显示 0 引导输入）
  if (props.value !== null && props.value !== undefined) {
    expr.value = String(props.value)
    loadedFromValue.value = true
  } else {
    expr.value = ''
    loadedFromValue.value = false
  }
  // 等 popover 内容渲染完成后自动聚焦
  nextTick(() => {
    requestAnimationFrame(() => {
      calcInputRef.value?.focus()
    })
  })
}

function onPopoverUpdate(show: boolean) {
  if (!show) {
    // 点击外部关闭时，自动计算并提交表达式
    commitExpression()
  }
}

function commitExpression() {
  if (expr.value) {
    const result = evaluate(expr.value)
    if (result !== null && isFinite(result)) {
      emit('update:value', Math.round(result * 100) / 100)
    }
  }
  closeCalculator()
}

// ---- 表达式输入框事件 ----
function onCalcKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    calculate()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeCalculator()
  }
}

// ---- 按钮操作 ----
function inputNum(n: string) {
  if (justCalculated.value) {
    expr.value = n
    justCalculated.value = false
  } else {
    expr.value += n
  }
  focusCalcInput()
}

function inputDot() {
  if (justCalculated.value) {
    expr.value = '0.'
    justCalculated.value = false
    focusCalcInput()
    return
  }
  const parts = expr.value.split(/[+\-*/%]/)
  const lastNum = parts[parts.length - 1]
  if (!lastNum.includes('.')) {
    expr.value += lastNum === '' ? '0.' : '.'
  }
  focusCalcInput()
}

function inputOp(op: string) {
  justCalculated.value = false
  const internalOp = op === '×' ? '*' : op === '÷' ? '/' : op
  if (/[+\-*/%]$/.test(expr.value)) {
    expr.value = expr.value.slice(0, -1) + internalOp
  } else if (expr.value) {
    expr.value += internalOp
  }
  focusCalcInput()
}

function clear() {
  expr.value = ''
  justCalculated.value = false
  focusCalcInput()
}

function backspace() {
  if (justCalculated.value) {
    clear()
    return
  }
  expr.value = expr.value.slice(0, -1)
  focusCalcInput()
}

function calculate() {
  if (!expr.value) return
  const result = evaluate(expr.value)
  if (result !== null && isFinite(result)) {
    const rounded = Math.round(result * 100) / 100
    emit('update:value', rounded)
    closeCalculator()
  }
}

function closeCalculator() {
  showPopover.value = false
  expr.value = ''
  justCalculated.value = false
  loadedFromValue.value = false
}

function focusCalcInput() {
  nextTick(() => {
    calcInputRef.value?.focus()
  })
}
</script>

<style scoped>
.calc-panel {
  width: 280px;
  padding: 12px;
  background: var(--bg-card, #fff);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.calc-display {
  margin-bottom: 10px;
  padding: 10px 14px;
  background: var(--border-subtle, rgba(0,0,0,0.04));
  border-radius: 10px;
  border: 1px solid var(--border-card, transparent);
  transition: border-color 0.2s;
}
.calc-display:focus-within {
  border-color: rgba(96, 165, 250, 0.4);
}

.calc-expr-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary, #1F2937);
  font-variant-numeric: tabular-nums;
  font-family: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: right;
  caret-color: #60A5FA;
  padding: 0;
  line-height: 1.4;
}
.calc-expr-input::placeholder {
  color: var(--text-muted, #9CA3AF);
  font-weight: 400;
}

.calc-result {
  font-size: 14px;
  color: var(--text-muted, #9CA3AF);
  text-align: right;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  min-height: 18px;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.calc-btn {
  height: 44px;
  border: none;
  border-radius: 10px;
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  background: var(--bg-card, #f8f9fa);
  color: var(--text-primary, #1F2937);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
}

.calc-btn:hover {
  background: rgba(96, 165, 250, 0.12);
}

.calc-btn:active {
  transform: scale(0.94);
  background: rgba(96, 165, 250, 0.22);
}

.calc-btn--fn {
  background: rgba(96, 165, 250, 0.08);
  color: #60A5FA;
  font-weight: 600;
  font-size: 14px;
}

.calc-btn--fn:hover {
  background: rgba(96, 165, 250, 0.18);
}

.calc-btn--op {
  background: rgba(96, 165, 250, 0.1);
  color: #60A5FA;
  font-weight: 600;
  font-size: 19px;
}

.calc-btn--op:hover {
  background: rgba(96, 165, 250, 0.22);
}

.calc-btn--eq {
  background: linear-gradient(135deg, #60A5FA, #3B82F6);
  color: #fff;
  font-weight: 700;
  font-size: 20px;
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
  background: rgba(255,255,255,0.1);
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
