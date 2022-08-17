###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
"""
Apply mapping transformation

 flag is used to override the default behavior of applying mappings
which drops out fields that are not specified in the mapping. If keep fields is
set to True, then the fields that are not specified in the mapping are kept.

input_args = {"mapping" : [['source_field_name', 'target_field_name', 'target_field_type']]}
"""
def apply_transform(input_frame, input_args, glue_context, **kwargs):
    drop_fields = input_args.get("drop_fields", True)
    mappings_by_name = { args["oldName"]: args for args in input_args['mappings'] }
    dtypes = input_frame.toDF().dtypes
    mapping_args = []
    for dtype in dtypes:
        source_field_name = dtype[0]
        source_field_type = dtype[1]
        if source_field_name in mappings_by_name:
            mapping_args.append((source_field_name, source_field_type, mappings_by_name[source_field_name]['newName'], mappings_by_name[source_field_name]['newType']))
        elif not drop_fields:
            mapping_args.append((source_field_name, source_field_type, source_field_name, source_field_type))
    data = input_frame.apply_mapping(mappings=mapping_args)
    return [data]
