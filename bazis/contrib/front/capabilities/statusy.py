# Copyright 2026 EcoFuture Technology Services LLC and contributors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
bazis-statusy: the statuses and the transits of every statusy model, from the database,
with the JSON Schema of the payload a transit requires.
"""

from django.apps import apps
from django.conf import settings

from bazis.contrib.statusy.models_abstract import StatusyMixin


def section() -> dict:
    status_model = apps.get_model(settings.BAZIS_STATUSY_STATUS_MODEL)
    initial_id, initial_name = settings.BAZIS_STATUS_INITIAL
    models = {}
    for model in apps.get_models():
        if not issubclass(model, StatusyMixin):
            continue
        transits = sorted(model.get_model_transits(), key=lambda it: it.id)
        ids = {initial_id} | {it.status_src_id for it in transits} | {it.status_dst_id for it in transits}
        statuses = status_model.objects.in_bulk(ids)
        models[model.get_resource_label()] = {
            'initial': initial_id,
            'statuses': [
                {
                    'id': pk,
                    # the initial status has no row until the first object is created
                    'name': statuses[pk].name if pk in statuses else initial_name,
                }
                for pk in sorted(ids)
            ],
            'transits': [
                {
                    'id': transit.id,
                    'name': transit.name,
                    'src': transit.status_src_id,
                    'dst': transit.status_dst_id,
                    'payload': _payload(model, transit),
                }
                for transit in transits
            ],
        }
    return {'models': dict(sorted(models.items()))}


def _payload(model, transit) -> dict | None:
    """
    The payload of a transit: required with its JSON Schema when a validator or an action
    of the transit takes a typed `payload`, else None.
    """
    # the type depends only on the methods of the model that the transit lists: the class
    # stands in for an object (an object would compute its default status in the database)
    payload_type = model.transit_payload_type(model, transit)
    if payload_type is None:
        return None
    schema = payload_type.model_json_schema()
    # the combined type is named after the ids of its bases, which change in every process
    schema.pop('title', None)
    if 'required' in schema:
        schema['required'] = sorted(schema['required'])
    return {'required': True, 'schema': schema}
