/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, componentTypes, makeStyles, validatorTypes } from 'aws-northstar';
import { CustomComponentTypes, FormRenderer } from '$common/components';
import { CustomTransformScript } from '$views/data-product/views/Create/utils';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { Modal } from '$northstar-plus';
import { ScriptVulnerabilityReport } from '@ada/api';
import { apiHooks } from '$api';
import { createStyles } from '@material-ui/core';
import { nameToIdentifier } from '$common/utils';
import { useI18nContext } from '$strings';
import React, { useCallback, useMemo, useState } from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

interface FormData extends CustomTransformScript {
  scriptFile?: { content: string };
}

export interface CustomTransformDialogProps {
  transform?: Partial<CustomTransformScript>;
  onCancel: () => void;
  onSave: (transform: CustomTransformScript) => void;
}

function scriptReportToErrorMessage(report: ScriptVulnerabilityReport): string {
  if (report.errors?.length > 0) {
    return report.errors.map((error: any) => error.reason || error.message || String(error)).join(', ');
  }

  return JSON.stringify(report.results, null, 2);
}

export const CustomTransformDialog: React.FC<CustomTransformDialogProps> = ({ transform, onCancel, onSave }) => {
  const { LL } = useI18nContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | ScriptVulnerabilityReport>();
  const isNew = transform == null || transform.scriptId == null;
  const [validateScript] = apiHooks.usePostDataProductScriptsValidateAsync();

  const classes = useStyles();

  const submitHandler = useCallback(
    async ({ scriptId, namespace, name, description, inlineScriptContent }: FormData) => {
      try {
        setError(undefined);
        setIsSubmitting(true);

        const { report } = await validateScript({
          scriptSourceValidationInput: {
            scriptSource: inlineScriptContent,
          },
        });

        if (!report.passed) {
          setError(report);
          return; // exit
        }

        onSave({
          namespace,
          scriptId: scriptId || nameToIdentifier(name),
          name,
          description,
          inlineScriptContent,
        });
      } catch (_error: any) {
        setError(_error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSave],
  );

  const alertContent = useMemo<React.ReactNode>(() => {
    if (error == null) return null;
    if (error instanceof Error) {
      return (
        <Alert type="error" header={error.name}>
          {error.message}
        </Alert>
      );
    }

    return (
      <Alert type="error" header={LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.error.invalidScript.header()}>
        <div className={classes.scriptReportMessage}>
          <pre>{scriptReportToErrorMessage(error)}</pre>
        </div>
      </Alert>
    );
  }, [error]);

  return (
    <Modal title={LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.title()} visible onClose={onCancel} width="75%">
      {alertContent}

      <FormRenderer
        schema={{
          fields: [
            {
              component: CustomComponentTypes.ENTITY_NAME,
              name: 'name',
              label: LL.ENTITY['Transform@'].name.label(),
              description: LL.ENTITY['Transform@'].name.description(),
              isRequired: true,
              isReadOnly: !isNew,
              isDisabled: !isNew,
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            },
            {
              component: componentTypes.TEXT_FIELD,
              name: 'namespace',
              hideField: true,
              isReadOnly: true,
            },
            {
              component: componentTypes.TEXT_FIELD,
              name: 'description',
              label: LL.ENTITY['Transform@'].description.label(),
              description: LL.ENTITY['Transform@'].description.description(),
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            },
            {
              component: CustomComponentTypes.CODE_EDITOR,
              name: 'inlineScriptContent',
              label: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.inlineScriptContent.label(),
              description: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.inlineScriptContent.description(),
              helperText: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.inlineScriptContent.hintText(),
              mode: 'python',
              maxLines: 20,
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
                {
                  type: CustomValidatorTypes.TRANSFORM_SCRIPT_CODE,
                },
              ],
            },
            {
              component: CustomComponentTypes.FILE_UPLOAD,
              name: 'scriptFile',
              storeContentAs: 'inlineScriptContent',
              label: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.scriptFile.label(),
              description: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.scriptFile.description(),
              hintText: LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.CUSTOM.fields.scriptFile.hintText(),
            },
          ],
        }}
        initialValues={{
          inlineScriptContent: EXAMPLE_SCRIPT,
          ...transform,
          scriptFile: undefined,
        }}
        isSubmitting={isSubmitting}
        onSubmit={submitHandler as any}
        onCancel={onCancel}
      />
    </Modal>
  );
};

export const EXAMPLE_SCRIPT = `
"""
Example noop script
@param {DynamicFrame} input_frame - Input frame
@returns {DynamicFrame[]} Must return list of frames
"""
def apply_transform(input_frame, **kwargs):
    return [input_frame]
`;

const useStyles = makeStyles(() =>
  createStyles({
    scriptReportMessage: {
      maxHeight: 200,
      width: '100%',
      flex: 'auto',
      overflow: 'auto',

      '> *': {
        width: '100%',
      },
    },
  }),
);
