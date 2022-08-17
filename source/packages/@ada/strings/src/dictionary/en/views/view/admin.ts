/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APP_NAME, ROOT_ADMINISTRATOR } from '../../constants';

export const ADMIN = {
	title: 'Admin',
	nav: 'Admin',

	HELP: {
		TEARDOWN: {
			header: 'Teardown',
		},
	},

	RootAdmin: {
		nav: ROOT_ADMINISTRATOR,
	},

	Teardown: {
		title: `Delete ${APP_NAME}`,
		subtitle: 'Permanently remove the solution from your account',
		nav: 'Teardown',
		htmlBody: 'This will <b>permanently delete</b> the solution from your account. This option is only available for users with <i>root_admin</i> access.',
		htmlWarning: 'You will lose all access to the solution and this action cannot be undone.',
		strategy: {
			retainData: {
				heading: 'Keep data',
				htmlDetails: `Permanently remove ${APP_NAME} from this account, but <b>keep data</b> intact.`,
				buttonText: 'Delete solution',
				confirm: {
					title: 'Confirm teardown',
					confirmationText: 'permanently delete',
					deleteButtonText: 'Permanently Delete',
					htmlLabel: 'To confirm deletion, type "<i>permanently delete</b>" below',
					htmlBody: 'This will uninstall all the resources associated with the solution but retain the imported data. Confirm before you select this option.',
				},
			},
			destroyData: {
				heading: 'Delete data',
				htmlDetails: `Permanently remove ${APP_NAME} from this account, and <b> delete all managed data</b>.`,
				buttonText: 'Delete solution and data',
				confirm: {
					title: 'Confirm teardown',
					confirmationText: 'permanently delete and data',
					deleteButtonText: 'Permanently Delete',
					htmlLabel: 'To confirm deletion, type "<i>permanently delete and data</b>" below',
					htmlBody: 'This will uninstall all the resources associated with the solution and destroy the imported data, and you will lose access to the solution, so confirm before selecting this option.',
				},
			},
		},
		success: {
			heading: 'Teardown of solution has been started',
			htmlWarning:
				'This website will become unavailable soon and you must follow the progress of teardown in the CloudFormation console. Copy the following details before you delete the solution.',
			details: {
				message: {
					label: 'Message',
				},
				coreStack: {
					label: 'CloudFormation Stack',
				},
				retained: {
					label: 'Retained resources',
				},
				dataIndicator: {
					destroyData: 'All data will be destroyed',
					retainData: 'All data will be retained',
				},
			},
		},
		notify: {
			error: {
				header: 'Failed to teardown solution',
			},
			success: {
				header: 'Successfully started solution teardown',
				content: 'Monitor status of teardown with provided details',
			},
		},
	},
} as const;
