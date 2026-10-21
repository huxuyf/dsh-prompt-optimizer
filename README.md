# dsh-prompt-optimizer

DeepSeek Harness 的提示词优化插件：在消息输入框下方、模型选择器左侧新增一个「优化提示词」图标，点击后把输入框中的内容交给当前默认模型优化，并用优化结果替换原内容。

## 插件简介

### 作用

在 DeepSeek Harness Web 界面的消息输入框（composer）中，输入框下方工具行、模型选择器**左侧**会出现一个星光图标。输入内容后点击该图标，插件会读取输入框中的草稿，调用当前默认模型对这段提示词进行优化（改写为更清晰、结构化的提示词），然后把优化结果**整体替换**到输入框中。

### 主要功能

- **图标按钮**：注册在 composer 的 `conversation.input.right` 插槽（输入框下方工具行、模型选择器左侧）。使用原创星光图标，通过 `currentColor` 继承主题配色，支持深浅色主题。
- **优化流程**：
  1. 通过 `useInput`（uiSession 标准 hook）读取当前草稿文本；
  2. 调用 `/prompt-optimize` 命令（经 `ctx.remote.commands.execute` 远程端点）；
  3. Host 半通过 `llm` 服务（`llm.stream`）发起一次模型请求，模型选自 `agentDefaultModel.currentSelection()`（即设置中的默认模型）；
  4. 累积流式返回的文本，剥离模型可能附加的代码围栏与引号；
  5. 通过 `inputActions.setDraft()` 用优化结果整体替换输入框内容。
- **优化规则**（内置系统提示词）：保留原文语言（中文保持中文、英文保持英文、混合保持混合）；保留全部具体细节（文件路径、标识符、命令、约束、示例、数量与优先级）；使意图、期望输出与成功标准显式化；不发明新需求；只返回改写后的提示词文本。
- **行为细节**：
  - 草稿为空或输入框不可编辑时按钮禁用；
  - 优化进行中图标旋转，结束后短暂显示状态文本（4 秒后自动消失）；失败时显示内联错误；
  - 每次点击持有独立的取消信号，切换会话或组件卸载时中止进行中的请求；
  - 优化调用按当前会话的会话身份执行，网关经 `agent` lookup 解析目标 Agent。
- **隐私说明**：命令以 `recordInput: false` 注册——**原始草稿不会写入会话日志**；优化结果作为命令结果记录（与翻译类插件的保存方式一致）。
- **附带能力**：`/prompt-optimize` 同时是一个可发现的斜杠命令，在输入框输入 `/` 可以看到它。

### 不做的事

- 不改变 Agent 循环、不添加模型工具、不修改系统提示词；
- 不替换输入框中的引用芯片以外的结构（整体替换会把它重写为纯文本）。

## 安装说明

### 前置要求

- DeepSeek Harness 桌面版，使用 profile 启动；
- 已在设置中配置**默认模型**（插件使用 `agentDefaultModel` 的当前选择发起优化请求；未配置时点击图标会提示模型调用失败）；
- 一个可以使用 `plugin_manager` 工具的 Harness 会话（用它在目标 profile 上执行安装）。

### 安装步骤

1. **获取插件文件**（得到一个包含以下 7 个文件的目录）：

   ```bash
   git clone https://github.com/huxuyf/dsh-prompt-optimizer.git
   ```

   或下载仓库 zip 并解压。目录内容：

   ```
   dsh-prompt-optimizer/
   ├── package.json        # bundle 清单（dsh.bundle.patch 与 dsh.client 声明）
   ├── cordis.patch.yml    # 插入 dsh-prompt-optimizer 插件行
   ├── index.js            # Host 半：/prompt-optimize 命令与 LLM 调用
   ├── client.js           # Client 半：图标按钮与草稿替换
   ├── locale/zh.json      # 中文文案
   ├── locale/en.json      # 英文文案
   └── icon.svg            # 图标
   ```

2. **安装**：在 DeepSeek Harness 中打开任意会话，告诉 agent「请安装插件 `<插件目录的绝对路径>`」，等价于执行：

   ```
   plugin_manager { "action": "install_bundle", "target": "<插件目录的绝对路径>" }
   ```

   安装会自动完成：把包链接进 profile 的 `node_modules`，并插入插件行（安装即启用）。本插件无任何 npm 依赖，正常不会出现构建脚本批准提示；若出现，选择允许即可。

3. **刷新页面**：刷新 Web 界面，让浏览器加载新 Client 模块。

4. **验证**：

   - 输入框下方、模型选择器左侧出现星光图标；
   - 侧边栏 → 插件（Plugins）→ 已安装列表出现「提示词优化 / Prompt Optimizer」，带蓝色星光图标；
   - 输入内容后点击图标，输入框内容被优化结果替换。

5. **停用 / 卸载**（可选）：

   ```
   plugin_manager { "action": "set_plugin", "target": "dsh-prompt-optimizer", "enabled": false }   # 停用
   plugin_manager { "action": "remove_bundle", "target": "dsh-prompt-optimizer" }                  # 卸载
   ```

### 注意事项

- 安装路径在本地即可：`install_bundle` 会创建指向插件目录的链接，之后**不要移动或删除源目录**（否则插件失效；重新获取文件再安装一遍即可）。
- 插件随 Harness 重启保留。
- 优化请求使用你配置的默认模型，按你的账户/凭据计费。

## 版本兼容

### 已验证版本

| 组件 | 版本 | 依据 |
|---|---|---|
| 本插件 | 1.0.0 | `package.json` 的 `version` |
| DeepSeek Harness 桌面应用 | 0.2.1-rc.2（产品版本 0.2.1.0） | 安装目录中 `DeepSeek Harness.exe` 的 FileVersion |
| `@deepseek-ai/dsh-client-ui-conversation` | 0.2.1-rc.2 | 该包 `package.json` 的 `version` |
| `@deepseek-ai/dsh-client-ui-session` | 0.2.1-rc.2 | 该包 `package.json` 的 `version` |
| `@deepseek-ai/dsh-api-gateway` | 0.2.1-rc.2 | 该包 `package.json` 的 `version` |
| `@deepseek-ai/dsh-commands` | 0.2.1-rc.2 | 该包 `package.json` 的 `version` |
| `@deepseek-ai/dsh-llm` | 0.2.1-rc.2 | 该包 `package.json` 的 `version` |
| `@deepseek-ai/cordis` | ~4.0.5 | 上述包声明的 `peerDependencies` |

**结论：本插件在 DeepSeek Harness 0.2.1-rc.2（捆绑上述包版本）上开发并通过验证。**

### 依赖的 API 面

插件依赖以下 Harness 内部 API，这些 API 的可用性决定兼容性：

- 插槽：`conversation.input.right`（composer 工具行、模型选择器左侧的列表插槽）；
- uiSession 标准 props：`useInput`（输入状态 hook）、`inputActions`（含 `setDraft`）、`sessionId`；
- 远程端点：`commands/execute`（direct 变体，位置参数 `agentId`/`line`/`submittedAttachments` + 可选 AbortSignal）；
- Host 服务：`llm`（`stream()`）、`agentDefaultModel`（`currentSelection()`）、`commands`（`register()`）；
- Cordis 机制：模块级 `inject`、`ctx.inject` 嵌套点号路径（`remote.commands`）、`ctx.slots.inject`。

### 兼容性判断

- 插件的 `package.json` **未声明** `engines.dsh` 版本门槛，因此安装不会被硬性版本检查阻止；
- 未在 0.2.1-rc.2 以外的 dsh 版本上验证。更高或更低版本只要保留上述 API 面即可工作；
- 若 API 变化，插件会以以下方式失效（不影响 Harness 其他功能）：
  - 图标不渲染，控制台报 `slot entry crashed in 'conversation.input.right'`；
  - 点击图标提示注入或远程调用错误。
