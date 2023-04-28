/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, Provider } from 'aws-cdk-lib/custom-resources';
import { Bucket } from '../../s3/bucket';
import { CFN_RESOURCE_TYPE, Details, ResourceProperties } from './types';
import { CfnResource, CustomResource, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Firehose, WAFV2 } from '@ada/aws-sdk';
import { TypescriptFunction } from '../../lambda';
import {
  addCfnNagSuppressions,
  addCfnNagSuppressionsToRolePolicy,
  getUniqueWafFirehoseDeliveryStreamName,
} from '@ada/cdk-core';

export interface CloudFrontWebAclProps {
  readonly name: string;
  readonly suffix: string;
  readonly rules: WAFV2.Rules;
  readonly accessLogsBucket: Bucket;
}

/**
 * This construct creates a WAFv2 Web ACL for cloudfront in the us-east-1 region (required for cloudfront) no matter the
 * region of the parent cloudformation/cdk stack.
 */
export default class CloudFrontWebAcl extends Construct {
  public readonly webAclId: string;
  public readonly webAclArn: string;
  public readonly name: string;
  public readonly region: string = 'us-east-1';

  constructor(scope: Construct, id: string, props: CloudFrontWebAclProps) {
    super(scope, id);

    this.name = props.name;

    const deliveryStreamRole = new Role(this, 'FirehoseToS3Role', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    });
    props.accessLogsBucket.grantWrite(deliveryStreamRole);

    // delivery stream name must start with aws-waf-logs
    const deliveryStreamName = getUniqueWafFirehoseDeliveryStreamName(this, `cf-ds-${props.suffix}`);
    const createDeliveryStream: Firehose.Types.CreateDeliveryStreamInput = {
      DeliveryStreamName: deliveryStreamName,
      DeliveryStreamEncryptionConfigurationInput: {
        KeyType: 'AWS_OWNED_CMK',
      },
      S3DestinationConfiguration: {
        BucketARN: props.accessLogsBucket.bucketArn,
        RoleARN: deliveryStreamRole.roleArn,
        Prefix: `waf-cloudfront-${props.suffix}-logs/`,
        ErrorOutputPrefix: `waf-cloudfront-${props.suffix}-errors/`,
        BufferingHints: {
          // max values
          IntervalInSeconds: 900,
          SizeInMBs: 128,
        },
      },
    };
    const deleteDeliveryStream: Firehose.Types.DeleteDeliveryStreamInput = {
      DeliveryStreamName: deliveryStreamName,
      AllowForceDelete: true,
    };

    const deliveryStreamResource = new AwsCustomResource(this, 'DeliveryStream', {
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['firehose:CreateDeliveryStream', 'firehose:DeleteDeliveryStream'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [deliveryStreamRole.roleArn],
        }),
      ]),
      onCreate: {
        service: 'Firehose',
        action: 'createDeliveryStream',
        parameters: createDeliveryStream,
        region: this.region,
        physicalResourceId: PhysicalResourceId.fromResponse('DeliveryStreamARN'),
      },
      onDelete: {
        service: 'Firehose',
        action: 'deleteDeliveryStream',
        parameters: deleteDeliveryStream,
        region: this.region,
      },
    });
    addCfnNagSuppressions(
      deliveryStreamResource.node.findChild('CustomResourcePolicy').node.defaultChild as CfnResource,
      [
        {
          id: 'W12',
          reason: 'Firehose requires * permissions for creating a delivery stream',
        },
      ],
    );

    const customResource = deliveryStreamResource.node.findChild('Resource').node.defaultChild as CfnResource;
    const deliveryStreamArn = Fn.ref(customResource.logicalId);

    // Create the Web ACL
    const handler = new TypescriptFunction(this, 'Handler', {
      handlerFile: require.resolve('./handler'),
    });
    handler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['wafv2:CreateWebACL', 'wafv2:DeleteWebACL', 'wafv2:GetWebACL', 'wafv2:UpdateWebACL'],
        resources: ['*'],
      }),
    );
    addCfnNagSuppressionsToRolePolicy(handler.role!, [
      {
        id: 'W12',
        reason: '* resource required for creating the web acl',
      },
    ]);

    const webAclProvider = new Provider(this, 'WafProvider', {
      onEventHandler: handler,
    });
    const webAcl = new CustomResource(this, 'WafWebAcl', {
      serviceToken: webAclProvider.serviceToken,
      resourceType: CFN_RESOURCE_TYPE,
      properties: {
        Details: JSON.stringify({
          Name: this.name,
          DefaultAction: { Allow: {} },
          VisibilityConfig: {
            CloudWatchMetricsEnabled: true,
            MetricName: id,
            SampledRequestsEnabled: true,
          },
          Rules: props.rules,
        } as Details),
      } as ResourceProperties,
    });
    this.webAclId = webAcl.getAttString('Id');
    this.webAclArn = webAcl.getAttString('ARN');

    const putLoggingConfiguration: WAFV2.Types.PutLoggingConfigurationRequest = {
      LoggingConfiguration: {
        LogDestinationConfigs: [deliveryStreamArn],
        ResourceArn: this.webAclArn,
      },
    };
    // Add logging
    const addLoggingCustomResource = new AwsCustomResource(this, 'PutLoggingConfiguration', {
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iam:CreateServiceLinkedRole'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['wafv2:PutLoggingConfiguration'],
          resources: ['*'],
        }),
      ]),
      onCreate: {
        service: 'WAFV2',
        action: 'putLoggingConfiguration',
        parameters: putLoggingConfiguration,
        region: this.region,
        physicalResourceId: PhysicalResourceId.fromResponse('LoggingConfiguration.ResourceArn'),
      },
    });
    addCfnNagSuppressions(
      addLoggingCustomResource.node.findChild('CustomResourcePolicy').node.defaultChild as CfnResource,
      [
        {
          id: 'W12',
          reason: '* resource required for creating a service linked role',
        },
      ],
    );
  }
}
