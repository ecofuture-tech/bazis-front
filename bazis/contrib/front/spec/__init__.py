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
The specs of a product, `spec/` in its root: `product.yaml` (roles, entities, access,
scenarios), `screens/<id>.yaml` and `design/` (`theme.yaml`, `tokens.json`). Their JSON
Schemas are in `schemas/`; `validate.validate` checks them against each other and against
`contract/contract.json`. Bazis imports this package while it configures the settings:
nothing here imports a model, the database or the core at the module level.
"""
