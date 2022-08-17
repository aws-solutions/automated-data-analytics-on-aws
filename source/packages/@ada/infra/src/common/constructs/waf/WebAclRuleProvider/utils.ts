/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export function toSdkPropertyNames(obj: any, parentKey?: string): any {
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((x) => toSdkPropertyNames(x, parentKey));
  }
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (key.toLowerCase() === 'ipsetreferencestatement') {
      // convert ipSetReferenceStatement=>IPSetReferenceStatement (IP*** rather than Ip***)
      newObj['IPSetReferenceStatement'] = toSdkPropertyNames(value, 'IPSetReferenceStatement');
    } else if (key.toLowerCase() === 'arn' && parentKey?.toLowerCase() === 'ipsetreferencestatement') {
      // IPSetReferenceStatement.ARN in SDK call must be caps no pascal
      newObj['ARN'] = toSdkPropertyNames(value, 'ARN');
    } else {
      const first = key.charAt(0).toUpperCase();
      const newKey = first + key.slice(1);
      newObj[newKey] = toSdkPropertyNames(value, newKey);
    }
  }
  return newObj;
}
