# Getting started

[简体中文](../zh-CN/getting-started.md) · [Home](../../README.en.md) · [Operation reference](./operations.md) · [Advanced guide](./advanced.md)

Build a workflow with an observable result: **Manual Trigger → Send a Feishu group message**. No code is required. You need permission to install n8n community nodes and configure a Feishu app; an organization administrator may need to help.

[Installation](#installation) · [Credentials](#credentials) · [First workflow](#first-workflow) · [Compatibility](#compatibility)

<a id="installation"></a>

## 1. Install the package

| Environment | Installation route |
| --- | --- |
| Self-hosted n8n | An instance owner or administrator opens `Settings → Community nodes → Install`, enters the package name below, acknowledges the community-package notice, and installs it |
| Self-hosted without GUI installation | Ask the instance maintainer to follow n8n's manual installation guide, including the instructions applicable to containers or queue deployments |
| n8n Cloud | Only verified community nodes offered by the platform can be installed; arbitrary npm packages cannot be installed by name. This guide does not claim this package is verified. Check whether your node panel offers it for installation |

```text
@luka-cat-mimi/n8n-nodes-feishu
```

After installation, search for 「飞书」 in the add-node panel. Check that you can find 「飞书」, 「飞书 Trigger」, 「飞书 Webhook Trigger」, and 「飞书响应」.

References: [n8n community node installation](https://docs.n8n.io/integrations/community-nodes/installation/), [GUI installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/), and [manual installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation/).

<a id="credentials"></a>

## 2. Choose credentials and grant access

Credentials determine **whose identity** the workflow uses. API permissions and resource access determine **what that identity can do**.

| Choice in the UI | Identity and setup | When to use it |
| --- | --- | --- |
| 应用级别凭证 (app-level credentials) | App ID and App Secret; credential label: 飞书租户维度 API | The bot message example below; both Feishu triggers also use these credentials |
| 用户级别凭证 (user-level credentials) | App details plus OAuth 2.0 consent from a specific user; credential label: 飞书个人用户维度 OAuth2 API | Operations that require user identity, including 搜索用户 (Search users) and 搜索云文档 (Search cloud documents) |

The main Feishu node offers both choices, but not every operation supports both identities. Check the [operation reference](./operations.md) and the corresponding API requirements.

### Configure app credentials for this example

1. Open the [Feishu developer console](https://open.feishu.cn/app) and create or select an enterprise custom app.
2. Enable the bot capability. For this example, grant **Send messages as an app** (`im:message:send_as_bot`) and **View chat information** (`im:chat:read`) for listing chats. Consult the permission requirements for [Send message](https://open.feishu.cn/document/server-docs/im-v1/message/create) and [List chats](https://open.feishu.cn/document/server-docs/group/chat/list).
3. Create and publish an app version and complete organization approval as required by the console, so the capabilities and permissions take effect. Include yourself in the app's availability scope.
4. Find the App ID and App Secret on the app's credentials/basic information page.
5. In the n8n 「飞书」 node, choose `凭证类型 → 应用级别凭证` and create a 「飞书租户维度 API」 credential. Select `https://open.feishu.cn` as the Base URL, enter the App ID in `Appid` and App Secret in `AppSecret`, save, and check the connection result.

The credentials offer Feishu, Larksuite, and custom Base URLs. This guide uses Feishu. Match the URL to the app's platform; the presence of an option does not mean every feature has been tested on that platform.

### Configure user credentials when needed

For user-identity operations such as Search users or Search cloud documents:

1. Select `用户级别凭证` in the Feishu node and create a 「飞书个人用户维度 OAuth2 API」 credential. Choose the matching Base URL and enter the app's Client ID (App ID) and Client Secret (App Secret).
2. Copy the OAuth Redirect URL from the n8n credential window into the Feishu app's redirect URL configuration.
3. Request the required user-identity permissions in the Feishu console and complete publication and approval where required. Enter the corresponding scope identifiers in `权限范围`, separated by commas. The default `offline_access` scope is for offline access; **it does not grant business permissions to read or write documents or tables**.
4. Start the connection from the credential window, sign in as the intended Feishu user, and authorize access. Reauthorize after adding scopes.

See [Feishu's authorization-code guide](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code). Keep App Secrets and access tokens out of message bodies, example workflows, and issues.

### Authentication succeeds: what else is needed?

- **API permissions**: The app needs the operation's permissions, with publication and approval completed as required.
- **Resource access**: The identity must be allowed to access the target document, table, or folder. For app-based document access, add the app as a collaborator through the resource's sharing mechanism, with a role that permits the intended action.
- **Business conditions**: The bot must belong to the target chat and be allowed to send messages; users must be within the app's availability scope where required.

<a id="first-workflow"></a>

## 3. Send your first group message

### Prepare a test chat

Create or choose an internal test chat. Use the chat's bot settings to add the app's bot. This is an **app bot**, not a custom group bot represented only by a Webhook URL. You need permission to add it, and the bot must be allowed to speak in the chat.

### Find the chat ID first

1. Create a workflow with `Manual Trigger` connected to one 「飞书」 node.
2. Select your saved app-level credential. Choose `群组管理` (Chat management) as Resource and `获取用户或机器人所在的群列表` (List chats the user or bot belongs to) as Operation.
3. Turn on `Return All` and execute the workflow. Find your test chat by `name` in the output and copy its `chat_id`, usually starting with `oc_`. Use the ID, not the chat name or invitation link.
4. If the chat is missing, verify that you added the bot from this same app and configured the correct credentials and chat-list permissions.

### Change the query node to send a message

Keep the two-node workflow `Manual Trigger → 飞书`. Change the existing Feishu node to the settings below. **Paste one copied chat ID as a fixed value**; do not connect the entire chat-list output to a sending node.

| Parameter (actual UI label) | Value |
| --- | --- |
| 凭证类型 | 应用级别凭证; select the saved credential |
| Resource | 消息 (Messages) |
| Operation | 发送消息 (Send message) |
| 用户ID类型 | `Chat ID` (the field says “user ID type,” but select the chat type here) |
| 消息接收者的 ID | The copied test chat's `chat_id` |
| 消息类型 | 文本 (Text) |
| 文本内容 | `Hello, this is a test message from n8n.` |
| UUID, Options | Leave at their defaults for this example |

Execute the workflow once and check both results:

- The app bot posts the text in the test chat.
- The Feishu node succeeds and its output includes message details such as `message_id`.

Enter plain text; there is no need to write JSON. Each subsequent execution makes another send request. For scheduled notifications, replace Manual Trigger with a schedule only after testing and configuring your actual filters.

### If it does not work

| Symptom | Check first |
| --- | --- |
| Installation fails or nodes are missing | Installation permission, whether the instance allows community nodes, the package name, and installation result; on Cloud, whether the package is offered |
| Credential connection fails | App ID and App Secret belong to the same app, and the Base URL matches |
| Missing-permission error | Required permissions are granted and published; inspect the returned error code and permission hints |
| Empty chat list or message failure | The app bot is in the test chat, `Chat ID` matches the copied `chat_id`, and the bot is allowed to send messages |

See [troubleshooting](./advanced.md#troubleshooting) for other cases. Look up original error codes in [Feishu's documentation search](https://open.feishu.cn/search).

<a id="compatibility"></a>

## Compatibility and next steps

The repository's `package.json` declares Node.js `>=20.15` and a `n8n-workflow` peer dependency of `*`. This does not mean every n8n version has been tested; the repository does not publish a complete n8n runtime compatibility matrix. Your deployment must also meet the requirements of its chosen n8n version.

- Find your next operation in the [reference](./operations.md).
- To start workflows from Feishu events, read [event setup](./advanced.md#triggers).
- To sync Bitable data, read [field mapping and Upsert](./advanced.md#bitable).
- Before upgrading, review the [changelog](../../CHANGELOG.md) and verify your operations in a test workflow.
