import { IExecuteFunctions, IRequestOptions } from 'n8n-workflow';
import {
	IAdditionalCredentialOptions,
	IOAuth2Options,
} from 'n8n-workflow/dist/esm/interfaces';
import { Credentials } from '../type/enums';

class RequestUtils {
	static async originRequest(
		this: IExecuteFunctions,
		options: IRequestOptions,
		clearAccessToken = false,
	) {
		let authentication = this.getNodeParameter('authentication', 0) as string;

		let additionalCredentialOptions = {} as IAdditionalCredentialOptions

		if (authentication === Credentials.FeishuCredentialsApi) {
			const credentials = await this.getCredentials(authentication);

			console.log('credentials.accessToken', credentials.accessToken);

			options.baseURL = `https://${credentials.baseUrl}`;

			additionalCredentialOptions = {
				// @ts-ignore
				credentialsDecrypted: {
					data: {
						...credentials,
						accessToken: clearAccessToken ? '' : credentials.accessToken,
					},
				},
			};
		} else if (authentication === Credentials.FeishuOauth2Api) {

			options.baseURL = `https://open.feishu.cn`;

			let oauth2 = {
				keepBearer: true
			} as IOAuth2Options

			return this.helpers.requestOAuth2
				.call(this, authentication, options, oauth2)
		}

		return this.helpers.requestWithAuthentication
			.call(this, authentication, options, additionalCredentialOptions)
	}

	static async request(this: IExecuteFunctions, options: IRequestOptions) {
		if (options.json === undefined) options.json = true;

		return RequestUtils.originRequest.call(this, options).then((data) => {
			const handleResponse = (data: any) => {
				if (data.code && data.code !== 0) {
					throw new Error(
						`Request Error: ${data.code}, ${data.msg} \n ` + JSON.stringify(data.error),
					);
				}
				return data.data ?? data;
			};

			// 处理一次accesstoken过期的情况
			if (data.code && data.code === 99991663) {
				return RequestUtils.originRequest.call(this, options, true).then((data) => {
					return handleResponse(data);
				});
			}

			return handleResponse(data);
		});
	}
}

export default RequestUtils;
