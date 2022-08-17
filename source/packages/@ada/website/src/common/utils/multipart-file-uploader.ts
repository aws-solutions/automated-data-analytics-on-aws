/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  GetDataProductDomainDataProductFileUploadContentTypeEnum,
  PostDataProductDomainDataProductFileUploadContentTypeEnum,
  S3Location,
} from '@ada/api';
import { MultipartUploadPart, getContentTypeForFile, validateFileUploadSupportedType } from '@ada/common';
import { api } from '$api/client';
import { flatten, throttle } from 'lodash';
import Axios from 'axios';
import Queue from 'queue';
import retry from 'async-retry';

// https://www.altostra.com/blog/multipart-uploads-with-s3-presigned-url
const axios = Axios.create();
delete axios.defaults.headers.put['Content-Type'];

const TARGET_PART_SIZE = 50 * 1024 * 1024; // 50MB
// Limits https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
const MIN_PART_SIZE = 5 * 1024 * 1024;
const MAX_NUM_PARTS = 10000;

const CONCURRENCY = 4;

interface PartInfo {
  partNumber: number;
  total: number;
  loaded: number;
  progress: number;
  isComplete: boolean;
}

export interface MultipartFileUploadProgressInfo {
  parts: number;
  partsLoaded: number;
  loaded: number;
  total: number;
  progress: number;
  complete: boolean;
}

export type ProgressHandlerType = (progress: number, info: MultipartFileUploadProgressInfo) => void;

const SUPPORTED_CONTENTTYPES = Object.values(PostDataProductDomainDataProductFileUploadContentTypeEnum);

function getContentType(
  file: File,
):
  | PostDataProductDomainDataProductFileUploadContentTypeEnum
  | GetDataProductDomainDataProductFileUploadContentTypeEnum {
  const contentType = getContentTypeForFile(file.name, file.type);
  if (SUPPORTED_CONTENTTYPES.includes(contentType as any)) {
    return contentType as any;
  }

  throw new Error(`ContentType "${contentType}" is not supported.`);
}

function calcProgressPercent(loaded: number, total: number): number {
  if (loaded <= 0) return 0;
  return Math.floor(Math.min(1, loaded / total) * 100);
}

// Avoid "Your proposed upload is smaller than the minimum allowed size" error be ensuring smallest chunk is atleast 5MB
function calcSafeParts(
  fileSize: number,
  targetSize: number,
  _minSize: number,
  maxParts: number,
): { parts: number; partSize: number } {
  if (fileSize < targetSize) return { parts: 1, partSize: fileSize }; // single file upload

  let partSize: number = targetSize;
  let parts: number = Math.ceil(fileSize / partSize);

  if (parts > maxParts) {
    partSize = Math.ceil(fileSize - (fileSize % (maxParts - 1)) / (maxParts - 1));
    parts = maxParts;
  }

  return { parts, partSize };
}

/**
 * Helper class used to handle multipart file upload
 */
export class MultiPartFileUploader {
  private readonly file: File;
  private readonly fileName: string;
  private readonly dataProductId: string;
  private readonly domainId: string;
  private uploadId: string;
  private onProgressEvents: ProgressHandlerType[];

  private readonly total: number;
  private loaded = 0;
  private readonly parts: number;
  private readonly partSize: number;
  private partsLoaded = 0;

  /**
   * Create a new instance of MultiPartFileUploader
   * @param file the File object as per spec: https://developer.mozilla.org/en-US/docs/Web/API/File
   * @param dataProductId the ID of te data product for which the file is being uploader for
   * @param domainId the ID of the domain that the data product belongs to
   */
  constructor(file: File, dataProductId: string, domainId: string) {
    this.file = file;
    // replace all spaces with _ to match S3 object key specifications
    this.fileName = this.file.name.replace(/\s+/g, '_');

    this.domainId = domainId;
    this.dataProductId = dataProductId;
    this.uploadId = '';
    this.onProgressEvents = [];

    this.total = file.size;
    const { parts, partSize } = calcSafeParts(this.file.size, TARGET_PART_SIZE, MIN_PART_SIZE, MAX_NUM_PARTS);
    this.parts = parts;
    this.partSize = partSize;
  }

  get progress(): number {
    return calcProgressPercent(this.loaded, this.total);
  }

  get complete(): boolean {
    return this.progress === 100;
  }

  get isMultipart(): boolean {
    return this.parts > 1;
  }

  /**
   * Allows to listen for upload progress events, can be called multiple times.
   * This passed in handler will be automatically throttled.
   * @param handler a handler function to be invoked everytime there's a progress update
   */
  onProgress = (handler: ProgressHandlerType) => {
    this.onProgressEvents.push(throttle(handler, 100));
  };

  /**
   * Start the upload process
   * @returns if successful, the bucket and the key where the file has been stored. Throws an exception in case of errors on upload
   */
  /* eslint-disable sonarjs/cognitive-complexity */
  startUpload = async (): Promise<S3Location> => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    const { parts, partSize } = this;

    try {
      this._broadcastProgress();

      if (this.isMultipart === false) {
        // SINGLE FILE
        const result = await this.startPartUpdate(1, this.file);
        this.loaded = this.total;
        this._broadcastProgress();

        return result;
      } else {
        // MULTI PART FILE
        await this.initiateMultipartUpload();

        const results: MultipartUploadPart[] = await new Promise((resolve, reject) => {
          const queue = new Queue({ concurrency: CONCURRENCY, timeout: undefined, results: [] });

          // queue up part upload wrappers
          let offset = 0;
          for (let partNumber = 1; partNumber <= parts; partNumber++) {
            const isLastPart = partNumber === parts;
            queue.push(async (cb) => {
              try {
                const blob = this.file.slice(offset, isLastPart ? undefined : (offset += partSize)); //NOSONAR (typescript:S1121) more readable as is
                const result = await this.startPartUpdate(partNumber, blob);

                cb && cb(undefined, result);
              } catch (error: any) {
                console.error(`MultipartFileUpload: failed to upload part ${partNumber} of ${this.parts}`, error);
                cb && cb(error);
              }
            });
          }

          queue.start((error: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(flatten(queue.results));
            }
          });
        });

        this.loaded = this.total;
        this._broadcastProgress();

        return await this.completeMultiUpload(results);
      }
    } catch (error: any) {
      console.error('Failed to uploaded', this.file, error);
      throw new Error(`Failed to uploaded ${this.file.name} - ${error.message}`);
    }
  };
  /* eslint-enable sonarjs/cognitive-complexity */

  /**
   * Function used to invoke the handlers that are listeing for progress updats
   */
  private _onPartProgress = (progressBytes: number, info: PartInfo) => {
    this.loaded += progressBytes;
    if (info.isComplete) {
      this.partsLoaded++;
    }

    this._broadcastProgress();
  };

  private _broadcastProgress = () => {
    const progress = this.progress;
    const info: MultipartFileUploadProgressInfo = {
      progress,
      complete: this.complete,
      parts: this.parts,
      partsLoaded: this.partsLoaded,
      loaded: this.loaded,
      total: this.total,
    };
    this.onProgressEvents.forEach((fn) => fn(progress, info));
  };

  /**
   * Invokes the backend to initate the multipart upload process
   */
  private initiateMultipartUpload = async () => {
    const res = await api.postDataProductDomainDataProductFileUpload({
      contentType: getContentType(this.file) as PostDataProductDomainDataProductFileUploadContentTypeEnum,
      fileName: this.fileName,
      dataProductId: this.dataProductId,
      domainId: this.domainId,
    });

    this.uploadId = res.uploadId;
  };

  /**
   * Invokes the backend to complete the multipart upload
   * @param parts the list of parts being uploaded, with their respective etag
   * @returns bucket name and key where the file has been stored
   */
  private completeMultiUpload = async (parts: MultipartUploadPart[]) =>
    api.putDataProductDomainDataProductFileUpload({
      dataProductId: this.dataProductId,
      domainId: this.domainId,
      fileName: this.fileName,
      uploadId: this.uploadId,
      fileUploadInput: {
        parts,
      },
    });

  /**
   * Handle the upload of a single file part
   * @param partNumber the part number, starts from 0
   * @param blob the chunked file part
   * @returns resolves with etag and part number if upload if successful. Throws an error otherwise.
   */
  private startPartUpdate = async (partNumber: number, blob: any): Promise<MultipartUploadPart & S3Location> => {
    const result = await retry(
      async (bail) => {
        let contentType;
        try {
          contentType = getContentType(this.file) as GetDataProductDomainDataProductFileUploadContentTypeEnum;
          validateFileUploadSupportedType(this.fileName, contentType);
        } catch (error: any) {
          bail(error);
          return;
        }
        const { signedUrl, bucket, key } = await api.getDataProductDomainDataProductFileUpload({
          domainId: this.domainId,
          dataProductId: this.dataProductId,
          fileName: this.fileName,
          contentType,
          uploadId: this.isMultipart ? this.uploadId : undefined,
          partNumber: this.isMultipart ? partNumber : undefined,
        });

        const total: number = blob.size;
        let loaded = 0;

        const response = await axios.put(signedUrl, blob, {
          onUploadProgress: (event) => {
            const progress = calcProgressPercent(event.loaded, total);
            const delta = event.loaded - loaded;
            loaded = event.loaded;

            this._onPartProgress(delta, {
              partNumber,
              progress,
              total,
              loaded,
              isComplete: progress === 100,
            });
          },
        });

        if (response.status === 403) {
            // don't retry upon 403
            bail(new Error('Unauthorized'));
            return;
        }

        if (response.status !== 200) {
          throw new Error('Unexpected response status: ' + response.status);
        }

        return {
          bucket,
          key,
          etag: response.headers.etag,
          partNumber,
        };
      },
      {
        retries: 3,
        onRetry: (error, attempt) => {
          console.warn(`MultiparFileUpload: part ${partNumber} attempt ${attempt} failed:`, error);
        },
      },
    );

    if (result == null) {
      throw new Error(`Unexpected result of undefined for part ${partNumber}`);
    }

    return result;
  };
}
