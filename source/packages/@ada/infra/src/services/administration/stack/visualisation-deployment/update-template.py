import sys
from collections import OrderedDict
from cfn_tools import load_yaml, dump_yaml

if len(sys.argv) != 7:
    print("Number of arguments is incorrect")

print(sys.argv)
source_file = sys.argv[1]
output_file = sys.argv[2]
postgres_image = sys.argv[3]
node_image = sys.argv[4]
app_image = sys.argv[5]
ada_athena_proxy_url = sys.argv[6]

with open(source_file) as f:
    template = load_yaml(f.read())

ada_endpoint_value = OrderedDict([('Name','AWS_ENDPOINT_URL_ATHENA'), ('Value', ada_athena_proxy_url)])

# DB container
template['Resources']['DbTaskDefinition']['Properties']['ContainerDefinitions'][1]['Image'] = postgres_image

# app container
superset_task_def = template['Resources']['SupersetTaskDefinition']['Properties']['ContainerDefinitions'][1]
superset_task_def['Image'] = app_image
for env_variable in superset_task_def['Environment']:
    if env_variable['Name'] == 'SUPERSET_ENV':
        env_variable['Value'] = "production"
ada_endpoint_value_entry = superset_task_def['Environment'][0].copy()
ada_endpoint_value_entry['Name'] = 'AWS_ENDPOINT_URL_ATHENA'
ada_endpoint_value_entry['Value'] = ada_athena_proxy_url
superset_task_def['Environment'].append(ada_endpoint_value_entry)

# init task container
superset_init_task_def = template['Resources']['SupersetinitTaskDefinition']['Properties']['ContainerDefinitions'][1]
superset_init_task_def['Image'] = app_image
superset_init_task_def['Environment'].append(ada_endpoint_value_entry.copy())

# node container
template['Resources']['SupersetnodeTaskDefinition']['Properties']['ContainerDefinitions'][1]['Image'] = node_image

# worker container 
superset_worker_container = template['Resources']['SupersetworkerTaskDefinition']['Properties']['ContainerDefinitions'][1]
superset_worker_container['Image'] = app_image
superset_worker_container['Environment'].append(ada_endpoint_value_entry.copy())

# workerbeat container
superset_worker_beat_container = template['Resources']['SupersetworkerbeatTaskDefinition']['Properties']['ContainerDefinitions'][1]
superset_worker_beat_container['Image'] = app_image
superset_worker_beat_container['Environment'].append(ada_endpoint_value_entry.copy())

# output the new template
output = open(output_file, "w")
output.write(dump_yaml(template))
output.close()