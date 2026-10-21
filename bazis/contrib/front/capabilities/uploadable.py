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
bazis-uploadable: the resources whose files are uploaded with multipart form data (a route
set of the application that is `FileUploadRouteSet` or a subclass of it, with its create),
the size limit of an upload, and whether guests upload files, with the types they may
(bazis-uploadable 2.8). A model references an uploaded file with a foreign key to such a
model: its relationship to the resource is a file field.
"""

from django.conf import settings

from bazis.core.introspect import route_sets


def anonymous() -> bool:
    """
    Whether guests upload files: `anonymous_uploads()` of bazis-uploadable 2.8
    (`BAZIS_FILE_UPLOAD_ANONYMOUS` with a size limit). Never with bazis-uploadable 2.7, the
    oldest version that the assets follow (`CAPABILITIES`), which has no anonymous uploads:
    the import goes once that is 2.8.
    """
    try:
        from bazis.contrib.uploadable.routes import anonymous_uploads
    except ImportError:
        return False
    return anonymous_uploads()


def section() -> dict:
    from bazis.contrib.uploadable.routes import FileUploadRouteSet
    from bazis.core.app import app

    resources = {
        route_set.model.get_resource_label()
        for route_set, routes in route_sets(app).items()
        if issubclass(route_set, FileUploadRouteSet)
        and any(it.get('action') == 'action_create' for it in routes)
    }
    guests = anonymous()
    return {
        # BAZIS_FILE_UPLOAD_MAX_SIZE: 0 is no limit
        'max_size': settings.BAZIS_FILE_UPLOAD_MAX_SIZE or None,
        'resources': sorted(resources),
        'anonymous': guests,
        # the media types of the files of the guests, recognized by their content
        'anonymous_types': list(settings.BAZIS_FILE_UPLOAD_ANONYMOUS_TYPES) if guests else [],
    }
