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
The canonical form of the files of the contract.
"""

import json


def dumps(data) -> str:
    """
    The text of a file of the contract: sorted keys, two spaces, UTF-8, a trailing newline.
    The same data always gives the same text, so the files are compared as text.
    """
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + '\n'
