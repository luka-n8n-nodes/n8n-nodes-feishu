# 入门指南

[English](../en/getting-started.md) · [首页](../../README.md) · [操作参考](./operations.md) · [进阶指南](./advanced.md)

本指南带你完成一个可观察结果的流程：**手动触发 → 发送一条飞书群消息**。不需要编写代码；需要有权安装 n8n 社区节点、配置飞书应用，必要时请组织管理员协助。

[安装](#installation) · [凭证选择](#credentials) · [首个工作流](#first-workflow) · [兼容性](#compatibility)

<a id="installation"></a>

## 1. 安装节点包

| 使用环境 | 安装方式 |
| --- | --- |
| 自托管 n8n | 实例所有者或管理员在 `Settings → Community nodes → Install` 输入下方包名，确认社区包提示后安装 |
| 无法通过界面安装的自托管环境 | 由实例维护者按 n8n 官方手动安装指南操作；容器、队列部署等也需遵循对应部署说明 |
| n8n Cloud | 只能安装平台提供的已验证社区节点；不能直接按任意 npm 包名安装。本项目文档不承诺本包已通过验证，以你的节点面板中是否提供安装入口为准 |

```text
@luka-cat-mimi/n8n-nodes-feishu
```

安装后，在工作流的添加节点面板搜索「飞书」，确认能找到「飞书」「飞书 Trigger」「飞书 Webhook Trigger」「飞书响应」。

参考：[n8n 社区节点安装](https://docs.n8n.io/integrations/community-nodes/installation/)、[界面安装](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/)、[手动安装](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation/)。

<a id="credentials"></a>

## 2. 选择凭证并授权

凭证决定工作流“以谁的身份”访问飞书；业务权限和资源授权决定该身份“能做什么”。

| 选项 | 身份与配置 | 适用情况 |
| --- | --- | --- |
| 应用级别凭证 | 使用应用的 App ID 和 App Secret；凭证界面名为「飞书租户维度 API」 | 本指南的机器人发消息示例；两个飞书触发器也使用此凭证 |
| 用户级别凭证 | 使用应用信息，通过 OAuth 2.0 由具体用户授权；凭证界面名为「飞书个人用户维度 OAuth2 API」 | 需要用户身份的操作，例如「搜索用户」「搜索云文档」 |

「飞书」主节点提供两种选择，但并非每项操作都支持两种身份。先确认[操作参考](./operations.md)中的已知限制，再查看对应接口要求。

### 配置应用凭证（本示例使用）

1. 进入[飞书开发者后台](https://open.feishu.cn/app)，创建或选择一个企业自建应用。
2. 在应用能力中启用机器人。为本示例开通**以应用的身份发消息**（`im:message:send_as_bot`），以及获取群列表所需的**查看群信息**（`im:chat:read`）。权限要求以[发送消息](https://open.feishu.cn/document/server-docs/im-v1/message/create)和[获取群列表](https://open.feishu.cn/document/server-docs/group/chat/list)接口页面为准。
3. 按后台要求创建版本、发布并完成组织审批，使新增能力和权限生效；将自己包含在应用可用范围中。
4. 在应用的「凭证与基础信息」中找到 App ID 与 App Secret。
5. 在 n8n 的「飞书」节点选择 `凭证类型 → 应用级别凭证`，新建「飞书租户维度 API」凭证。`Base URL` 选飞书地址 `https://open.feishu.cn`，将 App ID 填入 `Appid`、App Secret 填入 `AppSecret`，保存并检查连接结果。

凭证提供飞书、Larksuite 和自定义 Base URL 选项。本指南使用飞书环境；地址必须与应用所属平台一致，这些选项不代表所有功能都已在每个平台验证。

### 何时配置用户凭证

若使用「搜索用户」「搜索云文档」等用户身份操作：

1. 在「飞书」节点选择 `用户级别凭证`，新建「飞书个人用户维度 OAuth2 API」。选择匹配的 Base URL，填写应用的 Client ID（App ID）和 Client Secret（App Secret）。
2. 从 n8n 凭证窗口复制 OAuth Redirect URL，将其加入飞书应用的重定向 URL 配置。
3. 在飞书后台申请所需的用户身份权限，并按要求发布和审批。n8n 的「权限范围」填写对应权限标识，以英文逗号分隔；默认的 `offline_access` 用于离线访问授权，**不提供读写文档、表格等业务权限**。
4. 在凭证窗口发起连接，登录需要执行操作的飞书账号并完成授权。若后续增加权限，重新完成授权。

OAuth 权限与重定向配置参考[飞书获取授权码说明](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code)。不要把 App Secret 或访问令牌填到消息正文、工作流示例或 Issue 中。

### 认证成功后仍需检查什么

- **接口权限**：应用是否已开通本次操作所需权限，发布和审批是否生效。
- **资源权限**：当前身份是否能访问目标文档、表格或文件夹。使用应用身份访问文档时，需要按该资源的授权方式将应用添加为协作者；具体角色要允许本次读写操作。
- **业务条件**：机器人是否已加入目标群、是否有发言权限，用户是否在应用可用范围内。

<a id="first-workflow"></a>

## 3. 发送第一条群消息

### 准备一个测试群

创建或选择一个内部测试群，在群设置的机器人入口添加上一步应用对应的机器人。这里使用的是**应用机器人**，不是只有 Webhook 地址的群自定义机器人。确保你可以添加机器人，并且机器人能在群内发言。

### 先获取群 ID

1. 新建工作流，添加 `Manual Trigger`（手动触发），连接一个「飞书」节点。
2. 选择刚配置的应用级别凭证，`Resource` 选择 `群组管理`，`Operation` 选择 `获取用户或机器人所在的群列表`。
3. 开启 `Return All`，执行工作流。在该节点的输出中，按 `name` 找到测试群，复制同一条数据的 `chat_id`（通常以 `oc_` 开头）。这是群 ID，不是群名称或群邀请链接。
4. 若没有找到群，先确认加入的是同一个应用的机器人，以及凭证和群列表权限配置正确。

### 将查询节点改为发送消息

保留 `Manual Trigger → 飞书` 两个节点，把刚才的「飞书」节点切换到以下配置。**将复制的一个群 ID 直接填入参数**，不要把整个群列表接到发送节点。

| 参数（界面名称） | 填写内容 |
| --- | --- |
| 凭证类型 | 应用级别凭证，选择之前保存的凭证 |
| Resource | 消息 |
| Operation | 发送消息 |
| 用户ID类型 | `Chat ID`（虽然字段名是用户 ID 类型，此处选择群 ID） |
| 消息接收者的 ID | 刚复制的测试群 `chat_id` |
| 消息类型 | 文本 |
| 文本内容 | `你好，这是一条来自 n8n 的测试消息。` |
| UUID、Options | 本次保留默认值即可 |

执行一次工作流，检查两个结果：

- 测试群收到上述文本消息，发送者是应用机器人。
- 「飞书」节点执行成功，输出中可查看 `message_id` 等消息信息。

文本内容直接填写文字，无需手写 JSON。每次再次执行都会发起发送请求；若需要定时通知，完成测试后再把手动触发替换为定时触发，并配置实际筛选条件。

### 如果没有成功

| 现象 | 优先检查 |
| --- | --- |
| 无法安装或找不到节点 | 安装权限、实例是否允许社区节点、包名和安装结果；Cloud 是否提供该包 |
| 凭证连接失败 | App ID、App Secret 是否属于同一个应用，Base URL 是否正确 |
| 提示缺少权限 | 对应权限是否已开通并发布生效；查看返回的错误码和权限提示 |
| 群列表为空或发消息失败 | 应用机器人是否加入测试群，`Chat ID` 是否与复制的 `chat_id` 匹配，群是否限制机器人发言 |

其他问题见[排查指南](./advanced.md#troubleshooting)。可以到[飞书开放平台搜索](https://open.feishu.cn/search)查询原始错误码。

<a id="compatibility"></a>

## 兼容性与下一步

当前仓库的 `package.json` 声明 Node.js `>=20.15`，`n8n-workflow` peer dependency 为 `*`。这不等于已经验证所有 n8n 版本；仓库尚未列出完整的 n8n 运行版本测试矩阵。实际部署还需满足所选 n8n 版本自身的运行要求。

- 查看[操作参考](./operations.md)，按业务选择下一个功能。
- 想由飞书事件自动启动工作流，继续阅读[事件接入](./advanced.md#triggers)。
- 想同步多维表格数据，阅读[字段映射与 Upsert](./advanced.md#bitable)。
- 升级前查看[更新记录](../../CHANGELOG.md)，先在测试工作流中验证所用操作。
