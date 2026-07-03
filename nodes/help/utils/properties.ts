import { INodeProperties } from 'n8n-workflow';
import { ANY_EVENT } from './feishu-sdk/consts';

/**
 * 触发事件类型枚举
 */
export enum TriggerEventType {
	ReceiveMessage = 'im.message.receive_v1',
}

/**
 * 文件类型枚举
 */
export enum FileType {
	Bitable = 'bitable',
	Docx = 'docx',
	Folder = 'folder',
	File = 'file',
	Slides = 'slides',
}

/**
 * Trigger 事件选择属性
 */
export const triggerEventProperty: INodeProperties = {
	displayName: '触发事件',
	name: 'events',
	type: 'multiOptions',
	required: true,
	options: [
		{
			name: '所有事件',
			value: ANY_EVENT,
			description: '触发所有事件',
		},
		{
			name: '接收消息',
			value: TriggerEventType.ReceiveMessage,
			description: '当机器人收到用户发送的消息时触发',
		},
		{
			name: '首次会话创建',
			value: 'p2p_chat_create',
			description: '用户和机器人的会话首次被创建时触发（v1.0 事件，仅首次触发一次）',
		},
		{
			name: '新增消息表情回复',
			value: 'im.message.reaction.created_v1',
			description: '当消息被添加表情回复时触发',
		},
		{
			name: '删除消息表情回复',
			value: 'im.message.reaction.deleted_v1',
			description: '当消息表情回复被删除时触发',
		},
		{
			name: '自定义菜单事件',
			value: 'application.bot.menu_v6',
			description: '当用户点击机器人菜单时触发',
		},
		{
			name: '文件夹下文件创建',
			value: 'drive.file.created_in_folder_v1',
			description: '当用户订阅的文件夹下有新建文件时将触发此事件',
		},
		{
			name: '文件标题变更',
			value: 'drive.file.title_updated_v1',
			description: '被订阅的云文档标题发生变更时，将会触发此事件',
		},
		{
			name: '文件编辑',
			value: 'drive.file.edit_v1',
			description: '文件编辑（包括多维表格字段和记录变更）时，将触发此事件',
		},
		{
			name: '文件删除到回收站',
			value: 'drive.file.trashed_v1',
			description: '被订阅的文件被删除到回收站时，将触发此事件',
		},
		{
			name: '文件彻底删除',
			value: 'drive.file.deleted_v1',
			description: '被订阅的文件被彻底删除时，将触发此事件',
		},
		{
			name: '多维表格字段变更',
			value: 'drive.file.bitable_field_changed_v1',
			description: '当订阅的多维表格字段发生变更时触发',
		},
		{
			name: '多维表格记录变更',
			value: 'drive.file.bitable_record_changed_v1',
			description: '当订阅的多维表格记录发生变更时触发',
		},
		{
			name: '卡片回传交互',
			value: 'card.action.trigger',
			description: '当用户点击卡片上配置了回传交互的组件时触发',
		},
		{
			name: '链接预览',
			value: 'url.preview.get',
			description: '链接预览能力可以将飞书消息中的链接，转换为文字或卡片的形式进行展示',
		},
		{
			name: '员工入职',
			value: 'contact.user.created_v3',
			description:
				'如果有新员工入职（例如，通过管理后台添加成员、调用创建用户 API），则会触发该事件',
		},
		{
			name: '员工离职',
			value: 'contact.user.deleted_v3',
			description: '如果有员工离职（例如，通过管理后台离职成员、调用删除用户 API），则会触发该事件',
		},
		{
			name: '员工信息被修改',
			value: 'contact.user.updated_v3',
			description: '当员工信息被修改时将会触发该事件',
		},
		{
			name: '机器人进群',
			value: 'im.chat.member.bot.added_v1',
			description: '当机器人被添加到群聊时触发',
		},
		{
			name: '机器人被移出群',
			value: 'im.chat.member.bot.deleted_v1',
			description: '当机器人被移出群聊时触发',
		},
		{
			name: '用户进群',
			value: 'im.chat.member.user.added_v1',
			description: '当用户被添加到群聊时触发',
		},
		{
			name: '用户出群',
			value: 'im.chat.member.user.deleted_v1',
			description: '当用户离开群聊时触发',
		},
		{
			name: '群解散',
			value: 'im.chat.disbanded_v1',
			description: '当群聊被解散时触发',
		},
		{
			name: '群配置变更',
			value: 'im.chat.updated_v1',
			description: '当群聊配置发生变更时触发',
		},
		{
			name: '消息已读',
			value: 'im.message.message_read_v1',
			description: '当消息被已读时触发',
		},
		{
			name: '审批实例状态变更',
			value: 'approval.instance.status_changed_v4',
			description: '当审批实例状态发生变更时触发',
		},
		{
			name: '审批任务状态变更',
			value: 'approval.task.status_changed_v4',
			description: '当审批任务状态发生变更时触发',
		},
	],
	default: [],
};
