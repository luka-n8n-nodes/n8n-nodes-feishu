# Operation reference

[简体中文](../zh-CN/operations.md) · [Home](../../README.en.md) · [Getting started](./getting-started.md) · [Advanced](./advanced.md)

In the **飞书** node, select **Resource**, then **Operation**. The tables preserve the actual UI labels and add English descriptions. There are 11 resources and 147 operations; the two triggers and response node are not included in this count.

**Reading the tables:** `✓` means the operation exposes Return All (26 operations, off by default). `—` means there is no such switch, not that only one record can be processed. Return All retrieves all results within the current permissions and filters. Enhanced or composed operations may call multiple APIs. See [pagination](./advanced.md#pagination) and [enhanced Bitable operations](./advanced.md#bitable).

**Credential restrictions:** Search users (搜索用户) and Search cloud documents (搜索云文档) require user-level credentials. Check the relevant API for supported identities, scopes, and resource access on other operations; an unmarked row does not guarantee support for both credential types. Both triggers use app credentials only. See [credential choices](./getting-started.md#credentials).

[Wiki](#wiki_spaces) · [Chat management](#chat) · [Contacts](#user) · [Directory](#directory) · [Tasks](#task) · [Documents](#doc) · [Bitable](#bitable) · [Messages](#message) · [Calendar](#calendar) · [Aily](#aily) · [Drive](#space)

<a id="wiki_spaces"></a>

## Wiki / 知识库 (13)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 获取知识空间列表 | List knowledge spaces | ✓ | — |
| 获取知识空间信息 | Get knowledge space information | — | — |
| 更新知识空间设置 | Update knowledge space settings | — | — |
| 添加知识空间成员 | Add a knowledge space member | — | — |
| 删除知识空间成员 | Remove a knowledge space member | — | — |
| 获取知识空间成员列表 | List knowledge space members | ✓ | — |
| 创建知识空间节点 | Create a knowledge space node | — | — |
| 创建动态层级的知识库空间节点 (自定义封装) | Create knowledge space nodes with a dynamic hierarchy (custom operation) | — | Composed operation: create a node hierarchy |
| 创建知识空间节点副本 | Copy a knowledge space node | — | — |
| 获取知识空间节点信息 | Get knowledge space node information | — | — |
| 获取知识空间子节点列表 | List child nodes of a knowledge space node | ✓ | Optional recursive child retrieval |
| 移动知识空间节点 | Move a knowledge space node | — | — |
| 更新知识空间节点标题 | Update a knowledge space node title | — | — |

<a id="chat"></a>

## Chat management / 群组管理 (12)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 创建群 | Create a chat | — | — |
| 更新群信息 | Update chat information | — | — |
| 解散群 | Disband a chat | — | — |
| 获取群信息 | Get chat information | — | — |
| 获取用户或机器人所在的群列表 | List chats that a user or bot belongs to | ✓ | — |
| 搜索对用户或机器人可见的群列表 | Search chats visible to a user or bot | ✓ | — |
| 获取群成员列表 | List chat members | ✓ | — |
| 将用户或机器人拉入群聊 | Add users or bots to a chat | — | — |
| 移出群成员 | Remove chat members | — | — |
| 判断用户或机器人是否在群里 | Check whether a user or bot is in a chat | — | — |
| 指定群管理员 | Assign chat administrators | — | — |
| 删除群管理员 | Remove chat administrators | — | — |

<a id="user"></a>

## Contacts / 通讯录 (6)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 获取用户信息 | Get user information | — | — |
| 批量获取用户信息 | Batch get user information | — | — |
| 通过手机号或邮箱获取用户 ID | Get user IDs by phone number or email address | — | — |
| 获取子部门列表 | List child departments | ✓ | Supports recursion and tree or flat output |
| 获取部门直属用户列表 | List users directly under a department | ✓ | — |
| 搜索用户 | Search users | ✓ | User credentials only; excludes external-organization and departed users |

<a id="directory"></a>

## Directory / 组织架构 (4)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 更新员工信息 | Update employee information (supports localized names / workstations) | — | — |
| 批量获取员工信息 | Batch get employee information (supports selecting multiple query fields) | — | — |
| 批量获取员工列表 | List employees (supports filters, multiple query fields, and Return All) | ✓ | — |
| 搜索员工信息 | Search employee information (supports multiple query fields and Return All) | ✓ | — |

<a id="task"></a>

## Tasks / 任务 (6)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 创建任务 | Create a task | — | — |
| 获取任务详情 | Get task details | — | — |
| 更新任务 | Update a task | — | — |
| 删除任务 | Delete a task | — | — |
| 添加任务成员 | Add task members | — | — |
| 移除任务成员 | Remove task members | — | — |

<a id="doc"></a>

## Documents / 云文档 (11)

A block is a unit of document content, such as a paragraph, heading, or table.

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 创建文档 | Create a document | — | — |
| 获取文档基本信息 | Get basic document information | — | — |
| 获取文档纯文本内容 | Get document plain-text content | — | — |
| 获取云文档内容 | Get document content | — | — |
| 获取文档所有块 | Get all document blocks | ✓ | — |
| 获取块的内容 | Get block content | — | — |
| 创建块 | Create a block | — | — |
| 创建嵌套块 | Create nested blocks | — | — |
| 更新块的内容 | Update block content | — | — |
| 删除块 | Delete a block | — | — |
| Markdown/HTML 内容转换为文档块 | Convert Markdown/HTML content to document blocks | — | — |

<a id="bitable"></a>

## Bitable / 多维表格 (34)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 多维表格 - Delete row(s) | Bitable - Delete row(s) | — | Enhanced: find and delete matching records |
| 多维表格 - Get row(s) | Bitable - Get row(s) | ✓ | Enhanced: conditions, sorting, field selection, and output formats |
| 多维表格 - If row exists | Bitable - If row exists | — | Enhanced: pass input through if a match exists; otherwise output nothing |
| 多维表格 - If row does not exist | Bitable - If row does not exist | — | Enhanced: pass input through if no match exists; otherwise output nothing |
| 多维表格 - Insert row | Bitable - Insert row | — | Enhanced: field mapping, attachments, and writes across input items |
| 多维表格 - Update row(s) | Bitable - Update row(s) | — | Enhanced: update by Record ID with field mapping and attachments |
| 多维表格 - Upsert row(s) | Bitable - Upsert row(s) | — | Enhanced: update the first match, or insert if none match |
| 多维表格 - Create a Data Table | Bitable - Create a Data Table | — | Enhanced: configure initial fields and properties visually |
| 解析多维表格地址 | Parse a Bitable URL | — | Helper: extract Bitable identifiers from a URL |
| 创建多维表格 | Create a Bitable app | — | — |
| 复制多维表格 | Copy a Bitable app | — | — |
| 获取多维表格元数据 | Get Bitable app metadata | — | — |
| 更新多维表格元数据 | Update Bitable app metadata | — | — |
| 列出数据表 | List tables | ✓ | — |
| 新增数据表 | Add a table | — | — |
| 更新数据表 | Update a table | — | — |
| 删除数据表 | Delete a table | — | — |
| 列出视图 | List views | ✓ | — |
| 获取视图 | Get a view | — | — |
| 新增视图 | Add a view | — | — |
| 更新视图 | Update a view | — | — |
| 删除视图 | Delete a view | — | — |
| 查询记录 | Search records | ✓ | — |
| 查询记录-通过记录ID | Get a record by ID | — | — |
| 新增记录 | Add a record | — | — |
| 更新记录 | Update a record | — | — |
| 删除记录 | Delete a record | — | — |
| 批量新增记录 | Batch add records | — | — |
| 批量更新记录 | Batch update records | — | — |
| 批量删除记录 | Batch delete records | — | — |
| 列出字段 | List fields | ✓ | — |
| 新增字段 | Add a field | — | — |
| 更新字段 | Update a field | — | — |
| 删除字段 | Delete a field | — | — |

<a id="message"></a>

## Messages / 消息 (22)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 发送消息 | Send a message | — | — |
| 回复消息 | Reply to a message | — | — |
| 编辑消息 | Edit a message | — | — |
| 获取指定消息的内容 | Get the content of a specific message | — | — |
| 获取会话历史消息 | Get chat message history | ✓ | — |
| 转发消息 | Forward a message | — | — |
| 撤回消息 | Recall a message | — | — |
| 批量发送消息 | Batch send messages | — | — |
| 批量撤回消息 | Batch recall messages | — | — |
| 查询批量消息整体进度 | Get overall batch message progress | — | — |
| 查询批量消息推送和阅读人数 | Get delivery and read counts for batch messages | — | — |
| 更新已发送的消息卡片 | Update a sent message card | — | — |
| 延时更新消息卡片 | Update a message card with a delay | — | — |
| 发送仅特定人可见的消息卡片 | Send a message card visible only to specific users | — | — |
| 删除仅特定人可见的消息卡片 | Delete a message card visible only to specific users | — | — |
| 发送应用内加急 | Send an urgent in-app notification | — | — |
| 上传图片 | Upload an image | — | — |
| 下载图片 | Download an image | — | — |
| 上传文件 | Upload a file | — | — |
| 下载文件 | Download a file | — | — |
| 获取消息中的资源文件 | Get resource files from a message | — | — |
| 解密事件消息 | Decrypt event messages | — | — |

<a id="calendar"></a>

## Calendar / 日历 (16)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 搜索日历 | Search calendars | ✓ | — |
| 查询日历信息 | Get calendar information | — | — |
| 查询主日历信息 | Get primary calendar information | — | — |
| 创建共享日历 | Create a shared calendar | — | — |
| 删除共享日历 | Delete a shared calendar | — | — |
| 获取日程列表 | List events | ✓ | — |
| 获取日程 | Get an event | — | — |
| 搜索日程 | Search events | ✓ | — |
| 创建日程 | Create an event | — | — |
| 更新日程 | Update an event | — | — |
| 删除日程 | Delete an event | — | — |
| 获取日程参与人列表 | List event attendees | ✓ | — |
| 添加日程参与人 | Add event attendees | — | — |
| 删除日程参与人 | Remove event attendees | — | — |
| 创建会议群 | Create a meeting chat | — | — |
| 解绑会议群 | Unbind a meeting chat | — | — |

<a id="aily"></a>

## Aily (5)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 读取文件基础信息 | Get basic file information | — | — |
| 文件上传 | Upload a file | — | — |
| 调用技能 | Invoke a skill | — | — |
| 查询技能列表 | List skills | ✓ | — |
| 获取技能信息 | Get skill information | — | — |

<a id="space"></a>

## Drive / 云空间 (18)

| Operation (UI label) | English description | Return All | Notes / restrictions |
| --- | --- | :---: | --- |
| 获取我的空间（根文件夹）元数据 | Get My Space (root folder) metadata | — | — |
| 获取文件夹中的文件清单 | List files in a folder | ✓ | Supports file type filters, recursion, and tree or flat output |
| 获取文件夹元数据 | Get folder metadata | — | — |
| 新建文件夹 | Create a folder | — | — |
| 获取文件统计信息 | Get file statistics | — | — |
| 获取文件访问记录 | Get file access records | ✓ | — |
| 搜索云文档 | Search cloud documents | ✓ | User credentials only |
| 上传文件 | Upload a file | — | — |
| 分片上传文件 | Multipart file upload (combines three API steps, supports large files with up to 5 concurrent uploads) | — | Composed upload with up to 5 concurrent parts |
| 下载文件 | Download a file | — | — |
| 导入文件 | Import a file | — | Composed operation: import Word / Excel / CSV / Markdown / TXT / HTML into supported cloud document types; upload first for a file token; polls task status |
| 导出云文档 | Export a cloud document (automatically polls task status and downloads the file) | — | Composed operation: polls export status and downloads the file |
| 上传素材 | Upload media | — | — |
| 分片上传素材 | Multipart media upload | — | Composed upload with up to 5 concurrent parts |
| 上传素材通过Url | Upload media from a URL | — | — |
| 下载素材 | Download media | — | — |
| 订阅云文档事件 | Subscribe to cloud document events | — | — |
| 取消云文档事件订阅 | Unsubscribe from cloud document events | — | — |

Select an operation in the node to see its parameters and field help. Consult the corresponding Feishu API for field types, identities, and permissions. See [inputs and outputs](./advanced.md#data) for working with execution data.
