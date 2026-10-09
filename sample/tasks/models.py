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
from django.contrib.gis.db.models import PointField
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from bazis.contrib.permit.models_abstract import PermitModelMixin
from bazis.contrib.statusy import transit_before
from bazis.contrib.statusy.models_abstract import StatusyMixin, StatusyTransit
from bazis.contrib.ws.messages import notification, notify, publish_changed
from bazis.core.models_abstract import DtMixin, JsonApiMixin, UuidMixin

from .schemas import FinishPayload


class Task(StatusyMixin, DtMixin, UuidMixin, JsonApiMixin):
    class Priority(models.TextChoices):
        LOW = 'low', _('Low')
        NORMAL = 'normal', _('Normal')
        HIGH = 'high', _('High')

    # not empty: the scenario `manager-cannot-save-an-empty-title` expects its error
    title = models.CharField(_('Title'), max_length=255, validators=[MinLengthValidator(1)])
    report = models.TextField(_('Report'), blank=True, default='')
    # choices: the runtime schemas give their labels (`enumDict`) in the language of the
    # request, which the frontend shows, offers and filters by (`manager-sets-the-priority`)
    priority = models.CharField(_('Priority'), max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_('assignee'), blank=True, null=True,
        on_delete=models.SET_NULL,
    )
    # an uploaded file of bazis-uploadable: the relationship to `uploadable.file_upload`
    attachment = models.ForeignKey(
        'uploadable.FileUpload', verbose_name=_('Attachment'), blank=True, null=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    # a point (GeoJSON in the API): the field `type: point` of the specs, on the map of the
    # list of the tasks (`list.map`) and on the card; a geography, whose GiST index the
    # distances of the core use (`near`, and the sort by the distance)
    location = PointField(_('Location'), geography=True, blank=True, null=True)

    class Meta:
        verbose_name = _('Task')
        verbose_name_plural = _('Tasks')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # every client refetches the tasks: the resource on the common channel, never the id
        publish_changed(self)

    @transit_before('Save the report')
    def before_finish(self, statusy_transit: StatusyTransit, payload: FinishPayload):
        self.report = payload.report
        self.save()
        # only the assignee, who may see the task, in the language of his profile
        notify(self.assignee, lambda user: notification(_('Task finished'), self.title, self))


class Step(PermitModelMixin, DtMixin, UuidMixin, JsonApiMixin):
    """
    A step of a task: the related items of the card of a task (`card.related` of
    spec/screens/task-card.yaml), added from it with the task fixed (`manager-adds-a-step`).
    """

    task = models.ForeignKey(Task, verbose_name=_('Task'), on_delete=models.CASCADE, related_name='steps')
    title = models.CharField(_('Title'), max_length=255, validators=[MinLengthValidator(1)])

    class Meta:
        verbose_name = _('Step')
        verbose_name_plural = _('Steps')

    def validate_item(self, changes):
        # the card offers "add here" only while the task may be changed (a draft): the
        # backend refuses the others itself, 422 at the relationship to the task
        if (changes.is_new or 'task' in changes.fields) and self.task.status_id != 'draft':
            raise ValidationError({'task': _('A step is added to a draft task only')})
