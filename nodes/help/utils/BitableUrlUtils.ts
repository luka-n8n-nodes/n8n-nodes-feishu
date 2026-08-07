import {
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import RequestUtils from './RequestUtils';

export interface IParsedBitableUrl {
	app_token: string | null;
	table_id: string | null;
	view_id: string | null;
}

class BitableUrlUtils {
	static async parseBitableUrl(
		context: IExecuteFunctions,
		url: string,
		timeout?: number,
	): Promise<IParsedBitableUrl> {
		const data: IParsedBitableUrl = {
			app_token: null,
			table_id: null,
			view_id: null,
		};

		let matches = url.match(/\/base\/(.*?)(\?|$)/);

		if (matches) {
			data.app_token = matches[1];
		} else {
			matches = url.match(/\/wiki\/(.*?)(\?|$)/);

			if (matches) {
				const wikiToken = matches[1];
				const requestOptions: IHttpRequestOptions = {
					method: 'GET' as IHttpRequestMethods,
					url: '/open-apis/wiki/v2/spaces/get_node',
					qs: {
						token: wikiToken,
						obj_type: 'wiki',
					},
				};

				if (timeout) {
					requestOptions.timeout = timeout;
				}

				const res = (await RequestUtils.request.call(context, requestOptions)) as {
					node?: { obj_token?: string };
				};

				data.app_token = res?.node?.obj_token ?? null;
			}
		}

		matches = url.match(/table=(.*?)(&|$)/);

		if (matches) {
			data.table_id = matches[1];
		}

		matches = url.match(/view=(.*?)(&|$)/);

		if (matches) {
			data.view_id = matches[1];
		}

		return data;
	}
}

export default BitableUrlUtils;
