/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { DockerImageCode, EcrImageCodeProps } from 'aws-cdk-lib/aws-lambda';
import {
  TarballImageAsset as OriginalTarballImageAsset,
  TarballImageAssetProps as OriginalTarballImageAssetProps,
} from 'aws-cdk-lib/aws-ecr-assets';
import { Stage } from 'aws-cdk-lib';

export type TarballImageAssetProps = OriginalTarballImageAssetProps;

/**
 * Wrapper for TarballImageAsset with workaround for https://github.com/aws/aws-cdk/issues/18044
 */
export class TarballImageAsset extends OriginalTarballImageAsset {
  constructor(scope: Construct, id: string, props: TarballImageAssetProps) {
    // WORKAROUND: https://github.com/aws/aws-cdk/issues/18044
    // Overwrite the asset output directory used by the TarballImageAsset construct to correct the location of the
    // asset to point the docker load command to.
    const stage = Stage.of(scope);
    const oldStageOf = Stage.of;
    if (stage) {
      // @ts-ignore Stage object used by TarballImageAsset only needs basic props
      Stage.of = () => ({
        ...stage,
        assetOutdir: stage.outdir,
      });
    }

    // Call super to create the asset (using the overwritten assetOutdir to generate the corrected docker command)
    super(scope, id, props);

    // Restore Stage.of to its original un-hacked implementation
    Stage.of = oldStageOf;
  }

  /**
   * Return a container image from a prebuilt tarball
   * @param tarballFile path to the tarball
   */
  public static containerImageFromTarball(tarballFile: string): ContainerImage {
    return {
      bind(scope, containerDefinition) {
        const asset = new TarballImageAsset(scope, 'Tarball', { tarballFile });
        asset.repository.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());
        return {
          imageName: asset.imageUri,
        };
      },
    };
  }

  /**
   * Create a docker image code from a prebuilt tarball
   * @param asset the tarball image asset
   * @param props other lambda image props
   */
  public static tarballImageCode(asset: TarballImageAsset, props?: Omit<EcrImageCodeProps, 'tag'>): DockerImageCode {
    return {
      _bind() {
        return {
          isInline: false,
          bindToResource() {
            /*this is intentional*/
          },
          bind() {
            return {
              image: {
                ...props,
                imageUri: asset.imageUri,
              },
            };
          },
        };
      },
    };
  }
}
