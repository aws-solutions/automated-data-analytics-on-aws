/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { BUILD_DIR, CLIENT_DIR, NPM_PACKAGE_NAME, OPENAPI_SPEC_FILE, PACKAGE_ROOT } from './constants';
import { pick } from 'lodash';
import { serializeArgs } from './utils';
import execa from 'execa';

export async function typescriptClient() {
  console.info('generating typescript client');
  const dir = path.join(BUILD_DIR, 'client/js');
  await fs.emptyDir(CLIENT_DIR);
  await fs.emptyDir(dir);

  const args = serializeArgs({
    // global: {
    // },
    additional: {
      npmName: NPM_PACKAGE_NAME,
      typescriptThreePlus: true,
      useSingleRequestParameter: true,
    },
  });

  // https://openapi-generator.tech/docs/usage#generate
  /* eslint-disable */
	await execa('openapi-generator-cli', [
		'generate',
		// '--verbose',
		'--log-to-stderr', // without this error messages are cryptic and not actionable
		'--generator-name', 'typescript-fetch',
		'--skip-operation-example',
		'--minimal-update',
		'--template-dir', path.resolve(__dirname, './templates/typescript-fetch'),
		'--config', path.resolve(__dirname, './generate-client.config.yaml'),
		...args,
		'--input-spec', OPENAPI_SPEC_FILE,
		'--output', dir,
	], {
		cwd: PACKAGE_ROOT,
		stdio: 'inherit',
	});
	console.log('typescript client generated:', dir)
	/* eslint-enable */

  // build the typescript client library
  console.log('building client:', dir, CLIENT_DIR);
  await execa(`yarn build --outDir ${CLIENT_DIR}`, { cwd: dir, shell: true, stdio: 'inherit' });

  const pkgJson = pick(require(`${dir}/package.json`), ['name', 'description', 'version', 'dependencies']);
  await fs.writeFile(path.join(CLIENT_DIR, 'package.json'), JSON.stringify(pkgJson, null, 2), { encoding: 'utf-8' });
  // link @ada/api-client package into workspace node_modules
  console.log('installing client dependencies:', dir, CLIENT_DIR);
  await execa('yarn install', { cwd: CLIENT_DIR, shell: true, stdio: 'inherit' });
}

export async function main() {
  await fs.ensureDir(CLIENT_DIR);

  await typescriptClient();
}

export default main;

if (process.argv[1] === __filename) {
  main()
    .then(() => console.log('generate openapi-client complete'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

/**
 * openapi-generator-cli generate - Generate code with the specified

OPTIONS
	-a <authorization>, --auth <authorization>
			adds authorization headers when fetching the OpenAPI definitions
			remotely. Pass in a URL-encoded string of name:header with a comma
			separating multiple values
	--api-name-suffix <api name suffix>
			Suffix that will be appended to all API names ('tags'). Default:
			Api. e.g. Pet => PetApi. Note: Only ruby, python, jaxrs generators
			support this feature at the moment.
	--api-package <api package>
			package for generated api classes
	--artifact-id <artifact id>
			artifactId in generated pom.xml. This also becomes part of the
			generated library's filename
	--artifact-version <artifact version>
			artifact version in generated pom.xml. This also becomes part of the
			generated library's filename
	-c <configuration file>, --config <configuration file>
			Path to configuration file. It can be JSON or YAML. If file is JSON,
			the content should have the format {"optionKey":"optionValue",
			"optionKey1":"optionValue1"...}. If file is YAML, the content should
			have the format optionKey: optionValue. Supported options can be
			different for each language. Run config-help -g {generator name}
			command for language-specific config options.
	--dry-run
			Try things out and report on potential changes (without actually
			making changes).
	-e <templating engine>, --engine <templating engine>
			templating engine: "mustache" (default) or "handlebars" (beta)
	--enable-post-process-file
			Enable post-processing file using environment variables.
	-g <generator name>, --generator-name <generator name>
			generator to use (see list command for list)
	--generate-alias-as-model
			Generate model implementation for aliases to map and array schemas.
			An 'alias' is an array, map, or list which is defined inline in a
			OpenAPI document and becomes a model in the generated code. A 'map'
			schema is an object that can have undeclared properties, i.e. the
			'additionalproperties' attribute is set on that object. An 'array'
			schema is a list of sub schemas in a OAS document
	--git-host <git host>
			Git host, e.g. gitlab.com.
	--git-repo-id <git repo id>
			Git repo ID, e.g. openapi-generator.
	--git-user-id <git user id>
			Git user ID, e.g. openapitools.
	--global-property <global properties>
			sets specified global properties (previously called 'system
			properties') in the format of name=value,name=value (or multiple
			options, each with name=value)
	--group-id <group id>
			groupId in generated pom.xml
	--http-user-agent <http user agent>
			HTTP user agent, e.g. codegen_csharp_api_client, default to
			'OpenAPI-Generator/{packageVersion}/{language}'
	-i <spec file>, --input-spec <spec file>
			location of the OpenAPI spec, as URL or file (required if not loaded
			via config using -c)
	--ignore-file-override <ignore file override location>
			Specifies an override location for the .openapi-generator-ignore
			file. Most useful on initial generation.
	--import-mappings <import mappings>
			specifies mappings between a given class and the import that should
			be used for that class in the format of type=import,type=import. You
			can also have multiple occurrences of this option.
	--instantiation-types <instantiation types>
			sets instantiation type mappings in the format of
			type=instantiatedType,type=instantiatedType.For example (in Java):
			array=ArrayList,map=HashMap. In other words array types will get
			instantiated as ArrayList in generated code. You can also have
			multiple occurrences of this option.
	--invoker-package <invoker package>
			root package for generated code
	--language-specific-primitives <language specific primitives>
			specifies additional language specific primitive types in the format
			of type1,type2,type3,type3. For example:
			String,boolean,Boolean,Double. You can also have multiple
			occurrences of this option.
	--legacy-discriminator-behavior
			Set to false for generators with better support for discriminators.
			(Python, Java, Go, PowerShell, C#have this enabled by default).
	--library <library>
			library template (sub-template)
	--log-to-stderr
			write all log messages (not just errors) to STDOUT. Useful for
			piping the JSON output of debug options (e.g. `--global-property
			debugOperations`) to an external parser directly while testing a
			generator.
	--minimal-update
			Only write output files that have changed.
	--model-name-prefix <model name prefix>
			Prefix that will be prepended to all model names.
	--model-name-suffix <model name suffix>
			Suffix that will be appended to all model names.
	--model-package <model package>
			package for generated models
	-o <output directory>, --output <output directory>
			where to write the generated files (current dir by default)
	-p <additional properties>, --additional-properties <additional
	properties>
			sets additional properties that can be referenced by the mustache
			templates in the format of name=value,name=value. You can also have
			multiple occurrences of this option.
	--package-name <package name>
			package for generated classes (where supported)
	--release-note <release note>
			Release note, default to 'Minor update'.
	--remove-operation-id-prefix
			Remove prefix of operationId, e.g. config_getId => getId
	--reserved-words-mappings <reserved word mappings>
			specifies how a reserved name should be escaped to. Otherwise, the
			default _<name> is used. For example id=identifier. You can also
			have multiple occurrences of this option.
	-s, --skip-overwrite
			specifies if the existing files should be overwritten during the
			generation.
	--server-variables <server variables>
			sets server variables overrides for spec documents which support
			variable templating of servers.
	--skip-operation-example
			Skip examples defined in operations to avoid out of memory errors.
	--skip-validate-spec
			Skips the default behavior of validating an input specification.
	--strict-spec <true/false strict behavior>
			'MUST' and 'SHALL' wording in OpenAPI spec is strictly adhered to.
			e.g. when false, no fixes will be applied to documents which pass
			validation but don't follow the spec.
	-t <template directory>, --template-dir <template directory>
			folder containing the template files
	--type-mappings <type mappings>
			sets mappings between OpenAPI spec types and generated code types in
			the format of OpenAPIType=generatedType,OpenAPIType=generatedType.
			For example: array=List,map=Map,string=String. You can also have
			multiple occurrences of this option.
	-v, --verbose
			verbose mode
 */
