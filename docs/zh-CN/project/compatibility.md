# 兼容性

这张表记录仓库的接入范围和验证用例。Beta 表格描述已发布的包，后面的新增部分描述可选的 0.2 Alpha 范围。版本与发布节奏见[发布线说明](./release-lines.md)。

## Beta 四框架适配情况

Vue、React、Solid、Svelte 的 adapter 都已随 `0.1.0-beta.0` 发布，可以从 npm
`beta` 渠道安装。但“已发包”不等于“支持宿主框架的全部功能”：Vue/React 是主支持
路径，Solid/Svelte 仍为实验性支持。

| 能力与验收 | Vue 3 | React 19 | Solid 1.9 | Svelte 5 |
| --- | --- | --- | --- | --- |
| Beta 支持级别 | 支持 | 支持 | 实验性 | 实验性 |
| Rust 组件挂载、props 更新、事件回调 | 已验证 | 已验证 | 已验证 | 已验证 |
| 实例级 Store action 与响应式快照 | `Ref`：`state.value` | snapshot：`state` | `Accessor`：`state()` | `Readable`：`$state` |
| 组件/Store 声明、owned struct 与 unit enum 类型生成 | 已实现 | 已实现 | 已实现 | 已实现 |
| 生命周期证据 | 挂载卸载、Store 延迟返回清理 | StrictMode、Store 延迟返回清理 | adapter 测试覆盖 owner 清理和延迟返回 | 子组件卸载时 Component/Store 各 dispose 一次 |
| Rust 源码生产构建与浏览器用例 | Vite 7 + Chromium | Vite 7 + Chromium | Vite 7 + Chromium | Vite 7 + Chromium |
| 已发布 Beta 的干净项目安装打包产物验收 | 已覆盖 | 已覆盖 | 尚未覆盖 | 尚未覆盖 |
| npm registry 独立验收 | 已覆盖 | 已覆盖 | 尚未覆盖 | 尚未覆盖 |
| 已发布 Beta 的 SSR / hydration / slots | 未支持 | 未支持 | 未支持 | 未支持 |

[Beta.0 发布流程](https://github.com/vooyajs/vooya/actions/runs/36614375254)
已通过完整 `verify:release`，其中包含四个 `test:rust-*` 浏览器用例。adapter
单元测试与共享 build-core 声明测试补充类型和生命周期证据；`test:packed-release`
与 `test:registry` 的干净消费项目则仅覆盖 Vue/React，不能因为四个包都已发布就
把这项证据扩展到 Solid/Svelte。

这次 Beta 还修复了 React 将已就绪的 `null` Store 快照当成未加载的问题，以及
Vue 将未传入的可选 Boolean prop 转成 `false` 的问题。Solid/Svelte 原有路径已
保留这些值，不需要照搬相同修复。

当前 main 的 `test:vite8-frameworks` 对 Vue/React/Solid/Svelte 分别进行干净 tarball
安装，验证 Vite 8.2.1 的生产构建、Chromium 交互、严格声明类型，以及开发时 Rust
修改、编译错误恢复、连续保存与宿主组件修改。Svelte 的 Vite 8 路径使用
`@sveltejs/vite-plugin-svelte` 7.1.2。这些打包源码用例不等于 Solid/Svelte 的独立 npm registry 浏览器证据，支持级别仍为
实验性。这些是 Alpha 对应源码的具名验收，不属于上表的 Beta 证据。已发布安装路径见[快速开始](../guide/getting-started.md)。

## 版本与工具链边界

本表分别记录 Beta、Alpha 与私有实验；Alpha 行不能通过安装 `@beta` 获得。

| 层 | 版本 | 状态 | 边界 |
| --- | --- | --- | --- |
| Node.js | `^20.19.0 \|\| >=22.12.0` | Supported | quickstart 覆盖 Ubuntu/Node 20、macOS/Node 22、Windows/Node 22 |
| Vue | `>=3.5.2 <4` | Supported | 3.5.2–3.5.41 声明检查通过；3.6/Vapor 仍是 experimental evidence |
| React | `>=19` | Supported | fixture 覆盖 19.0.0 与 19.2.0 |
| Solid | `>=1.9 <2` | Experimental | Vite 7 browser fixture 覆盖 Rust Component、callback event 和 Accessor 驱动的 Store 更新；adapter unit test 覆盖 owner cleanup 与 late resolve |
| Svelte | `>=5 <6` | Experimental | Svelte 5 + Vite 7 Chromium fixture 覆盖 Component mount/callback、Store action、prop update、`Readable` 声明，以及 Component/Store owner cleanup |
| Octane | `0.9.0` | 私有 workspace 实验；不纳入 0.2 | 独立 fixture 使用 plugin 0.2.1、Vite 8.0.16，覆盖 Component/Store 实例隔离、props/event、销毁重建和声明；Node >=22.22.2；尚无 npm 发布或 SSR 承诺 |
| Vite | `>=7 <9` | 主路径 | Vite 8.2.1 四框架独立打包、类型、生产浏览器和开发恢复验收；Vite 7 保持回归测试 |
| Vite+ | `0.2.9`，core alias `0.2.9`（Vite `8.2.1`） | Alpha 四框架具名验收 | Vue/React/Solid/Svelte 的干净 tarball 安装、`.rs` 生产构建、Chromium、严格声明检查、dev 重建与错误恢复 |
| Rspack / Rsbuild | Rspack `>=2.1.10`；Rsbuild `>=2.1.13` | 正式支持 Vue/React | Alpha Rust-file 生产、watch、开发服务器恢复；Rslib 仅验证库构建输出 |
| Webpack | `>=5` | 正式支持 Vue/React | 5.101.0 生产回归；5.109.2 生产、watch 与开发服务器恢复；Webpack 4 不支持 |
| Vue Vapor | Vue 3.6.0-beta.17 + Vite 8.2.1 | Experimental | 需要 Vue 的 `vaporInteropPlugin`，不是 Vooya 自己的 renderer |

Solid 这一行只说明当前 Vite 7 + Chromium fixture 与 adapter unit test 的证据，
Alpha 另有 Vite 8 packed 证据；不推导 Rspack/Webpack、SSR、hydration 或其他浏览器已经兼容。
Svelte 这一行同样只说明具名 Vite 7 + Chromium fixture；不推导 Svelte 3/4、
SvelteKit、SSR/hydration、Rspack/Webpack 或其他浏览器已经兼容。fixture
在卸载子组件后断言 Component handle 与 generated Store 各调用一次 `dispose()`。

当前 main 的 `test:vite-plus-frameworks` 还覆盖快速连续保存及宿主组件更新；Rust 编辑使用整页刷新，
不承诺保留状态。`test:vite-plus` 也验证普通 Rust 源码和依赖重建。依赖按官方 alias/overrides
配置即可正常 npm 安装，不需要 legacy peer resolver。范围限定为上述版本的 dev/build，
不推导其他 Vite+ 版本、其全部工具或 SSR 支持。配置见 [Vite+ 接入](../guide/other-integrations.md#vite)。

## 正式支持的 Rust-file bundler

Rspack 与 Webpack 现为**正式支持的 Vue/React 一方接入**。使用[0.2 Alpha 包组合](next-release.md)；
支持等级与 npm 发布通道不同，本次转正不会把包变成稳定版本，旧非 Vite Beta 包也不因此获得 `.rs` 能力。

`test:rust-bundlers` 在干净 tarball 项目中验证 Webpack 5.109.2、Rspack 2.1.10：
Vue/React 的 Rust Component、Store、props/event、scoped CSS、生成声明、卸载重建，
以及 `rust.sourceRoot: "."`。两种框架的 watch 都覆盖编译错误恢复、CSS 更新、新增模块、
编译期间再次保存、删除撤销，以及产物不会造成循环重建。
`test:rspack` 与 `test:webpack` 还验证两种框架的开发服务器源码更新和失败恢复；
Webpack 包含 path dependency 修改和快速保存，Rspack 的 path dependency 修改仍需重启开发服务器。
这三条验收命令都在 PR 的 integration compatibility 工作流中持续运行。

具名浏览器证据为 Chromium。Rsbuild 2.1.13 覆盖 Vue/React Component 的 dev/build；
Rslib 0.23.2 仅验证库输出，不承诺 Store/库消费验收。Solid/Svelte、SSR/Next.js、hydration、
Module Federation、保留 Rust 状态的 HMR、每种 bundler 组合独立的精确 registry 浏览器验收，
以及未列出的 OS/browser 组合，均不在本次正式支持范围。

## 已实现的接入为什么仍标为实验性

| 接入 | 已有实现与证据 | 仍缺少的验收 |
| --- | --- | --- |
| Managed preset | 固定工具版本、独立缓存、校验和、锁与重试；三平台源码打包消费者和[全新缓存 registry 消费者](https://github.com/vooyajs/vooya/actions/runs/37583146228) | 物理上未安装 Rust 的宿主、完整安装中断恢复；仍需要宿主 SDK/linker；musl Linux、Windows arm64 不在 managed 目标内 |

[本次 Alpha 发布记录](../../maintainers/releases/0.2-alpha-refresh.md#verification-and-evidence)
区分了源码 tarball 与精确 registry 版本的证据。移除旧源码格式不会自动补齐这些验收，
也不会改变历史 npm 发布版本。

## 0.2 Alpha：SSR 接入

当前源码将 Vue Store 的创建推迟到浏览器挂载，并保留 React 的客户端边界。
adapter 测试覆盖服务端渲染和 hydration，Nuxt 独立打包用例覆盖 WASM 加载、
props/event、独立 Store 和路由清理。服务端渲染的是宿主容器，Rust 组件内容仍由
浏览器生成。Next.js 尚未验证，具体 API 边界见 [SSR 范围](./ssr-roadmap.md)。

## 尚未支持或未验证

Safari/WebKit、移动浏览器、Rollup、Turbopack 和未列出的
bundler 没有当前兼容性声明。当前开发线已退役专用组件包 builder 和 Vue 消费 fixture，
组件作者自行组织 JS/WASM 包与 npm 元数据。当前开发线只接受普通 Rust 源码，
历史版本保持原状；见[迁移说明](./retired-authoring.md)。

查看每项命令和完整边界请看[英文兼容性矩阵](../../project/compatibility.md)。
