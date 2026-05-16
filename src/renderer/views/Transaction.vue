<template>
  <div class="tx-page">
    <div class="page-header">
      <h2 class="page-title">交易记账</h2>
    </div>

    <div class="tx-layout">
      <!-- Form -->
      <div class="glass-card form-card">
        <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
          <n-form-item label="交易类型" path="type">
            <div class="type-toggle">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                class="type-btn"
                :class="{ active: form.type === opt.value }"
                @click="form.type = opt.value"
              >
                <component :is="opt.icon" :size="16" />
                {{ opt.label }}
              </button>
            </div>
          </n-form-item>

          <n-form-item label="金额" path="amount">
            <n-input-number
              v-model:value="form.amount"
              :min="0.01"
              :step="100"
              placeholder="0.00"
              :style="{ width: '100%' }"
            >
              <template #prefix>¥</template>
            </n-input-number>
          </n-form-item>

          <n-form-item label="分类" path="category_id" v-if="form.type !== 'transfer'">
            <n-select
              v-model:value="form.category_id"
              :options="categoryOptions"
              placeholder="选择分类"
            />
          </n-form-item>

          <n-form-item label="账户" path="from_account_id">
            <n-select
              v-model:value="form.from_account_id"
              :options="accountOptions"
              placeholder="选择账户"
            />
          </n-form-item>

          <n-form-item label="目标账户" path="to_account_id" v-if="form.type === 'transfer'">
            <n-select
              v-model:value="form.to_account_id"
              :options="accountOptions"
              placeholder="选择目标账户"
            />
          </n-form-item>

          <n-form-item label="日期" path="date">
            <n-date-picker v-model:formatted-value="form.date" type="date" :style="{ width: '100%' }" />
          </n-form-item>

          <n-form-item label="备注" path="description">
            <n-input v-model:value="form.description" placeholder="添加备注..." maxlength="100" show-count />
          </n-form-item>

          <div class="form-actions">
            <n-button
              type="primary"
              :loading="submitting"
              @click="handleSubmit"
              size="large"
              :style="{ width: '100%' }"
            >
              <template #icon><PlusOutlined /></template>
              记一笔
            </n-button>
          </div>
        </n-form>
      </div>

      <!-- Transaction List -->
      <div class="glass-card list-card">
        <div class="list-header">
          <span class="card-title">交易记录</span>
          <n-input v-model:value="searchQuery" placeholder="搜索..." clearable size="small" :style="{ width: '200px' }" />
        </div>
        <n-data-table
          :columns="columns"
          :data="filteredTransactions"
          :bordered="false"
          :single-line="false"
          size="small"
          virtual-scroll
          max-height="calc(100vh - 300px)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import {
  NForm, NFormItem, NInputNumber, NSelect, NDatePicker, NInput,
  NButton, NDataTable, useMessage,
} from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from '@vicons/antd'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'
import type { TransactionType } from '@shared/types'

const { sortedTransactions, expenseCategories, incomeCategories, assetAccounts, getAccountById, getCategoryById, addTransaction } = useFinance()
const { currencyPlain, shortDate } = useFormatter()
const message = useMessage()

const formRef = ref()
const submitting = ref(false)
const searchQuery = ref('')

const today = new Date().toISOString().slice(0, 10)

const form = ref({
  type: 'expense' as TransactionType,
  amount: null as number | null,
  category_id: null as number | null,
  from_account_id: null as number | null,
  to_account_id: null as number | null,
  date: today,
  description: '',
})

const rules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur', type: 'number', min: 0.01 }],
  from_account_id: [{ required: true, message: '请选择账户', trigger: 'change', type: 'number' }],
  to_account_id: [{ required: true, message: '请选择目标账户', trigger: 'change', type: 'number' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change', type: 'number' }],
}

const typeOptions = [
  { value: 'expense' as const, label: '支出', icon: ArrowDownOutlined },
  { value: 'income' as const, label: '收入', icon: ArrowUpOutlined },
  { value: 'transfer' as const, label: '转账', icon: SwapOutlined },
]

const accountOptions = computed(() =>
  assetAccounts.value.map(a => ({ label: a.name, value: a.id }))
)

const categoryOptions = computed(() => {
  const cats = form.value.type === 'income' ? incomeCategories.value : expenseCategories.value
  return cats.map(c => ({ label: c.name, value: c.id }))
})

const columns: DataTableColumn[] = [
  {
    title: '日期', key: 'date', width: 90,
    render: (row: any) => shortDate(row.date),
  },
  {
    title: '类型', key: 'type', width: 60,
    render: (row: any) => {
      const icon = row.type === 'income' ? ArrowUpOutlined : row.type === 'expense' ? ArrowDownOutlined : SwapOutlined
      const color = row.type === 'income' ? '#36B37E' : row.type === 'expense' ? '#FF5630' : '#4C9AFF'
      return h('span', { style: { color } }, h(icon, { size: 14 }))
    },
  },
  {
    title: '描述', key: 'description', ellipsis: { tooltip: true },
    render: (row: any) => row.description || getCategoryById(row.category_id)?.name || '—',
  },
  {
    title: '账户', key: 'from_account_id', width: 110, ellipsis: { tooltip: true },
    render: (row: any) => getAccountById(row.from_account_id)?.name || '—',
  },
  {
    title: '金额', key: 'amount', width: 120, align: 'right',
    render: (row: any) => {
      const prefix = row.type === 'income' ? '+' : row.type === 'expense' ? '-' : ''
      const color = row.type === 'income' ? '#36B37E' : row.type === 'expense' ? '#FF5630' : '#4C9AFF'
      return h('span', { style: { color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, prefix + currencyPlain(row.amount))
    },
  },
]

const filteredTransactions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sortedTransactions.value
  return sortedTransactions.value.filter(t => {
    const desc = (t.description || '').toLowerCase()
    const catName = (getCategoryById(t.category_id ?? 0)?.name || '').toLowerCase()
    const acctName = (getAccountById(t.from_account_id ?? 0)?.name || '').toLowerCase()
    return desc.includes(q) || catName.includes(q) || acctName.includes(q)
  })
})

async function handleSubmit() {
  formRef.value?.validate(async (errors: any) => {
    if (errors) return
    submitting.value = true
    try {
      await addTransaction({
        date: form.value.date,
        type: form.value.type,
        amount: String(form.value.amount ?? 0),
        from_account_id: form.value.from_account_id,
        to_account_id: form.value.to_account_id,
        category_id: form.value.type === 'transfer' ? null : form.value.category_id,
        description: form.value.description,
        tags: '[]',
      })
      message.success('记账成功')
      form.value.amount = null
      form.value.category_id = null
      form.value.to_account_id = null
      form.value.description = ''
    } catch {
      message.error('记账失败')
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style scoped>
.tx-page { padding: clamp(16px, 2vw, 32px); width: 100%; box-sizing: border-box; }
.page-header { margin-bottom: 24px; }
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }
.tx-layout { display: grid; grid-template-columns: clamp(320px, 22vw, 420px) 1fr; gap: clamp(16px, 1.5vw, 24px); align-items: start; }

.glass-card { padding: 20px 24px; }
.form-card { position: sticky; top: 28px; }
.list-card { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.list-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }

.type-toggle { display: flex; gap: 6px; width: 260px;}
.type-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 12px; border-radius: 8px;
  width: 48px;
  border: 1px solid var(--border-card);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 13px; cursor: pointer; transition: all 0.2s ease;
}
.type-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.type-btn.active { background: rgba(76,154,255,0.12); border-color: rgba(76,154,255,0.3); color: #4C9AFF; }
.form-actions { margin-top: 8px; }

@media (max-width: 900px) { .tx-layout { grid-template-columns: 1fr; } .form-card { position: static; } }
</style>
