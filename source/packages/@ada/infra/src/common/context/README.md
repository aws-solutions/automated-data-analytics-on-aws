# Solution Context

The solution utilizes [CDK Runtime Context](https://docs.aws.amazon.com/cdk/v2/guide/context.html) to configure additional functionaly and override defaults.

## List of support context properties

### `@ada/lambda:java/provisionedConcurrentExecutions`

Sets the provisioned current execution count for Java runtime lambdas.

> For **production** it is recommend to set this to greater than 0 based on usage.

> Default is _no provisioned concurrency_

```json
{
  "@ada/lambda:java/provisionedConcurrentExecutions": 1
}
```

### `@ada/kms:defaultRemovalPolicy`

Overrides the default `RemovalPolicy` of "destroy" for KMS keys.

Supported values are `retain` or `destroy`.

Even when AWS KMS Keys are marked as `destroy`, they will be retained for 30 days as per the default KMS Key waiting period. See [Deleting AWS KMS Keys](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html) for more details.

```json
{
  "@ada/kms:defaultRemovalPolicy": "retain"
}
```

### `@ada/waf:disableCloudfrontWebACLs`

Disables `CLOUDFRONT` base WAF WebACLs, which require deployment to `us-east-1` and may be blocked by organization or Control Tower policies.

```json
{
  "@ada/waf:disableCloudfrontWebACLs": true
}
```

### `@ada/waf:ipSet`

Provides list of CIDR IP address ranges to apply to WAF WebACLs rules to support restricting access to an explict allow-list.

This accept either partial [IPSet Configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-wafv2-ipset.html)
which requires `IPAddressVersion` and `Addresses` properties, or ARN values for both CLOUDFRONT and REGIONAL existing IPSets.

```json
{
  "@ada/waf:ipSet": {
    "IPAddressVersion": "IPV4",
    "Addresses": ["192.0.2.44/32", "192.0.0.0/16"]
  }
}
```

```json
{
  "@ada/waf:ipSet": {
    "CLOUDFRONT_ARN": "arn:aws:wafv2:us-east-1:<1111111111>:global/ipset/<IPSetName>/<ipset-uuid>",
    "REGIONAL_ARN": "arn:aws:wafv2:<region>:<1111111111>:regional/ipset/A<IPSetName>/<ipset-uuid>"
  }
}
```

### `@ada/vpc:cidr`

Customize the CIDR used for VPC. Default value is `192.168.0.0/16`

```json
{
  "@ada/vpc:cidr": "192.168.0.0/16"
}
```
