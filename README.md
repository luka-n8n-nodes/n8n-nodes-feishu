# @luka-cat-mimi/n8n-nodes-feishu

**English** | [简体中文](./README.zh-CN.md)

Feishu / Lark community nodes for n8n. The package covers 140+ Open Platform APIs, WebSocket and Webhook triggers, Bitable helpers (field mapping, conditions, upsert), and Send and Wait.

This project is based on [n8n-nodes-feishu-lite](https://github.com/other-blowsnow/n8n-nodes-feishu-lite).

## Install

See the [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Package name: `@luka-cat-mimi/n8n-nodes-feishu`

Requires Node.js 22.22 or later.

## Credentials

- **Feishu Tenant API**: App ID and App Secret. The node fetches a tenant access token automatically.
- **Feishu OAuth2 API**: User-level OAuth2 (PKCE). Include `offline_access` when you need refresh tokens.

Choose China (`https://open.feishu.cn`) or International (`https://open.larksuite.com`) as the base URL.

## Nodes

- **Feishu**: Resource/operation node for messages, chats, contacts, directory, tasks, documents, Bitable, calendar, Aily, Drive, and wiki.
- **Feishu Trigger**: Long-lived WebSocket event subscription. Feishu allows only one running trigger per app.
- **Feishu Webhook Trigger**: HTTP callbacks with URL verification and optional payload decryption. Paste the generated URL into the Feishu developer console.
- **Respond to Feishu**: Synchronous response for card actions and link previews. Use it with either trigger. The built-in Respond to Webhook node does not work with these triggers.

## Send and Wait

Message → Send and Wait for Response pauses the workflow until a user clicks Approve/Reject or submits free text. The card opens the n8n resume URL in a Feishu sidebar, so the webhook URL must be reachable from the Feishu client. If the wait expires, the workflow continues and the card buttons are not updated.

## v1 to v2 migration

v2 is an n8n-verification-oriented release:

- Node and credential UI are English only.
- Document IDs (App Token, Folder Token, File Token, and similar) are plain-text fields, not password fields. Expression names are `app_id`, `folder_id`, `file_id`, `doc_id`, `node_id`, and `idempotency_key`. Re-select those fields after upgrading existing workflows. v1 used `app_toke` / `folder_toke` / `client_toke`.
- Node versions: Feishu `2`, Feishu Webhook Trigger `2`, Respond to Feishu `2`. Internal node type names are unchanged (`feishuNode`, `feishuNodeTrigger`, `feishuWebhookTrigger`, `respondToFeishu`).
- OAuth2 credential type name is now `feishuNodeOAuth2Api`. Recreate the OAuth2 credential if an existing workflow still references `feishuNodeOauth2Api`.
- Runtime npm dependencies were removed. The WebSocket trigger uses the Node.js built-in WebSocket API.

## Features

### Triggers

- Subscribe to all events or a specific list
- Immediate response, or a synchronous response through Respond to Feishu (3s timeout on the WebSocket path)

### Resources

- Wiki (13)
- Chat (12)
- Contact (6)
- Directory (4)
- Task (6)
- Document (11)
- Bitable (34), including upsert, insert, update rows, and if-row-exists branches
- Message (23), including Send and Wait
- Calendar (16)
- Aily (5)
- Drive (18)

Most list operations support Return All, Limit, batching, and timeout options.

### Directory

- Update employee information, including localized names and workstations
- Batch get employee information with selectable query fields
- List employees with filters, selectable query fields, and Return All
- Search employees with selectable query fields and Return All

## Development

```bash
npm install
npm run lint
npm run build
npm test
npm run dev
```

## License

MIT

## Issues

Report bugs or request features via [GitHub Issues](https://github.com/luka-n8n-nodes/n8n-nodes-feishu/issues).
