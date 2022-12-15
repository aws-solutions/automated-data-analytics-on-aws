/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductPreview } from '@ada/api';
import { FileUpload } from '@ada/connectors';
import { FormData, formDataToDataProduct } from '../../utils';
import { Input } from '@data-driven-forms/react-form-renderer';
import { MultiPartFileUploader } from '$common/utils/multipart-file-uploader';
import { MultipartFileUploadProgressInfo, nameToIdentifier } from '$common/utils';
import { ProgressBar } from '$northstar-plus/components/ProgressBar';
import { SchemaRenderer } from '$views/data-product/components/schema/SchemaRenderer';
import { Stack } from 'aws-northstar';
import { StepFunctionExecutionStatus } from '@ada/common';
import { get } from 'lodash';
import { previewDataProductUntilComplete } from '$api/data-product';
import { useI18nContext } from '$strings';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import prettyBytes from 'pretty-bytes';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

/* eslint-disable sonarjs/cognitive-complexity */
export interface SchemaPreviewStepProps {
  input: Input<FormData['inferredSchema']>;
  data: FormData;
}

export const SchemaPreviewStep: React.FC<SchemaPreviewStepProps> = ({ input, data: formData }) => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  const { LL } = useI18nContext();
  const { change } = useFormApi();
  const [fileUploadProgress, setFileUploadProgress] = useState<MultipartFileUploadProgressInfo>();
  const [fileUploadError, setFileUploadError] = useState<Error>();
  const [preview, setPreview] = useState<DataProductPreview | undefined>(input.value?.preview);

  const isUpload = formData.sourceType === FileUpload.ID;

  const generateSchemaPreview = useCallback(
    async (_formData: FormData) => {
      setPreview(undefined);
      change('skipPreview', false);
      change('canSkipPreview', true);
      const dataProduct = formDataToDataProduct(_formData);
      const fetchedPreview = await previewDataProductUntilComplete(dataProduct, true);
      setPreview(fetchedPreview);

      change(
        'inferredSchema' as keyof FormData,
        {
          preview: fetchedPreview,
          // Set the initial transforms for the transform planner step to the ones that were automatically applied
          // Note that this has the knock on effect of resetting the transform plan if the user navigated backwards to here
          // and then changed the source details. However if the source changes it's likely the user will want to change the
          // plan anyway.
          transforms: fetchedPreview.transformsApplied || [],
          // Keep track of the source details for the data product for which we ran the preview
          sourceDetails: dataProduct.sourceDetails,
        } as FormData['inferredSchema'],
      );
    },
    [change],
  );

  const uploadFile = useCallback(async () => {
    if (formData.sourceType === FileUpload.ID) {
      try {
        change('canSkipPreview', false); // disable skipping preview while uploading
        setFileUploadProgress(undefined);
        setFileUploadError(undefined);
        const fileInput = get(formData, FileUpload.CONSTANT.UPLOAD_FILE_WIZARD_FIELD);
        if (fileInput == null) {
          throw new Error(LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.error.missingFile());
        }
        const uploader = new MultiPartFileUploader(fileInput, nameToIdentifier(formData.name), formData.domainId);
        uploader.onProgress((_progress, _info) => {
          setFileUploadProgress(_info);
        });
        const result = await uploader.startUpload();

        const sourceDetails: FileUpload.ISourceDetails = {
          // remove the fileName from the key, just use the folder for the data product creation
          key: result.key.split('/').slice(0, -1).join('/'),
          bucket: result.bucket,
        };

        // persist to form data
        change('sourceDetails', sourceDetails);
        change('canSkipPreview', true);
        // store locally for generating preview
        formData.sourceDetails = sourceDetails;

        generateSchemaPreview(formData);
      } catch (err: any) {
        console.error(err);
        setFileUploadError(err);
      }
    }
  }, [formData, change]);

  useEffect(() => {
    if (isUpload) {
      uploadFile();
    } else {
      generateSchemaPreview(formData);
    }
  }, [isUpload]); // eslint-disable-line react-hooks/exhaustive-deps

  if (preview == null || preview.status !== StepFunctionExecutionStatus.SUCCEEDED) {
    const status: React.ReactNode[] = [];

    if (isUpload) {
      if (fileUploadError != null) {
        status.push(
          <ProgressBar
            status="error"
            label={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.progress.label()}
            description={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.progress.description()}
            resultText={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.error.failedToUpload()}
            additionalInfo={fileUploadError.message}
            resultButtonText={LL.VIEW.misc.Retry()}
            resultButtonClick={uploadFile}
            value={fileUploadProgress?.progress}
          />,
        );
      } else {
        const { loaded = 0, total } = fileUploadProgress || {};
        const progressText = total ? `${prettyBytes(loaded)} / ${prettyBytes(total)}` : null;

        status.push(
          <ProgressBar
            status={fileUploadProgress?.complete ? 'success' : 'in-progress'}
            value={fileUploadProgress?.progress}
            label={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.progress.label()}
            description={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.progress.uploading(progressText!)}
            resultText={fileUploadProgress?.complete
              ? LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.progress.complete()
              : undefined
            }
          />,
        );
      }
    }

    const displayPreviewProgressValue = !isUpload || fileUploadProgress?.complete;
    if (preview == null || preview.status == null) {
      status.push(
        <ProgressBar
          status="in-progress"
          label={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.preview.generating.label()}
          description={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.preview.generating.description()}
          value={displayPreviewProgressValue ? Infinity : 0}
          displayValue={displayPreviewProgressValue}
        />,
      );
    } else if (preview.status !== StepFunctionExecutionStatus.SUCCEEDED) {
      status.push(
        <ProgressBar
          status="error"
          label={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.preview.generating.label()}
          description={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.preview.generating.description()}
          resultText={LL.VIEW.DATA_PRODUCT.Wizard.FILE_UPLOAD.preview.generating.error()}
          additionalInfo={preview.error?.message || preview.status}
          resultButtonText={LL.VIEW.misc.Retry()}
          resultButtonClick={() => generateSchemaPreview(formData)}
          displayValue={displayPreviewProgressValue}
        />,
      );
    }

    if (status.length > 0) {
      return (
        <Stack spacing="l">
          {status.map((v, i) => (
            <Fragment key={i}>{v}</Fragment>
          ))}
        </Stack>
      );
    }
  }

  return (
    <Stack spacing="l">
      <SchemaRenderer preview={preview} />
    </Stack>
  );
};
