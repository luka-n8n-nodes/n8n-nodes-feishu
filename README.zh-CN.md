# @luka-cat-mimi/n8n-nodes-feishu

[English](./README.md) | **简体中文**

飞书 / Lark 的 n8n 社区节点，支持 140+ 开放平台 API，涵盖 WebSocket 和 Webhook 触发器、多维表格增强操作（字段映射、条件匹配、Upsert），以及发送消息并等待回复。

本项目基于 [n8n-nodes-feishu-lite](https://github.com/other-blowsnow/n8n-nodes-feishu-lite) 开发。

## 安装

请参考 [n8n 社区节点安装指南](https://docs.n8n.io/integrations/community-nodes/installation/)。

包名：`@luka-cat-mimi/n8n-nodes-feishu`

需要 Node.js 22.22 或更高版本。

## 凭证

- **Feishu Tenant API**：使用 App ID 和 App Secret，节点会自动获取租户访问令牌。
- **Feishu OAuth2 API**：用户级 OAuth2 授权（PKCE）。需要刷新令牌时，请在授权范围中包含 `offline_access`。

基础 URL 可选择中国版（`https://open.feishu.cn`）或国际版（`https://open.larksuite.com`）。

## 节点

- **Feishu**：资源与操作节点，支持消息、群组、通讯录、任务、云文档、多维表格、日历、Aily、云空间和知识库。
- **Feishu Trigger**：通过 WebSocket 长连接订阅事件。飞书每个应用同时只允许一个触发器运行。
- **Feishu Webhook Trigger**：通过 HTTP 接收回调，支持 URL 验证及可选的推送内容解密。将生成的 URL 填入飞书开发者后台即可。
- **Respond to Feishu**：同步响应卡片交互和链接预览，可与上述任一触发器配合使用。n8n 内置的 Respond to Webhook 节点不适用于这些触发器。

## 发送消息并等待回复

选择 Message → Send and Wait for Response 后，工作流会暂停，直到用户点击 Approve/Reject 或提交文本回复。消息卡片会在飞书侧边栏打开 n8n 的恢复执行 URL，因此飞书客户端必须能够访问该 Webhook URL。等待超时后，工作流会继续执行，卡片按钮不会更新。

## 从 v1 迁移到 v2

v2 是面向 n8n 社区节点验证要求的版本：

- 节点和凭证界面仅提供英文。
- 文档标识（App Token、Folder Token、File Token 等）改为普通文本字段，不再作为密码字段。表达式字段名为 `app_id`、`folder_id`、`file_id`、`doc_id`、`node_id` 和 `idempotency_key`。升级已有工作流后，请重新选择这些字段。v1 使用的是 `app_toke` / `folder_toke` / `client_toke`。
- 节点版本：Feishu `2`、Feishu Webhook Trigger `2`、Respond to Feishu `2`。内部节点类型名保持不变（`feishuNode`、`feishuNodeTrigger`、`feishuWebhookTrigger`、`respondToFeishu`）。
- OAuth2 凭证类型名改为 `feishuNodeOAuth2Api`。如果已有工作流仍引用 `feishuNodeOauth2Api`，请重新创建 OAuth2 凭证。
- 已移除运行时 npm 依赖。WebSocket 触发器使用 Node.js 内置的 WebSocket API。

## 功能

### 触发器

- 订阅全部事件或指定的事件列表
- 立即响应，或通过 Respond to Feishu 节点同步响应（WebSocket 模式超时时间为 3 秒）

### 资源

- 知识库（13）
- 群组（12）
- 通讯录（6）
- 任务（6）
- 云文档（11）
- 多维表格（34），包括 Upsert、插入行、更新行和行存在性条件分支
- 消息（23），包括发送消息并等待回复
- 日历（16）
- Aily（5）
- 云空间（18）

大多数列表操作支持 Return All（获取全部）、Limit（数量限制）、批次管理和超时设置。

## 开发

```bash
npm install
npm run lint
npm run build
npm test
npm run dev
```

## 许可证

MIT

## 问题反馈

如需报告问题或提出功能建议，请前往本仓库的 [GitHub Issues](https://github.com/luka-n8n-nodes/n8n-nodes-feishu/issues)。
