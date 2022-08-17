/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APP_NAME, TAGLINE } from '../../constants';

export const PUBLIC = {
	HELP: {
		ROOT: {
			header: 'Help Info',
		},
	},

	Landing: {
		title: 'Welcome to ' + APP_NAME,
		subtitle: TAGLINE,
		access: {
			message:
				'It appears you do not have sufficient access, please request access. If you experience issues or delays please contact your Administrator to gain access.',
			buttonText: 'Request access',
			disclaimer: 'The administrator will need to approve your request before you will have access.',
			notify: {
				error: {
					header: 'Failed to send access request, please try again.',
				},
				success: {
					header: 'Access request has been received',
					content: 'Please wait for administrator to approve your request and then sign back in',
				},
			},
		},
	},
} as const;
