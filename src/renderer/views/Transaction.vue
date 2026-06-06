<template>
  <div class="tx-page">
    <div class="page-header">
      <h2 class="page-title">交易记账</h2>
      <n-button @click="showImageImport = true" type="primary" ghost>
        <template #icon><RobotOutlined /></template>
        AI 识别导入
      </n-button>
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
                <img :src="opt.icon" width="16" height="16" />
                {{ opt.label }}
              </button>
            </div>
          </n-form-item>

          <n-form-item label="金额" path="amount">
            <CalculatorInput
              v-model:value="form.amount"
              :min="0.01"
              :step="100"
              placeholder="0.00"
            >
              <template #prefix>¥</template>
            </CalculatorInput>
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

          <n-form-item label="家庭成员" path="member_name" v-if="form.type === 'expense'">
            <n-select
              v-model:value="form.member_name"
              :options="memberOptions"
              placeholder="选择成员（可选）"
              clearable
            />
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
          <n-button size="small" @click="showFilters = !showFilters">
            <template #icon><SearchOutlined /></template>
            {{ showFilters ? '收起筛选' : '展开筛选' }}
          </n-button>
        </div>

        <!-- 搜索筛选面板 -->
        <div v-if="showFilters" class="filter-panel">
          <div class="filter-row">
            <n-input
              v-model:value="filters.keyword"
              placeholder="搜索描述/备注..."
              clearable
              size="small"
            >
              <template #prefix><SearchOutlined /></template>
            </n-input>
          </div>
          <div class="filter-row">
            <n-select
              v-model:value="filters.type"
              :options="filterTypeOptions"
              placeholder="交易类型"
              clearable
              size="small"
            />
            <n-select
              v-model:value="filters.category_id"
              :options="filterCategoryOptions"
              placeholder="分类"
              clearable
              size="small"
              :disabled="filters.type === 'transfer'"
            />
          </div>
          <div class="filter-row">
            <n-select
              v-model:value="filters.account_id"
              :options="accountOptions"
              placeholder="账户"
              clearable
              size="small"
            />
            <n-date-picker
              v-model:formatted-value="filters.dateRange"
              type="daterange"
              clearable
              size="small"
              :style="{ width: '100%' }"
            />
          </div>
          <div class="filter-row">
            <n-input-number
              v-model:value="filters.amountMin"
              placeholder="最小金额"
              clearable
              size="small"
              :min="0"
            >
              <template #prefix>¥</template>
            </n-input-number>
            <n-input-number
              v-model:value="filters.amountMax"
              placeholder="最大金额"
              clearable
              size="small"
              :min="0"
            >
              <template #prefix>¥</template>
            </n-input-number>
          </div>
          <div class="filter-actions">
            <n-button size="small" @click="resetFilters">重置筛选</n-button>
            <span class="filter-count">共 {{ filteredTransactions.length }} 条记录</span>
          </div>
        </div>

        <n-data-table
          :columns="columns"
          :data="filteredTransactions"
          :bordered="false"
          :single-line="false"
          size="small"
          virtual-scroll
          max-height="calc(100vh - 400px)"
        />
      </div>
    </div>

    <!-- 图像导入模态框 -->
    <ImageImportModal
      v-model:show="showImageImport"
      @imported="handleImageImported"
    />

    <!-- 编辑交易模态框 -->
    <n-modal
      v-model:show="showEditModal"
      title="修改交易记录"
      preset="card"
      :style="{ width: '480px' }"
      :segmented="{ content: true, footer: true }"
    >
      <n-form ref="editFormRef" :model="editForm" :rules="editRules" label-placement="top">
        <n-form-item label="交易类型" path="type">
          <div class="type-toggle">
            <button
              v-for="opt in typeOptions"
              :key="opt.value"
              class="type-btn"
              :class="{ active: editForm.type === opt.value }"
              @click="editForm.type = opt.value"
            >
              <component :is="opt.icon" :size="16" />
              {{ opt.label }}
            </button>
          </div>
        </n-form-item>

        <n-form-item label="金额" path="amount">
          <CalculatorInput
            v-model:value="editForm.amount"
            :min="0.01"
            :step="100"
            placeholder="0.00"
          >
            <template #prefix>¥</template>
          </CalculatorInput>
        </n-form-item>

        <n-form-item label="分类" path="category_id" v-if="editForm.type !== 'transfer'">
          <n-select
            v-model:value="editForm.category_id"
            :options="editCategoryOptions"
            placeholder="选择分类"
          />
        </n-form-item>

        <n-form-item label="账户" path="from_account_id">
          <n-select
            v-model:value="editForm.from_account_id"
            :options="accountOptions"
            placeholder="选择账户"
          />
        </n-form-item>

        <n-form-item label="目标账户" path="to_account_id" v-if="editForm.type === 'transfer'">
          <n-select
            v-model:value="editForm.to_account_id"
            :options="accountOptions"
            placeholder="选择目标账户"
          />
        </n-form-item>

        <n-form-item label="日期" path="date">
          <n-date-picker v-model:formatted-value="editForm.date" type="date" :style="{ width: '100%' }" />
        </n-form-item>

        <n-form-item label="备注" path="description">
          <n-input v-model:value="editForm.description" placeholder="添加备注..." maxlength="100" show-count />
        </n-form-item>

        <n-form-item label="家庭成员" path="member_name" v-if="editForm.type === 'expense'">
          <n-select
            v-model:value="editForm.member_name"
            :options="memberOptions"
            placeholder="选择成员（可选）"
            clearable
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存修改</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import {
  NForm, NFormItem, NSelect, NDatePicker, NInput, NInputNumber,
  NButton, NDataTable, NPopconfirm, NModal, useMessage,
} from 'naive-ui'
import CalculatorInput from '../components/CalculatorInput.vue'
import ImageImportModal from '../components/ImageImportModal.vue'
import type { DataTableColumn } from 'naive-ui'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined, RobotOutlined,
} from '@vicons/antd'
import OutcomeSvg from '../../assets/outcome.svg'
import IncomeSvg from '../../assets/income.svg'
import TransferSvg from '../../assets/transfer.svg'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'
import { useColorMode } from '../composables/useColorMode'
import type { TransactionType, Transaction } from '@shared/types'

const {
  sortedTransactions, expenseCategories, incomeCategories, assetAccounts,
  getAccountById, getCategoryById, addTransaction, updateTransaction, deleteTransaction,
  memberOptions, getMemberByName,
} = useFinance()
const { currencyPlain, shortDate } = useFormatter()
const { amountClass } = useColorMode()
const message = useMessage()

const formRef = ref()
const editFormRef = ref()
const submitting = ref(false)
const editSubmitting = ref(false)
const showFilters = ref(false)
const showEditModal = ref(false)
const editingId = ref<number | null>(null)
const showImageImport = ref(false)

// ===== 家庭成员 =====
// memberOptions and getMemberByName are provided by useFinance()
// which loads family members during init

const today = new Date().toISOString().slice(0, 10)

// ===== 新增表单 =====
const form = ref({
  type: 'expense' as TransactionType,
  amount: null as number | null,
  category_id: null as number | null,
  from_account_id: null as number | null,
  to_account_id: null as number | null,
  date: today,
  description: '',
  member_name: '',
})

const rules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur', type: 'number', min: 0.01 }],
  from_account_id: [{ required: true, message: '请选择账户', trigger: 'change', type: 'number' }],
  to_account_id: [{ required: true, message: '请选择目标账户', trigger: 'change', type: 'number' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change', type: 'number' }],
}

// ===== 编辑表单 =====
const editForm = ref({
  type: 'expense' as TransactionType,
  amount: null as number | null,
  category_id: null as number | null,
  from_account_id: null as number | null,
  to_account_id: null as number | null,
  date: today,
  description: '',
  member_name: '',
})

const editRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur', type: 'number', min: 0.01 }],
  from_account_id: [{ required: true, message: '请选择账户', trigger: 'change', type: 'number' }],
  to_account_id: [{ required: true, message: '请选择目标账户', trigger: 'change', type: 'number' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change', type: 'number' }],
}

// ===== 筛选条件 =====
const filters = ref({
  keyword: '',
  type: null as TransactionType | null,
  category_id: null as number | null,
  account_id: null as number | null,
  dateRange: null as [string, string] | null,
  amountMin: null as number | null,
  amountMax: null as number | null,
})

// ===== 选项 =====
const typeOptions = [
  { value: 'expense' as const, label: '支出', icon: OutcomeSvg },
  { value: 'income' as const, label: '收入', icon: IncomeSvg },
  { value: 'transfer' as const, label: '转账', icon: TransferSvg },
]

const filterTypeOptions = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' },
  { label: '转账', value: 'transfer' },
]

const accountOptions = computed(() =>
  assetAccounts.value.map(a => ({ label: a.name, value: a.id }))
)

const categoryOptions = computed(() => {
  const cats = form.value.type === 'income' ? incomeCategories.value : expenseCategories.value
  return cats.map(c => ({ label: c.name, value: c.id }))
})

const editCategoryOptions = computed(() => {
  const cats = editForm.value.type === 'income' ? incomeCategories.value : expenseCategories.value
  return cats.map(c => ({ label: c.name, value: c.id }))
})

const filterCategoryOptions = computed(() => {
  const allCats = [...expenseCategories.value, ...incomeCategories.value]
  return allCats.map(c => ({ label: `${c.type === 'income' ? '收入' : '支出'} - ${c.name}`, value: c.id }))
})

// ===== 表格列定义 =====
const columns: DataTableColumn[] = [
  {
    title: '日期', key: 'date', width: 90,
    render: (row: any) => shortDate(row.date),
  },
  {
    title: '类型', key: 'type', width: 60,
    render: (row: any) => {
      const icon = row.type === 'income' ? IncomeSvg : row.type === 'expense' ? OutcomeSvg : TransferSvg
      const cls = row.type === 'transfer' ? '' : amountClass(row.type === 'expense')
      return h('span', { class: cls }, h('img', { src: icon, width: '14', height: '14' }))
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
    title: '成员', key: 'member_name', width: 90,
    render: (row: any) => {
      if (!row.member_name) return h('span', { style: { color: 'var(--text-disabled)' } }, '—')
      const member = getMemberByName(row.member_name)
      if (!member) return h('span', {}, row.member_name)
      const avatar = member.avatar
        ? h('img', { src: member.avatar, style: { width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', marginRight: '6px', verticalAlign: 'middle' } })
        : h('span', { style: { fontSize: '16px', marginRight: '4px' } }, '👤')
      return h('div', { style: { display: 'flex', alignItems: 'center' } }, [
        avatar,
        h('span', { style: { fontSize: '13px' } }, member.name),
      ])
    },
  },
  {
    title: '金额', key: 'amount', width: 120, align: 'right',
    render: (row: any) => {
      const prefix = row.type === 'income' ? '+' : row.type === 'expense' ? '-' : ''
      const cls = row.type === 'transfer' ? '' : amountClass(row.type === 'expense')
      return h('span', { class: cls, style: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, prefix + currencyPlain(row.amount))
    },
  },
  {
    title: '', key: 'actions', width: 80, align: 'center',
    render: (row: any) => h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } }, [
      h(NButton, {
        text: true, size: 'small', type: 'primary',
        onClick: () => handleEdit(row),
      }, { icon: () => h(EditOutlined) }),
      h(
        NPopconfirm,
        { onPositiveClick: () => handleDelete(row.id) },
        {
          trigger: () => h(NButton, { text: true, size: 'small', type: 'error' }, { icon: () => h(DeleteOutlined) }),
          default: () => '确定删除这笔记录？',
        }
      ),
    ]),
  },
]

// ===== 筛选逻辑 =====
const filteredTransactions = computed(() => {
  let result = sortedTransactions.value

  // 关键词搜索
  const q = filters.value.keyword?.trim().toLowerCase()
  if (q) {
    result = result.filter(t => {
      const desc = (t.description || '').toLowerCase()
      const catName = (getCategoryById(t.category_id ?? 0)?.name || '').toLowerCase()
      const acctName = (getAccountById(t.from_account_id ?? 0)?.name || '').toLowerCase()
      const memberName = (t.member_name || '').toLowerCase()
      return desc.includes(q) || catName.includes(q) || acctName.includes(q) || memberName.includes(q)
    })
  }

  // 类型筛选
  if (filters.value.type) {
    result = result.filter(t => t.type === filters.value.type)
  }

  // 分类筛选
  if (filters.value.category_id) {
    result = result.filter(t => t.category_id === filters.value.category_id)
  }

  // 账户筛选
  if (filters.value.account_id) {
    result = result.filter(t =>
      t.from_account_id === filters.value.account_id || t.to_account_id === filters.value.account_id
    )
  }

  // 日期范围筛选
  if (filters.value.dateRange && filters.value.dateRange[0] && filters.value.dateRange[1]) {
    const [start, end] = filters.value.dateRange
    result = result.filter(t => t.date >= start && t.date <= end)
  }

  // 金额范围筛选
  if (filters.value.amountMin !== null && filters.value.amountMin !== undefined) {
    result = result.filter(t => Number(t.amount) >= filters.value.amountMin!)
  }
  if (filters.value.amountMax !== null && filters.value.amountMax !== undefined) {
    result = result.filter(t => Number(t.amount) <= filters.value.amountMax!)
  }

  return result
})

function resetFilters() {
  filters.value = {
    keyword: '',
    type: null,
    category_id: null,
    account_id: null,
    dateRange: null,
    amountMin: null,
    amountMax: null,
  }
}

// ===== 操作处理 =====
async function handleDelete(id: number) {
  try {
    await deleteTransaction(id)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

function handleEdit(row: Transaction) {
  editingId.value = row.id
  editForm.value = {
    type: row.type,
    amount: Number(row.amount),
    category_id: row.category_id,
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    date: row.date,
    description: row.description || '',
    member_name: row.member_name || '',
  }
  showEditModal.value = true
}

async function handleEditSubmit() {
  if (!editingId.value) return

  editFormRef.value?.validate(async (errors: any) => {
    if (errors) return
    editSubmitting.value = true
    try {
      await updateTransaction(editingId.value, {
        date: editForm.value.date,
        type: editForm.value.type,
        amount: String(editForm.value.amount ?? 0),
        from_account_id: editForm.value.from_account_id,
        to_account_id: editForm.value.to_account_id,
        category_id: editForm.value.type === 'transfer' ? null : editForm.value.category_id,
        description: editForm.value.description,
        member_name: editForm.value.type === 'expense' ? editForm.value.member_name : '',
      })
      message.success('修改成功')
      showEditModal.value = false
      editingId.value = null
    } catch {
      message.error('修改失败')
    } finally {
      editSubmitting.value = false
    }
  })
}

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
        member_name: form.value.type === 'expense' ? form.value.member_name : '',
      })
      message.success('记账成功')
      form.value.amount = null
      form.value.category_id = null
      form.value.to_account_id = null
      form.value.description = ''
      form.value.member_name = ''
    } catch {
      message.error('记账失败')
    } finally {
      submitting.value = false
    }
  })
}

function handleImageImported() {
  // 图像导入成功后的回调，可以刷新列表或显示提示
  message.success('截图导入成功，交易记录已更新')
}
</script>

<style scoped>
.tx-page { padding: clamp(16px, 2vw, 32px); width: 100%; box-sizing: border-box; }
.page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }
.tx-layout { display: grid; grid-template-columns: clamp(320px, 22vw, 420px) 1fr; gap: clamp(16px, 1.5vw, 24px); align-items: start; }

.glass-card { padding: 20px 24px; }
.form-card { position: sticky; top: 28px; }
.list-card { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.list-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }

.type-toggle { display: flex; gap: 6px; width: 100%; }
.type-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px;
  border: 1px solid var(--border-card);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 13px; cursor: pointer; transition: all 0.2s ease;
  white-space: nowrap;
}
.type-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.type-btn.active { background: rgba(76,154,255,0.12); border-color: rgba(76,154,255,0.3); color: #4C9AFF; }
.form-actions { margin-top: 8px; }

/* 筛选面板样式 */
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-hover);
  border-radius: 8px;
  border: 1px solid var(--border-card);
}
.filter-row {
  display: flex;
  gap: 10px;
}
.filter-row > * {
  flex: 1;
}
.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-count {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .tx-layout { grid-template-columns: 1fr; }
  .form-card { position: static; }
  .filter-row { flex-direction: column; }
}
</style>
