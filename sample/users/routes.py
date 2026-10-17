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

from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from bazis.contrib.users.models_abstract import UserMixin
from bazis.contrib.users.routes import UserRouteSet as UserRouteSetBase
from bazis.core.schemas import CrudAccessAction, SchemaField, SchemaFields
from bazis.core.schemas.enums import RouteKind


class UserRouteSet(UserRouteSetBase):
    """
    The users of bazis-users, searched by their username and their names: the frontend picks
    the assignee and the watchers of a task with a search of their labels, the first and the
    last name of a user who has them (the core 2.9 answers a search of a route set without
    `search_fields` with 400; every word of a search is in one of the fields). Declared after
    the bundled route set, it is the default route of the user model.

    The users of the team pick each other: a signed-in user views and links every active user
    (and himself), in the list and the items of this route (the pickers, the labels) and in
    the relationships, `included` and the filters of the other routes (`restrict_queryset`,
    which the core calls on the default route of the user model); an inactive user is seen by
    staff only (403 `ERR_RELATION_ACCESS` for another user who links him). Who changes a user
    stays the rule of bazis-users: staff every user, another user only himself.
    """

    search_fields = ['username', 'first_name', 'last_name']

    # the `verbose_name` of the username of Django is its name in English: the title of the
    # field in the contract would be its name (S018)
    fields = {None: SchemaFields(include={'username': SchemaField(title=_('Username'))})}

    @classmethod
    def restrict_queryset(cls, qs, access_action, user=None, **kwargs):
        if user is None:
            user = UserMixin.CTX_USER_REQUEST.get()
        if getattr(user, 'is_authenticated', False) is not True:
            return qs.none()
        if user.is_staff:
            return qs
        if access_action == CrudAccessAction.VIEW:
            return qs.filter(Q(is_active=True) | Q(pk=user.pk))
        return qs.filter(pk=user.pk)

    def get_queryset(self):
        # the reads of this route show the users of the team; its changes keep the rule of
        # bazis-users (its `get_queryset`)
        if self.route_ctx.kind in (RouteKind.COLLECTION, RouteKind.ITEM):
            return type(self).restrict_queryset(
                super(UserRouteSetBase, self).get_queryset(), CrudAccessAction.VIEW, user=self.inject.user
            )
        return super().get_queryset()
