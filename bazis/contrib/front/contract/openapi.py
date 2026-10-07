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
The canonical form of the files of the contract and the hash of the operation surface of
the OpenAPI.
"""

import hashlib
import json


#: the parts of an operation that a client depends on; summaries, descriptions, tags and
#: operation ids are documentation and do not change the hash
OPERATION_KEYS = ('parameters', 'requestBody', 'responses', 'security', 'x-bazis')


def dumps(data) -> str:
    """
    The text of a file of the contract: sorted keys, two spaces, UTF-8, a trailing newline.
    The same data always gives the same text, so the files are compared as text.
    """
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + '\n'


def operation_surface(openapi: dict) -> dict:
    """
    What a client of the API depends on: the parameters, bodies, responses, security and
    `x-bazis` of every operation, the global security and the components.
    """
    return {
        'paths': {
            path: {
                method: {key: operation[key] for key in OPERATION_KEYS if key in operation}
                for method, operation in item.items()
                if isinstance(operation, dict)
            }
            for path, item in openapi.get('paths', {}).items()
        },
        'security': openapi.get('security'),
        'components': openapi.get('components', {}),
    }


def openapi_hash(openapi: dict) -> str:
    """
    `sha256:<hex>` of the canonical JSON of the operation surface.
    """
    canonical = json.dumps(
        operation_surface(openapi), sort_keys=True, separators=(',', ':'), ensure_ascii=False
    )
    return 'sha256:' + hashlib.sha256(canonical.encode('utf-8')).hexdigest()
