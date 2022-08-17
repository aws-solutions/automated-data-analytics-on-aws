/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LensIds, OntologyNamespace } from '@ada/common';
import { Ontology as OntologyAttribute } from '@ada/api';

/**
 * Common attributes for all default pii ontologies
 */
export const commonDefaultPiiAttributes = {
  ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
  aliases: [],
  defaultLens: LensIds.HASHED,
};

/**
 * A set of default Pii classified ontologies
 */
export const defaultPiiOntologies: OntologyAttribute[] = [
  {
    name: 'ADDRESS',
    description: `A physical address, such as "100 Main Street, Anytown, USA" or "Suite #12, Building 123". An address can include a street, building, location, city, state, country, county, zip, precinct, neighborhood, and more.`,
    ontologyId: 'address',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'AGE',
    description: `An individual's age, including the quantity and unit of time. For example, in the phrase "I am 40 years old," Amazon Comprehend recognizes "40 years" as an age.`,
    ontologyId: 'age',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'AWS ACCESS KEY',
    description: `A unique identifier that's associated with a secret access key; the access key ID and secret access key are used together to sign programmatic AWS requests cryptographically.`,
    ontologyId: 'aws_access_key',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'AWS SECRET KEY',
    description: `A unique identifier that's associated with an access key; the access key ID and secret access key are used together to sign programmatic AWS requests cryptographically.`,
    ontologyId: 'aws_secret_key',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'BANK ACCOUNT NUMBER',
    description: `A US bank account number. These are typically between 10 - 12 digits long, but Amazon Comprehend also recognizes bank account numbers when only the last 4 digits are present.`,
    ontologyId: 'bank_account_number',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'BANK ROUTING',
    description: `A US bank account routing number. These are typically 9 digits long, but Amazon Comprehend also recognizes routing numbers when only the last 4 digits are present.`,
    ontologyId: 'bank_routing',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'CREDIT DEBIT CVV',
    description: `A 3-digit card verification code (CVV) that is present on VISA, MasterCard, and Discover credit and debit cards. In American Express credit or debit cards, it is a 4-digit numeric code.`,
    ontologyId: 'credit_debit_cvv',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'CREDIT DEBIT EXPIRY',
    description: `The expiration date for a credit or debit card. This number is usually 4 digits long and formatted as month/year or MM/YY. For example, Amazon Comprehend can recognize expiration dates such as 01/21, 01/2021, and Jan 2021.`,
    ontologyId: 'credit_debit_expiry',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'CREDIT DEBIT NUMBER',
    description: `The number for a credit or debit card. These numbers can vary from 13 to 16 digits in length, but Amazon Comprehend also recognizes credit or debit card numbers when only the last 4 digits are present.`,
    ontologyId: 'credit_debit_number',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'DATE TIME',
    description: `A date can include a year, month, day, day of week, or time of day. For example, Amazon Comprehend recognizes "January 19, 2020" or "11 am" as dates. Amazon Comprehend will recognize partial dates, date ranges, and date intervals. It will also recognize decades, such as "the 1990s".`,
    ontologyId: 'date_time',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'DRIVER ID',
    description: `The number assigned to a driver's license, which is an official document permitting an individual to operate one or more motorized vehicles on a public road. A driver's license number consists of alphanumeric characters.`,
    ontologyId: 'driver_id',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'EMAIL',
    description: `An email address.`,
    ontologyId: 'email',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'IP ADDRESS',
    description: `An IPv4 address, such as 198.51.100.0.`,
    ontologyId: 'ip_address',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'MAC ADDRESS',
    description: `A media access control (MAC) address is a unique identifier assigned to a network interface controller (NIC).`,
    ontologyId: 'mac_address',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'NAME',
    description: `An individual's name. This entity type does not include titles, such as Mr., Mrs., Miss, or Dr. Amazon Comprehend does not apply this entity type to names that are part of organizations or addresses. For example, Amazon Comprehend recognizes the "John Doe Organization" as an organization, and it recognizes "Jane Doe Street" as an address.`,
    ontologyId: 'name',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'PASSPORT NUMBER',
    description: `A US passport number. Passport numbers range from 6 - 9 alphanumeric characters.`,
    ontologyId: 'passport_number',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'PASSWORD',
    description: `An alphanumeric string that is used as a password, such as "*very20special#pass*".`,
    ontologyId: 'password',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'PHONE',
    description: `A phone number. This entity type also includes fax and pager numbers.`,
    ontologyId: 'phone',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'PIN',
    description: `A 4-digit personal identification number (PIN) that allows someone to access their bank account information.`,
    ontologyId: 'pin',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'SSN',
    description: `A Social Security Number (SSN) is a 9-digit number that is issued to US citizens, permanent residents, and temporary working residents. Amazon Comprehend also recognizes Social Security Numbers when only the last 4 digits are present.`,
    ontologyId: 'ssn',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'URL',
    description: `A web address, such as www.example.com.`,
    ontologyId: 'url',
    ...commonDefaultPiiAttributes,
  },
  {
    name: 'USERNAME',
    description: `A user name that identifies an account, such as a login name, screen name, nick name, or handle.`,
    ontologyId: 'username',
    ...commonDefaultPiiAttributes,
  },
];
