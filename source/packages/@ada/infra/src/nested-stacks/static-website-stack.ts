/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as csp from 'csp-header';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Bucket } from '../common/constructs/s3/bucket';
import { BucketDeployment, ServerSideEncryption, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput, Duration, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExtendedNestedStack, addCfnNagSuppressions, getUniqueName, getUniqueNameWithSolution } from '@ada/cdk-core';
import { SolutionContext, getPackagePath, tryGetSolutionContext } from '@ada/infra-common';
import { WEBSITE_CONFIGURATION_FILE_NAME } from '@ada/infra-common/constructs/lambda/upload-website-configuration';
import { WebAclRuleProvider } from '@ada/infra-common/constructs/waf/WebAclRuleProvider';
import { minify } from 'uglify-js';
import CloudFrontWebAcl from '../common/constructs/waf/cloud-front-web-acl';

export interface StaticWebsiteStackProps extends NestedStackProps {
  readonly namespace: string;
  readonly accessLogsBucket: Bucket;
  /**
   * Additional Content-Security-Policy directives to apply.
   * The baseline CSP adds 'self' and other general amazon defaults, but not solution specific.
   * Currently only support 'connect-src'.
   */
  readonly contentSecurityPolicy: Partial<Pick<csp.CSPDirectives, 'connect-src'>>;
}

/**
 * Stack to define the infrastructure for the static website
 */
export class StaticWebsiteStack extends ExtendedNestedStack {
  public readonly cloudFrontDistribution: cloudfront.CloudFrontWebDistribution;

  public readonly websiteBucket: Bucket;

  public readonly bucketDeployment: BucketDeployment;

  public readonly callbackUrls: string[];

  public readonly logoutUrls: string[];

  constructor(scope: Construct, id: string, props: StaticWebsiteStackProps) {
    super(scope, id, props);

    // S3 Website
    this.websiteBucket = new Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'website-logs/',
      encryption: null, // use S3_MANAGED encryption for static website bucket
    });

    // Web ACL (unless disabled by the context)
    let webAcl: CloudFrontWebAcl | undefined;
    // apply WAF if it is not explicitly disabled
    if (!tryGetSolutionContext(this, SolutionContext.DISABLE_WAF_CLOUDFRONT_WEBACLS)) {
      webAcl = new CloudFrontWebAcl(this, 'CfWebACL', {
        name: getUniqueName(this, 'CloudFrontWebACL'),
        suffix: 'website-web-acl',
        rules: WebAclRuleProvider.getRulesForSdkCall(this, 'CLOUDFRONT'),
        accessLogsBucket: props.accessLogsBucket,
      });
    }

    // Cloudfront distribution
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, `CloudfrontOAI`);
    this.websiteBucket.grantRead(originAccessIdentity);

    const contentSecurityPolicy = csp.getCSP({
      directives: {
        'default-src': [csp.SELF],
        'script-src': [csp.SELF],
        'connect-src': [csp.SELF, ...(props.contentSecurityPolicy['connect-src'] || [])],
        'style-src': [
          csp.SELF,
          // support react styles
          csp.UNSAFE_INLINE,
        ],
        'img-src': [csp.SELF, 'awsstatic.com'],
        'object-src': [csp.SELF, 'awsstatic.com'],
      },
    });

    const viewerResponseFunction = new cloudfront.Function(this, 'ViewerResponseFunction', {
      // due to this CDK issue, https://github.com/aws/aws-cdk/issues/20017
      // the function name has to be specified explicitly to prevent the name from changing unexpectedly between cdk synth
      // Be aware of the 64 chars limit of the function name, the values in "application" and "stage" variables
      // in `source/packages/@ada/solution/bin/cdk-solution.ts` will be added in front of this name as prefix
      // and 10 chars of the hash value will be appended at the end.
      functionName: getUniqueNameWithSolution(this, 'WebsiteViewerResponse'),
      // Lambda@Edge does not support env vars so need to inject CSP values, and use minify to clean up comments
      code: cloudfront.FunctionCode.fromInline(
        minify(
          fs
            .readFileSync(require.resolve('./static-website-security-response-function'), {
              encoding: 'utf-8',
            })
            .replace('__CSP__', contentSecurityPolicy),
          {
            keep_fnames: true,
            mangle: false,
          },
        ).code,
      ),
    });

    this.cloudFrontDistribution = new cloudfront.CloudFrontWebDistribution(this, `CloudfrontDistribution`, {
      webACLId: webAcl?.webAclArn,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,

      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.websiteBucket,
            originAccessIdentity: originAccessIdentity,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              functionAssociations: [
                {
                  eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
                  function: viewerResponseFunction,
                },
              ],
            },
            {
              pathPattern: WEBSITE_CONFIGURATION_FILE_NAME,
              defaultTtl: Duration.millis(0),
              maxTtl: Duration.millis(0),
              minTtl: Duration.millis(0),
            },
          ],
        },
      ],
      loggingConfig: {
        bucket: props.accessLogsBucket,
        prefix: 'web-cloudfront-logs/',
      },
      // We need to redirect "key not found errors" to index.html for single page apps
      errorConfigurations: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
      ],
    });
    const cfnDistribution = this.cloudFrontDistribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addDependency(viewerResponseFunction.node.defaultChild as cloudfront.CfnFunction);
    addCfnNagSuppressions(cfnDistribution, [
      {
        id: 'W70',
        reason:
          'Since the distribution uses the CloudFront domain name, CloudFront automatically sets the security policy to TLSv1 regardless of the value of MinimumProtocolVersion',
      },
    ]);

    this.bucketDeployment = new BucketDeployment(this, `WebsiteDeployment`, {
      sources: [Source.asset(path.join(getPackagePath('website'), 'build'))],
      destinationBucket: this.websiteBucket,
      // Files in the distribution's edge caches will be invalidated after files are uploaded to the destination bucket.
      distribution: this.cloudFrontDistribution,
      serverSideEncryption: ServerSideEncryption.AES_256,
    });

    this.callbackUrls = [`https://${this.cloudFrontDistribution.distributionDomainName}`, 'http://localhost:3000'];
    this.logoutUrls = [`https://${this.cloudFrontDistribution.distributionDomainName}`, 'http://localhost:3000'];

    // Output
    new CfnOutput(this, 'CloudFrontUrl', {
      value: this.cloudFrontDistribution.distributionDomainName,
    });
  }
}

export default StaticWebsiteStack;
