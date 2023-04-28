/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';
import { OWNER, QUERY_WORKBENCH } from '../../constants';

/* eslint-disable sonarjs/no-duplicate-string */

const SOURCE_OWNER_MESSAGE = `As the DataProduct <b>${OWNER}</b>, you are able to view and query the raw source data.`;
const SOURCE_HOW = `Prefix the DataProduct's SQL Identifier with "<i>source.</i>" to query source data: "<i>{sqlIndetifier:string}</i>".`;
const SOURCE_HOW_IN_SCHEMA = `You can also view the source schema below and click the "Query" button on source tables to open in the ${QUERY_WORKBENCH}.`;
const SOURCE_WHILE_YOU_WAIT = `While we are importing and processing your data... you can query your raw source data!`;

export const DATA_PRODUCT = {
	title: ENTITY.DataProducts,
	nav: ENTITY.DataProducts,

	HELP: {
		ROOT: {
			header: ENTITY.DataProducts,
		},
		DETAIL: {
			header: ENTITY.DataProduct,
		},
		CREATE: {
			header: `Create ${ENTITY.DataProduct}`,
		},
	},

	ROOT: {
		title: ENTITY.DataProducts,
		subtitle: `View and manage available ${ENTITY.data_products}`,
	},

	STATUS: {
		isProvisioning: 'Building',
		hasProvisioningFailed: 'Build Failed',
		isMissingData: 'No data available',
		isImporting: 'Importing',
		hasImportingFailed: 'Import Failed',
		isReady: 'Ready',
		NA: '-',
	},

	ACTIONS: {
		title: 'Actions',

		query: {
			text: 'Query',
			label: `Query this ${ENTITY.data_product} in the ${QUERY_WORKBENCH}`,
		},
		share: {
			text: 'Share',
			label: `Share this ${ENTITY.data_product} with other ${ENTITY.users}`,
		},
		delete: {
			text: 'Delete',
			label: `Delete this ${ENTITY.data_product}`,
		},

		createDataProduct: {
			text: `Create ${ENTITY.data_product}`,
			label: `Create a new ${ENTITY.data_product}`,
		}
	},

	NOT_FOUND_HTML: {
		description: `No ${ENTITY.data_product} found with name <i>{dataProductId:string|entityName}</i> in <i>{domainId:string|entityName}`,
		seeAllInDomainLink: `See available ${ENTITY.data_products} in <i>{domainId:string|entityName}</i>`,
		seeAllLink: `See all ${ENTITY.data_products}`,
	},

	Domain: {
		selector: {
			all: `All ${ENTITY.Domains}`,
			delete: {
				alertTitle: `${ENTITY.Domain} {name:string} is not empty`,
				hintText:
					`${ENTITY.Domains} must be empty before they can be deleted. Delete all ${ENTITY.data_products} before deleting the ${ENTITY.domain}.`,
				confirmText: 'OK',
			},
		},
		summary: {
			create: {
				buttonText: `Create ${ENTITY.Domain}`,
			},
			totalDataProducts: `Total ${ENTITY.data_products}`,
			none: {
				title: `Create your first ${ENTITY.Domain}`,
				message:
					`There are currently no ${ENTITY.domains}. Create your first ${ENTITY.domain} before adding ${ENTITY.data_products}.`,
				permissions: {
					message: `You do not have permission to create ${ENTITY.Domains.toLowerCase()}`,
					buttonText: 'Request permissions',
				},
			},
			all: {
				title: `All ${ENTITY.domains}`,
				subtitle: `Summary of all ${ENTITY.data_products} across all ${ENTITY.domains}`,
				totalDomains: `Total ${ENTITY.domains}`,
			},
			domain: {
				title: '{domain:string|entityName}',
				subtitle: ENTITY.Domain,
				lastCreated: `Last ${ENTITY.data_product} created`,
			},
		},
		CREATE: {
			title: `Create ${ENTITY.Domain}`,
		}
	},

	// source data details to show "owner"
	sourceDataMessage: {
		notSupported: 'Source data is only supported for S3 and File Upload data sources.',
		ownerMessage: SOURCE_OWNER_MESSAGE,
		how: SOURCE_HOW,
		howInSchema: SOURCE_HOW_IN_SCHEMA,
		whileYouWait: SOURCE_WHILE_YOU_WAIT,
		state: {
			dataAndSourceReady: {
				header: 'Source Data Available',
				messageHtml: `${SOURCE_OWNER_MESSAGE}<br />${SOURCE_HOW} ${SOURCE_HOW_IN_SCHEMA}`,
			},
			PENDING: {
				header: 'While you wait',
				messageHtml: `<b>${SOURCE_WHILE_YOU_WAIT}</b><br />${SOURCE_HOW}<br />${SOURCE_HOW_IN_SCHEMA}`,
			},
			FAILED: {
				header: 'Source Data Unavailable',
				messageHtml: 'Failed to process source data, unfortunately it will not be available to query.',
			},
			READY: {
				header: 'Source Data Available',
				messageHtml: `${SOURCE_OWNER_MESSAGE}<br />${SOURCE_HOW}<br />${SOURCE_HOW_IN_SCHEMA}`,
			},
		},
	},

	Wizard: {
		title: ENTITY.DataProduct__CREATE,
		subtitle: `Enter details about the new ${ENTITY.data_product}`,

		ACTIONS: {
			skipPreview: {
				buttonText: 'Skip',
				confirm: {
					title: 'Skip preview',
					subtitle: 'Confirm skipping preview',
					content: 'Skipping the schema preview will disable transforms and could delay access to data until fully imported.',
				},
			},
			transformSchema: {
				text: 'Transform schema',
			},
			continueWithCurrentSchema: {
				text: 'Continue with current schema',
			},
		},

		SourceDetails: {
			title: 'Source Details',
			subtitle: 'Configure the data source for the new data product',
		},

		Schema: {
			title: 'Schema',
			PREVIEW: {
				VALIDATOR: {
					missingOrInvalid: 'Missing or invalid schema',
					status: 'Schema preview {0:string|startcase}',
					running: 'Schema preview is still running - please wait',
				},
			},
		},

		Transforms: {
			title: 'Transforms',
		},

		FILE_UPLOAD: {
			error: {
				missingFile: 'File not defined for upload',
				failedToUpload: 'Failed to upload source file',
			},
			progress: {
				label: 'File upload',
				description: 'Uploading your source file',
				uploading: 'Uploading your source file... {0?:string}',
				complete: 'Successfully uploaded source',
			},
			preview: {
				generating: {
					label: 'Generating schema preview',
					description: 'Usually completes in a few seconds, but depending on size and complexity of data may take up to a minute',
					error: 'Failed to build schema for the data product',
				}
			}
		},
		TransformPlanner: {
			title: 'Transform plan',

			warning: {
				disabled: 'Preview disabled for this source',
				notAvailable: 'Preview not available',
				jsonRelationalize: 'Transformations after json relationalization will be applied to all resultings datasets.',
				emptyResult: `
					Transform resulted in an empty schema for {emptyPreviews:number} of {transformedDataSets:number} data sets.
					If filtering data, consider converting the <code>input_frame</code> to a Spark DataFrame to ensure the full
					schema is preserved if the result is empty.`
			},

			status: {
				generating: 'Generating preview...',
				failed: 'Failed to generate preview, please check your transforms and source data.',
				success: 'Preview successfully generated',
				notAvailable: 'No preview available',
			},

			LIBRARY: {
				hintText: 'Drag in your desired transforms to create your transform plan.',
				BUILT_IN: {
					header: 'Built-in transforms',
				},
				SHARED: {
					header: 'Shared transforms',
				},
				NEW: {
					header: 'New transforms',
					createButtonText: 'Create new transform',
				}
			},
			PLAN: {
				hintText: 'Drag in optional transforms',
			},

			CUSTOM: {
				title: 'Custom transform script',
				error: {
					invalidScript: {
						header: 'Invalid script',
					},
				},
				fields: {
					inlineScriptContent: {
						label: ENTITY['Transform@'].scriptContent.label,
						description: ENTITY['Transform@'].scriptContent.description,
						hintText: ENTITY['Transform@'].scriptContent.hintText,
					},
					scriptFile: {
						label: 'Source code file',
						description: 'Choose a python script file. Must define an apply_transform method, see docs for details',
						hintText: ENTITY['Transform@'].scriptContent.hintText,
					},
				}
			},
		},

		REVIEW: {
			Details: {
				title: 'Details',
			},
			Schema: {
				title: 'Schema',
				subtitle: 'The resulting schema after importing data',
			},
			CustomTransforms: {
				title: 'Custom transforms',
				subtitle: 'New transforms script to create',
			},
			Permissions: {
				title: 'Permissions',
				content: 'By default, the data product is accessible only to the Admin group and to you as the data product owner. Once the data product is created, you have the ability to extend access to other groups by granting permissions on the data product details page.'
			}
		},

		SUBMIT: {
			CUSTOM_TRANSFORM: {
				error: {
					failedToMap: 'Failed to map custom transform {id:string}'
				},
				notify: {
					creatingScript: 'Creating transform script...',
					createdScript: 'Created transform script "{name:string}"',
					failedToCreateScript: 'Failed to create custom transform script "{name:string}"'
				}
			},
		}
	},

	SAMPLE: {
		title: 'Sample data',

		button: {
			text: 'View sample',
			label: `View sample data for this ${ENTITY.data_set}`,
		},

		WARNING: {
			agreeText: 'Agree',
			disagreeText: 'Disagree',

			messageHtml: `The following content may contain PII data and requires acknowledgement of the following to display:
				<li>The data does not have any PII data</li>
				<li>or, I am authorized to view PII data and my environment is safe from leaking to others that may not be authorized.
				</li>`,

			gateText: 'Hiding potential PII data',
		}
	},

	SCHEMA: {
		title: ENTITY.Schema,

		PROGRESS: {
			generatingText: 'Please wait for schema to be generated...',
		},

		COLUMN: {
			name: {
				label: 'Column Name',
			},
			dataType: {
				label: 'Type',
			},
			description: {
				label: 'Description',
				placeholder: `Enter description for {columnName:string} column`
			},
			piiClassification: {
				label: 'PII',
			},
			ontology: {
				label: 'Governance',
				named: 'Column {0:string} governance'
			},
		},
		ACTION: {
			save: {
				text: 'Save schema',
			},
			cancel: {
				text: 'Cancel',
			},
			edit: {
				text: 'Edit schema',
			}
		}
	},

	QUERY: {
		button: {
			text: `Query ${ENTITY.data_set}`,
			label: `Query ${ENTITY['data_set^']} in the ${QUERY_WORKBENCH}`
		}
	},

	TRIGGER: {
		notify: {
			TRIGGERED_UPDATED: {
				header: 'Update triggered',
				content: 'Started job to import latest data from source',
			},
			FAILED_TO_TRIGGERED_UPDATE: {
				header: 'Failed to trigger update',
			}
		}
	},

	PERMISSIONS: {
		title: 'Permissions',
		subtitle: 'The groups that can access this data product. Note: Users need FULL access to update the permissions.',

		notify: {
			UPDATED: 'Updated permissions',
			FAILED_TO_UPDATE: 'Failed to update permissions',
		},

		editButton: {
			text: 'Edit permissions',
			label: `Edit the group permissions for this ${ENTITY.data_product}`,
		},

		FORM: {
			title: 'Edit the groups that have access to this data product',
		}
	},
} as const;
