# Feishu × n8n automation nodes

[简体中文](./README.md) | **English**

Connect Feishu to n8n to automate notifications, table updates, documents, and calendars. Start workflows from Feishu events, or read and update Feishu data within a workflow. The package covers **11 resources and 140+ operations**.

Package: `@luka-cat-mimi/n8n-nodes-feishu`. These are community-maintained nodes that you install in n8n.

[Use cases](#use-cases) · [Choose a node](#nodes) · [Get started](#start) · [Highlights](#features) · [Resources](#resources) · [Guides](#guides)

<a id="use-cases"></a>

## What can you build?

These are workflow ideas you can assemble by configuring nodes, credentials, and permissions:

| Goal | Example workflow |
| --- | --- |
| Remind a team about outstanding tasks | Schedule → Find pending Bitable records → Send a Feishu group message |
| Sync business data into a table | Receive business data → Match an order number → Update an existing record or create one (Upsert) |
| Organize incoming information | Receive a Feishu message → Extract relevant content → Create a document or task |

<a id="nodes"></a>

## Choose a node

The package provides four node types. **Select Resource and Operation inside the 「飞书」 node to send messages, work with tables, and perform other actions.** You do not install each operation separately. Chinese labels below match the node UI.

| Node label in the UI | Purpose | When to use it |
| --- | --- | --- |
| 飞书 (Feishu) | Perform a Feishu operation within a workflow | Send messages, query tables, create documents, and more |
| 飞书 Trigger | Receive events over a persistent WebSocket connection | Use Feishu's persistent-connection subscription mode without a public callback URL |
| 飞书 Webhook Trigger | Receive events at a callback URL | Use server callbacks with an address reachable by Feishu |
| 飞书响应 (Feishu Response) | Return a result for the current event or callback | Respond synchronously to interactions such as card actions; use the Feishu node to send chat messages |

Both triggers require event subscriptions in the Feishu developer console. By default, the node does not filter incoming event types; **it does not subscribe to all events in the console for you**. See [event setup](./docs/en/advanced.md#triggers).

<a id="start"></a>

## Get started

1. **Install the package**: On self-hosted n8n, enter `@luka-cat-mimi/n8n-nodes-feishu` under `Settings → Community nodes → Install`. Installation requires administrator access. See [installation](./docs/en/getting-started.md#installation) for alternatives and Cloud conditions.
2. **Connect a Feishu app**: Create an app, grant the required permissions, and configure credentials in n8n. The first-workflow example uses app-level credentials; see [credential choices](./docs/en/getting-started.md#credentials).
3. **Run your first workflow**: Follow [send a group message](./docs/en/getting-started.md#first-workflow) to build “Manual Trigger → Feishu text message.” It includes finding a chat ID, entering parameters, and checking the result.

Successful authentication does not grant access to every resource. Documents and tables also require the relevant API permissions and resource access. An organization administrator may need to help with app setup and approval.

<a id="features"></a>

## Highlights

| Feature | What it helps with | Boundaries |
| --- | --- | --- |
| Enhanced Bitable operations | Map fields visually; query or delete by conditions, update by record ID, or upsert | Upsert updates only the first match when multiple records match; use a business-unique field |
| Automatic pagination (Return All) | Retrieve all matching results without managing page tokens | Supported by selected operations, off by default, and limited to the current identity's access |
| Two ways to receive events | Start workflows through WebSocket or Webhook | Console setup, network requirements, and response behavior differ |
| Batching and timeouts | Control how input items are scheduled and set request timeouts on supported operations | Batch size is not an API request count or a throughput guarantee |
| Directory and file handling | Recursive queries on selected directories, multipart uploads, and import/export task polling | Capabilities depend on the operation; check the reference |

See the [advanced guide](./docs/en/advanced.md) for parameters, inputs, outputs, and limitations.

<a id="resources"></a>

## Resource coverage

| Resource | What you can work with | Operations |
| --- | --- | ---: |
| [Wiki](./docs/en/operations.md#wiki_spaces) | Spaces, members, page nodes, and hierarchies | 13 |
| [Chat management](./docs/en/operations.md#chat) | Chat details, members, and administrators | 12 |
| [Contacts](./docs/en/operations.md#user) | Users, departments, and direct department members | 6 |
| [Directory](./docs/en/operations.md#directory) | Employee lookup, filtering, and updates | 4 |
| [Tasks](./docs/en/operations.md#task) | Tasks and task members | 6 |
| [Documents](./docs/en/operations.md#doc) | Document content, text, and blocks | 11 |
| [Bitable](./docs/en/operations.md#bitable) | Apps, tables, views, fields, and records | 34 |
| [Messages](./docs/en/operations.md#message) | Messages, cards, images, and files | 22 |
| [Calendar](./docs/en/operations.md#calendar) | Calendars, events, attendees, and meeting chats | 16 |
| [Aily](./docs/en/operations.md#aily) | Aily skills and files | 5 |
| [Drive](./docs/en/operations.md#space) | Folders, files, media, imports, and exports | 18 |

The full catalogue contains **147 operations**, including composed operations that call multiple APIs. This is not a count of distinct API endpoints.

<a id="guides"></a>

## Detailed guides

- [Getting started](./docs/en/getting-started.md): Installation, credentials, permissions, and a first workflow.
- [Operation reference](./docs/en/operations.md): All operation labels, pagination support, and confirmed credential restrictions.
- [Advanced guide](./docs/en/advanced.md): Events, synchronous responses, field mapping, Upsert, batching, and troubleshooting.
- [Changelog](./CHANGELOG.md): Version history.

For source development, start with the `dev`, `build`, and `lint` scripts in [package.json](./package.json) and the [CI configuration](./.github/workflows/ci.yml). See [compatibility notes](./docs/en/getting-started.md#compatibility) before choosing an environment.

## Credits, license, and support

This project builds on [n8n-nodes-feishu-lite](https://github.com/other-blowsnow/n8n-nodes-feishu-lite). Thank you to the original author for the open-source contribution.

Licensed under [MIT](./LICENSE.md). [Report an issue](https://github.com/luka-n8n-nodes/n8n-nodes-feishu/issues) or email [luka.cat.mimi@gmail.com](mailto:luka.cat.mimi@gmail.com). Include the package version, n8n version, operation name, and sanitized error details.
