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

from uuid import UUID

from django.utils.translation import gettext_lazy as _

from pydantic import BaseModel, Field

from bazis.contrib.uploadable.schemas import UploadedFileId


class FinishPayload(BaseModel):
    report: str
    # the photos of the work, uploaded in the dialog of the transit (`type: file, many: true` of
    # the payload in the specs): the ids that the uploads of the user answered
    photos: list[UploadedFileId] = Field([], title=_('Photos'))


class ReopenPayload(BaseModel):
    # named as the relationship of the task: the dialog of the transit asks for the user with
    # its picker (`relation: user` of the payload in the specs), titled in the language of the user
    assignee: UUID = Field(title=_('Assignee'))
