# 飞书 × n8n 自动化节点

**简体中文** | [English](./README.en.md)

在 n8n 中连接飞书，把消息通知、表格数据处理、文档管理和日程安排串成自动化工作流。支持接收飞书事件启动流程，也支持在流程中读取和更新飞书数据，提供 **11 类资源、140+ 项操作**。

安装包：`@luka-cat-mimi/n8n-nodes-feishu`。这是社区维护的节点包，需要在 n8n 中安装使用。

[能做什么](#use-cases) · [选择节点](#nodes) · [开始使用](#start) · [核心特性](#features) · [功能范围](#resources) · [详细指南](#guides)

<a id="use-cases"></a>

## 能做什么

下面是可以搭建的工作流示例，需要自行配置节点、凭证与权限：

| 想解决的问题 | 工作流示例 |
| --- | --- |
| 每天提醒团队处理待办 | 定时启动 → 查询多维表格中的待办记录 → 发送飞书群消息 |
| 将业务数据同步到表格 | 接收业务数据 → 按订单号匹配 → 已有记录则更新，没有则新增（Upsert） |
| 自动整理收到的信息 | 收到飞书消息 → 提取需要的内容 → 创建云文档或任务 |

<a id="nodes"></a>

## 选择哪个节点

安装后可以使用以下四类节点。**发送消息、读写表格等操作，都在「飞书」节点的 Resource（资源）和 Operation（操作）中选择**，无需逐个安装。

| 节点名称（界面原名） | 用途 | 什么时候选 |
| --- | --- | --- |
| 飞书 | 在流程中执行飞书操作 | 发消息、查询表格、创建文档等 |
| 飞书 Trigger | 通过长连接（WebSocket）接收事件，启动流程 | 使用飞书长连接订阅方式；无需提供公网回调地址 |
| 飞书 Webhook Trigger | 通过回调地址接收事件，启动流程 | 已有飞书能访问的回调地址，使用服务器回调订阅方式 |
| 飞书响应 | 向飞书返回本次事件或回调的处理结果 | 卡片交互等需要同步响应的场景；发送聊天消息请使用「飞书」节点 |

两个触发器都需要在飞书后台配置事件订阅。节点默认不过滤事件类型，**不会自动替你订阅飞书后台的所有事件**。选择与配置方法见[事件接入指南](./docs/zh-CN/advanced.md#triggers)。

<a id="start"></a>

## 开始使用

1. **安装节点包**：自托管 n8n 可在 `Settings → Community nodes → Install` 输入 `@luka-cat-mimi/n8n-nodes-feishu`。需要管理员安装权限；其他安装方式和 Cloud 条件见[安装说明](./docs/zh-CN/getting-started.md#installation)。
2. **连接飞书应用**：创建飞书应用、开通所需权限，在 n8n 中配置凭证。首次使用可按入门示例选择应用级别凭证；[两种凭证如何选择](./docs/zh-CN/getting-started.md#credentials)。
3. **运行第一个工作流**：跟随[发送一条群消息](./docs/zh-CN/getting-started.md#first-workflow)，完成「手动触发 → 飞书发送文本消息」。指南包含群 ID 获取方法、参数填写和成功结果。

认证成功不等于能够访问所有资源。文档、表格等还需要相应的业务权限和资源访问授权。首次配置应用及权限时，可能需要组织管理员协助。

<a id="features"></a>

## 核心特性

| 特性 | 带来的便利 | 使用边界 |
| --- | --- | --- |
| 多维表格增强操作 | 通过字段映射填写数据，按条件查询或删除、按记录 ID 更新，或执行 Upsert | 匹配到多条记录时，Upsert 仅更新第一条；建议按业务唯一字段匹配 |
| 自动翻页（Return All） | 自动获取筛选条件下的全部结果，无需手动管理分页标记 | 仅部分操作支持，默认关闭；仍受当前身份权限限制 |
| 两种事件接入方式 | 可以选择长连接或 Webhook 来启动工作流 | 后台订阅、网络条件和同步响应要求不同 |
| 批次与超时配置 | 在支持的操作中控制输入项处理节奏、设置请求超时 | 批次大小不等于 API 请求数，也不是处理速度保证 |
| 目录与文件处理 | 支持部分目录递归查询、文件分片上传、导入导出任务轮询 | 递归与文件处理能力因操作而异，见操作参考 |

参数、输入输出及限制见[进阶指南](./docs/zh-CN/advanced.md)。

<a id="resources"></a>

## 功能范围

| 资源 | 可以处理的内容 | 操作数 |
| --- | --- | ---: |
| [知识库](./docs/zh-CN/operations.md#wiki_spaces) | 知识空间、成员、页面节点及层级 | 13 |
| [群组管理](./docs/zh-CN/operations.md#chat) | 群信息、成员及管理员 | 12 |
| [通讯录](./docs/zh-CN/operations.md#user) | 用户查询、部门及直属用户 | 6 |
| [组织架构](./docs/zh-CN/operations.md#directory) | 员工信息查询、筛选与更新 | 4 |
| [任务](./docs/zh-CN/operations.md#task) | 任务及任务成员 | 6 |
| [云文档](./docs/zh-CN/operations.md#doc) | 文档内容、文本及内容块 | 11 |
| [多维表格](./docs/zh-CN/operations.md#bitable) | 表格、视图、字段与记录 | 34 |
| [消息](./docs/zh-CN/operations.md#message) | 消息、卡片、图片及文件 | 22 |
| [日历](./docs/zh-CN/operations.md#calendar) | 日历、日程、参与人及会议群 | 16 |
| [Aily](./docs/zh-CN/operations.md#aily) | Aily 技能调用与文件 | 5 |
| [云空间](./docs/zh-CN/operations.md#space) | 文件夹、文件、素材及导入导出 | 18 |

完整清单共 **147 项操作**，包含调用多个接口的封装操作，不代表 147 个独立 API 接口。

<a id="guides"></a>

## 详细指南

- [入门指南](./docs/zh-CN/getting-started.md)：安装、凭证、权限、首个工作流。
- [操作参考](./docs/zh-CN/operations.md)：完整操作名称、自动分页支持和已确认的凭证限制。
- [进阶指南](./docs/zh-CN/advanced.md)：事件接入、同步响应、字段映射、Upsert、批次及常见问题。
- [更新记录](./CHANGELOG.md)：版本变化。

需要修改源码时，可从 [package.json](./package.json) 中的 `dev`、`build`、`lint` 脚本以及 [CI 配置](./.github/workflows/ci.yml) 了解开发和检查入口。兼容性说明见[入门指南](./docs/zh-CN/getting-started.md#compatibility)。

## 致谢、许可证与支持

本项目基于 [n8n-nodes-feishu-lite](https://github.com/other-blowsnow/n8n-nodes-feishu-lite) 二次开发，感谢原作者的开源贡献。

使用 [MIT 许可证](./LICENSE.md)。如遇问题，请提交 [Issue](https://github.com/luka-n8n-nodes/n8n-nodes-feishu/issues)，或联系 [luka.cat.mimi@gmail.com](mailto:luka.cat.mimi@gmail.com)。反馈时请附上节点包版本、n8n 版本、操作名称和已脱敏的错误信息。
