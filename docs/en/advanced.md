# Advanced guide

[简体中文](../zh-CN/advanced.md) · [Home](../../README.en.md) · [Getting started](./getting-started.md) · [Operation reference](./operations.md)

[Events](#triggers) · [Synchronous responses](#responses) · [Inputs and outputs](#data) · [Bitable](#bitable) · [Pagination](#pagination) · [Batching and timeouts](#batching) · [Troubleshooting](#troubleshooting)

<a id="triggers"></a>

## Events: WebSocket or Webhook?

An event is a notification that something happened in Feishu, such as a user sending a message. A trigger receives it and starts a workflow.

| Aspect | 飞书 Trigger | 飞书 Webhook Trigger |
| --- | --- | --- |
| Connection | n8n opens a persistent WebSocket connection | Feishu sends HTTP requests to an n8n callback URL |
| Network requirement | n8n can reach Feishu; no public callback URL is needed | Feishu must be able to reach the callback URL |
| Feishu console mode | Receive events through a persistent connection | Send events/callbacks to a developer server |
| Credentials | App-level | App-level |
| Typical fit | An enterprise custom app without callback URL setup | An accessible callback service or server-callback integration |

Feishu's persistent-connection mode supports enterprise custom apps. An app can establish multiple connections, but each event is delivered to only one client, **not broadcast to all clients**. Prefer one receiving entry point per app and route events downstream. Separate triggers with different filters are not guaranteed to receive their intended events. Test and production connections can also split deliveries. See [Feishu's persistent-connection guide](https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-).

The current node UI may still say that only one Trigger can run per app. Use the delivery behavior and single-entry recommendation above; do not interpret that notice as a platform limit of one connection.

### Console subscriptions and node filters are separate

1. Add the required events or callbacks in the Feishu developer console, grant their permissions, and publish as required.
2. Select event types in the n8n trigger. The default “all events” selection means no type filtering on received events; it does not change the console subscription list.

Check whether Feishu is sending the event before investigating node filters. Selecting all events neither expands permissions nor creates missing subscriptions.

### Set up a persistent connection

1. Add 「飞书 Trigger」 in n8n, choose app credentials and the desired event types. Start with `Immediately` for ordinary notifications.
2. Start test listening to establish a connection. In Feishu, select persistent-connection subscriptions, save, and add the required events and permissions.
3. Cause the event in Feishu and inspect the n8n output. Stop test listening when finished, then activate or publish the workflow for production (the wording depends on your n8n version).

If this app already has a production connection, account for split delivery when testing; a separate test app avoids that overlap.

### Set up Webhook

1. Add 「飞书 Webhook Trigger」 and select app credentials. For tests, start listening before copying the generated Test URL. For production, use the Production URL with the workflow running in production.
2. Configure that URL for server callbacks in Feishu. The test URL is only available while test listening is active; it is not a permanent production endpoint.
3. If encrypted delivery is enabled in Feishu, enter the matching `Encrypt Key`. The node cannot decrypt an encrypted request without it.
4. To validate the Verification Token, enable 「验证应用标识」 and enter `Verification Token`. Despite the UI wording, this switch controls Token validation and is off by default. Matching an ordinary event's `app_id` to the credential app is a separate check.
5. When saving the callback configuration, the node handles `url_verification` by returning the `challenge` without starting the business workflow. Add the required events/callbacks and permissions, then test a real event.

An ordinary event with a mismatched app ID or filtered event type is acknowledged without starting the workflow. HTTP 200 alone does not prove that execution started. Configure proxies and public addresses according to your n8n deployment. See [Feishu's server callback guide](https://open.feishu.cn/document/event-subscription-guide/callback-subscription/step-1-choose-a-subscription-mode/send-callbacks-to-developers-server).

<a id="responses"></a>

## Synchronous responses versus chat messages

- **Send a message**: Use `消息 → 发送消息` in the Feishu node to send chat content to a person or group.
- **Respond synchronously**: Use 「飞书响应」 to return a result for the current event or callback, such as a card-interaction notification. It does not send chat messages.

| Trigger response mode | Behavior |
| --- | --- |
| Immediately | Acknowledge receipt promptly without waiting for workflow processing; suitable for ordinary notifications |
| Using '飞书响应' Node | Use when a custom synchronous result is needed, and connect a Feishu Response node in the workflow |

In the response node, `同步响应模式` must match the trigger: choose 「长链接同步响应」 for WebSocket or 「Webhook 同步响应」 for Webhook. Use this package's response node with this package's Webhook trigger.

`响应内容` supports `No Data` and `JSON`. In the current implementation, `No Data` returns an empty object `{}`. `JSON` returns your object, which must match the relevant Feishu callback schema. With multiple input items, **only the first item's response is sent to Feishu**. By default the node outputs response data. Enabling 「启用响应输出分支」 provides separate original-input and response outputs.

For WebSocket, only `card.action.trigger`, `url.preview.get`, and `profile.view.get` enter the custom-response wait path, with a fixed **3-second** timeout. A timeout or error logs a warning and returns an empty object. Ordinary events do not wait for a response node. Webhook callbacks must meet the relevant Feishu callback deadline; do not assume they can wait indefinitely. Put the synchronous result on a quick path and perform slow work after responding or in a separate workflow.

<a id="data"></a>

## Inputs and outputs

n8n passes items between nodes, typically containing `json` and, for files, potentially `binary`. Parameters can be fixed values or n8n expressions referencing upstream data.

| Case | Current output behavior |
| --- | --- |
| Ordinary API operations | Usually return the API's `data` rather than the full `code / msg / data` envelope; an operation may also split lists or transform the result |
| WebSocket trigger | Event fields are flattened to the top level; read the type with `{{$json.event_type}}` |
| Webhook trigger | Returns the decrypted original event structure: type is at `{{$json.header.event_type}}` for 2.0 or `{{$json.event.type}}` for 1.0 |
| Bitable Get row(s) | Returns records by default; enabling 「转换数据」 changes field-value representations, so review downstream mappings |
| Uploads/downloads | Read or produce Binary data as configured by the operation; inspect the actual field names |

When switching trigger types, review expression paths. Execute once and use the actual Output to build mappings. Most operations run per input item; a list query can produce multiple items and cause a downstream message sender to run multiple times. Insert row / Update row(s) aggregate inputs for batch writes, so input counts are not API request counts.

<a id="bitable"></a>

## Bitable: field mapping and enhanced operations

A record is a row; a field is a column. Use `解析多维表格地址` (Parse a Bitable URL) to extract `app_token` and `table_id`, then fill 「多维表格 App 的唯一标识」 and 「多维表格数据表的唯一标识」. If the URL has no table ID, select a specific table and copy its URL, or use List tables.

### Choose an operation

| Goal | Operation (UI label) | Key behavior |
| --- | --- | --- |
| Read matching records | 多维表格 - Get row(s) | Match conditions, sorting, field selection, Return All, and output conversion |
| Add records | 多维表格 - Insert row | Map Values to Insert; supports batch writes across input items |
| Update known records | 多维表格 - Update row(s) | Requires Record ID and Values to Update; query first if you need to find record IDs by conditions |
| Update a match or create a record | 多维表格 - Upsert row(s) | Define Match conditions and Values to Upsert |
| Delete matching records | 多维表格 - Delete row(s) | Find and delete matches; query first to confirm the filter's scope |
| Continue only if a record exists/does not exist | 多维表格 - If row exists / If row does not exist | Pass through the original input when the condition holds; otherwise output nothing. These are not two-output true/false IF nodes |
| Create a table visually | 多维表格 - Create a Data Table | Configure initial field types and properties |

If you already have parameters or JSON matching the Feishu API, use basic operations such as 新增记录, 更新记录, or 批量新增记录. For mapping columns to values in the UI, start with the enhanced operations above.

### Map fields and conditions

- **Resource Mapper**: In Values to Insert / Update / Upsert, map each target field to a fixed value or upstream data. The field list is loaded from the table's metadata.
- **Auto Map**: Use when upstream field names match table field names; still check types. Attachment fields take upstream Binary property names such as `data`, not local file paths. Separate multiple Binary names with commas.
- **Match / Must Match**: Choose Column Name or ID, Condition, and Value. Operators depend on field type. Under Combine Conditions, Any Condition means at least one condition, and All Conditions means every condition. Select All Conditions when using several fields together to identify a record.

### Upsert boundaries

For example, match order number `A-001` and set its status to “shipped”: a match is updated, while no match creates a record. Configure matching conditions and at least one valid write field. **Matching conditions do not automatically become fields in the new record**; include the order number in Values to Upsert if a new record needs it.

When several records match, only the first record returned by the API is updated. Use a business-unique field and resolve existing duplicates first. This is a search-then-update-or-create operation, not a database uniqueness constraint; concurrent work on the same business key can still create duplicates.

Output adds `_upsert_action` (`update` or `insert`) and `_upsert_matched_count` (match count; `0` on insertion). The default batching behavior below is not a fixed rate of 10 API requests per second.

<a id="pagination"></a>

## Automatic pagination (Return All) and recursion

The [reference](./operations.md) marks all 26 operations with Return All, including 获取文件访问记录 (Get file access records) and 搜索云文档 (Search cloud documents).

- Off by default: use the operation's Limit to retrieve a limited number of results.
- When enabled: automatically paginate through all results allowed by the current identity and filters. Large results can require more requests and longer execution.
- **Recursion** descends into child departments, folders, or Wiki nodes. It is separate from paginating results at one level and must be configured on an operation that supports it. Return All alone does not enable recursive traversal.

<a id="batching"></a>

## Batching and timeouts

Configure these only on operations that expose them, usually under `Options`.

| Option | Meaning |
| --- | --- |
| Items per Batch | Number of input items whose processing starts in a batch, not an exact HTTP request count |
| Batch Interval (Ms) | Delay before starting the next batch; it does not wait for the previous batch to finish, so batches can overlap |
| Timeout | Request timeout in milliseconds, not the workflow execution deadline. `0` means this option sets no timeout limit; runtime limits can still apply |

Ordinary per-item operations generally run serially without Batching and enable concurrency when Batching is added. Operations such as Insert row / Update row(s) have their own batch implementations and do not follow that per-item model.

**Upsert is an exception: concurrency is enabled by default, starting batches of 10 input items 1000 milliseconds apart.** Each item can perform field lookups, record queries, attachment uploads, and writes. This is neither “10 API requests/second” nor a hard cap on total in-flight items. If rate-limited, reduce the batch size, increase the interval, and account for the actual API limits.

<a id="troubleshooting"></a>

## Troubleshooting

| Symptom | Where to look |
| --- | --- |
| Valid credentials but document/table operations fail | Check API scopes, publication/approval, and resource collaborator roles separately |
| Search users or Search cloud documents fails | Both require user credentials; confirm business scopes and the user's resource access |
| No trigger events | Check console subscriptions and permissions, listening/production state, node filters, network access, and competing persistent connections |
| Webhook validation or decryption fails | Is the test URL listening or production URL active? Do Encrypt Key and the optional Verification Token match? |
| Webhook returns success without execution | URL verification does not start a workflow; check app_id matching and event filtering |
| Card interaction has no response or WebSocket response times out | Match trigger/response modes, reach the WebSocket response node within 3 seconds, and move slow requests out of the response path |
| Bitable field list is empty | Check credentials, resource access, app_token, and table_id; reload fields after changing the table schema |
| Workflow stops after If row exists | No output is expected when its condition is not met |
| Upsert changes only one duplicate record | It updates the first match only; check conditions and business-key uniqueness |
| Duplicate notifications | Check upstream item count, repeated executions, and event redelivery; design deduplication around your business requirements |
| Many requests cause rate limiting | Reduce batch size and increase intervals; Return All, attachments, and composed operations can generate additional requests |

Keep the original error code, operation name, package version, and n8n version. Search [Feishu's documentation](https://open.feishu.cn/search) or [file a sanitized issue](https://github.com/luka-n8n-nodes/n8n-nodes-feishu/issues).
