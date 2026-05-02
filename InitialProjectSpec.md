### 项目规范 (Project Spec)
#### 项目概述 (Project Overview)
你将帮助我构建一个现代化、高性能的本地个人财务管理桌面应用。该应用采用Electron框架，以实现跨平台（Windows/macOS）的桌面体验。核心技术栈为全栈TypeScript，利用Electron的主进程作为Node.js后端，直接操作SQLite数据库，渲染进程则使用Vue 3构建动态用户界面。项目的核心目标是提供一个界面美观、交互流畅、数据精确且完全在本地运行的财务管理工具。

#### 技术栈与核心依赖 (Tech Stack \& Core Dependencies)
● 桌面框架: Electron (40.9.3 )
● 前端框架: Vue 3 (使用 Composition API )
● 构建工具: Vite
● 后端环境: Node.js (Electron主进程，本地开发环境已安装Nodejs 24.15.0)
● 数据库: SQLite，通过 better-sqlite3 进行同步操作
● UI框架: Naive UI，用于构建现代化、一致的界面组件
● 动画库: GSAP (GreenSock Animation Platform)，用于实现复杂的页面过渡和微交互动画
● 图表库: ECharts，用于数据可视化(用于资产分布图、负债趋势图、投资收益率曲线)
● 精度计算: decimal.js，确保所有财务计算的绝对精确
● 工具库: date-fns (处理日期), lodash (数据处理)
● 语言: TypeScript (项目所有代码必须使用TS编写，保证类型安全)

项目架构 (Project Architecture)
项目将遵循Electron的多进程模型，清晰地分离关注点。
● 主进程 (Main Process - Node.js Backend):
○ 负责创建和管理 BrowserWindow。
○ 作为应用的后端，通过 better-sqlite3 库直接读取和写入本地的 finance.db SQLite数据库文件。
○ 封装所有数据库操作（增删改查）为独立的模块。
○ 通过 Electron 的 ipcMain 模块监听来自渲染进程的请求。
○ 处理所有涉及财务的计算，必须使用 decimal.js 库来避免浮点数精度问题。
● 渲染进程 (Renderer Process - Vue 3 Frontend):
○ 一个标准的Vite + Vue 3单页应用（SPA）。
○ 通过 naive-ui 组件库快速搭建界面。
○ 通过 electron.ipcRenderer 向主进程发送请求（invoke）并接收数据（handle）。
○ 使用 ECharts 渲染数据图表。
○ 使用 GSAP 实现页面加载、数据更新、按钮点击等场景的动画效果。

#### 核心功能模块 (Core Functional Modules)
你需要首先实现以下核心模块，作为项目的基础。
1. 数据库初始化模块 (src/main/db/init.ts)
○ 职责: 在应用首次启动时，检查并创建 finance.db 数据库文件。

#### 核心数据库设计 (Database Schema - 关键升级)
你需要设计以下核心数据表，以支持复杂的财务逻辑：

1.  **账户表 (`accounts`)**: 核心表，区分资产与负债。
    - `id`: INTEGER PRIMARY KEY
    - `name`: TEXT (e.g., "招商银行", "房贷账户", "支付宝")
    - `type`: TEXT (枚举: `asset` 资产, `liability` 负债)
    - `sub_type`: TEXT (枚举: `cash` 现金, `bank` 银行卡, `investment` 投资, `loan` 贷款, `credit` 信用卡)
    - `balance`: TEXT (使用字符串存储金额，防止精度丢失，对应 Decimal)
    - `currency`: TEXT (默认 CNY)
    - `is_active`: BOOLEAN (是否启用)

2.  **交易流水表 (`transactions`)**: 记录每一笔资金变动。
    - `id`: INTEGER PRIMARY KEY
    - `date`: TEXT (YYYY-MM-DD)
    - `type`: TEXT (枚举: `expense` 支出, `income` 收入, `transfer` 转账)
    - `amount`: TEXT (金额)
    - `from_account_id`: INTEGER (支出/转出账户)
    - `to_account_id`: INTEGER (收入/转入账户，转账时必填)
    - `category_id`: INTEGER (分类ID)
    - `description`: TEXT (备注)
    - `tags`: TEXT (JSON字符串，标签)

3.  **投资快照表 (`investment_snapshots`)**: 用于记录投资账户的市值变动，计算收益。
    - `id`: INTEGER PRIMARY KEY
    - `account_id`: INTEGER (关联投资账户)
    - `date`: TEXT
    - `market_value`: TEXT (当前市值)
    - `cost_basis`: TEXT (持仓成本)
    - `note`: TEXT (例如：月末复盘)

4.  **分类表 (`categories`)**:
    - `id`: INTEGER PRIMARY KEY
    - `name`: TEXT
    - `type`: TEXT (income/expense)
    - `icon`: TEXT (图标标识)

#### 核心功能模块 (Core Functional Modules)

1.  **全景仪表盘 (Dashboard)**
    - **净资产卡片**: 动态计算 `总资产 - 总负债 = 净资产`。
    - **资产分布**: 饼图展示（现金 vs 投资 vs 固定资产）。
    - **负债概览**: 环形图展示（房贷 vs 车贷 vs 信用卡欠款）。
    - **近期动态**: 列表展示最近5笔交易。

2.  **账户与资产负债管理 (Account Manager)**
    - **资产账户**: 支持手动修改余额（用于校准），支持查看“投资账户”的**持仓收益率**（(当前市值 - 成本) / 成本）。
    - **负债账户**:
        - **信用卡**: 记录账单日和还款日。
        - **贷款(房贷/车贷)**: 记录贷款总额、已还金额、剩余本金。
    - **转账逻辑**: 当从“银行卡”转账到“信用卡”时，资产减少，负债减少，不影响净资产，但影响现金流。

3.  **交易记账 (Transaction)**
    - **普通记账**: 支出/收入。
    - **转账记账**: 资产互转（如：银行卡 -> 支付宝），负债互转，或 资产还债（如：银行卡 -> 信用卡）。
    - **投资记账**: 专门记录“投资买入”（资产内部变动，现金减少，持仓增加）和“投资卖出”。

4.  **投资分析 (Investment Analytics)**
    - 利用 `investment_snapshots` 表的数据，使用 ECharts 绘制**“资产净值增长曲线”**。
    - 计算并展示：总投入本金、当前市值、**累计收益金额**、**年化收益率**（简单计算即可）。

#### 关键实现细节 (Implementation Details)

- **精度处理**: 数据库中金额字段使用 TEXT 存储，读取后在 Node.js 中必须转换为 `new Decimal(string)` 进行运算，最后转回字符串存入数据库。
- **IPC通信**:
    - `get-net-worth`: 返回当前净资产数据。
    - `get-asset-allocation`: 返回资产分布数据。
    - `add-transaction`: 处理复杂的事务逻辑（同时更新账户余额和插入流水）。
    - `update-investment-snapshot`: 更新投资账户的市值，自动计算当日盈亏。
- **UI/UX**:
    - 使用 Naive UI 的深色模式支持。
    - 金额显示：正数绿色，负数红色（符合中国习惯）。
    - 负债金额建议用括号或特殊颜色标记，以示区分。

#### 后端数据操作模块 (src/main/db/operations.ts)
○ 职责: 封装所有与数据库交互的逻辑，并通过IPC暴露给渲染进程。
○ 核心IPC处理器:
■ get-accounts: 返回所有资产账户列表。
■ add-transaction: 接收一个交易对象，将其插入transactions表，并同步更新accounts表中的对应账户余额。此操作必须在一个事务中完成，以保证数据一致性。
■ get-transactions: 返回所有交易记录，并按日期倒序排列。
■ get-statistics: 返回用于图表展示的统计数据，例如“本月各类别支出总额”。
3. 前端界面模块 (src/renderer/)
○ 主布局 (src/renderer/App.vue): 使用 naive-ui 的 n-layout 构建一个经典的侧边栏导航布局。
○ 仪表盘页面 (src/renderer/views/Dashboard.vue):
■ 资产总览卡片: 顶部展示总资产、本月收入、本月支出三个卡片，卡片加载时需有数字滚动的动画效果。
■ 收支趋势图: 使用 ECharts 绘制一条折线图，展示近6个月的收入与支出趋势。
○ 记账页面 (src/renderer/views/Transaction.vue):
■ 交易表单: 一个使用 n-form 构建的表单，包含金额、账户、分类、日期、备注等字段。
■ 提交动画: 点击“记一笔”按钮后，按钮本身应有一个加载动画，成功后整个表单区域应有一个平滑的收缩动画，并提示成功。
■ 交易列表: 页面下方展示最近的交易记录，使用 n-data-table 组件。
关键实现细节与规范 (Key Implementation Details \& Standards)
● 财务精度: 所有从数据库读取的金额、在前端展示、以及在后端计算的金额，都必须使用 decimal.js 的 Decimal 类型进行处理。禁止使用原生JavaScript的 number 类型进行任何加减乘除运算。
● IPC通信: 渲染进程与主进程的通信必须使用 ipcRenderer.invoke 和 ipcMain.handle 的请求-响应模式，确保操作的同步性和结果的可靠返回。
● 样式与动画: 界面风格应简洁、现代，留白充足。所有页面切换、数据加载、用户交互都应有平滑的过渡动画，避免生硬的界面跳转。动画时长建议在200ms-400ms之间，缓动函数优先使用 ease-out 类。
● 代码风格: 遵循标准的TypeScript和Vue 3代码规范。组件应尽可能单一职责，逻辑清晰。

### 你的任务 (Your Task)
请根据以上规范，为我生成项目的基础结构和核心代码。首先，请创建项目所需的所有目录和文件，并编写 package.json 以包含所有必要的依赖。然后，请依次实现数据库初始化、后端IPC处理器和前端Vue组件的代码。请确保代码是完整且可运行的。