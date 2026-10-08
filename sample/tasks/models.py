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

from django.conf import settings
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from bazis.contrib.statusy import transit_before
from bazis.contrib.statusy.models_abstract import StatusyMixin, StatusyTransit
from bazis.core.models_abstract import DtMixin, JsonApiMixin, UuidMixin

from . import notify
from .schemas import FinishPayload


class Task(StatusyMixin, DtMixin, UuidMixin, JsonApiMixin):
    # not empty: the scenario `manager-cannot-save-an-empty-title` expects its error
    title = models.CharField(_('Title'), max_length=255, validators=[MinLengthValidator(1)])
    report = models.TextField(_('Report'), blank=True, default='')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, blank=True, null=True, on_delete=models.SET_NULL
    )
    # an uploaded file of bazis-uploadable: the relationship to `uploadable.file_upload`
    attachment = models.ForeignKey(
        'uploadable.FileUpload', verbose_name=_('Attachment'), blank=True, null=True,
        on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        verbose_name = _('Task')
        verbose_name_plural = _('Tasks')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        notify.changed(self)

    @transit_before('Save the report')
    def before_finish(self, statusy_transit: StatusyTransit, payload: FinishPayload):
        self.report = payload.report
        self.save()
        notify.finished(self)
