// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { errorMessage as i18nErrorMessage } from '@/bazis/i18n';

/**
 * The text of an error of the backend in the language of the interface: `errorMessage` of
 * `@/bazis/i18n`, where it moved in 0.3.0.
 *
 * @deprecated Import `errorMessage` of `@/bazis/i18n`; this one is removed in 0.4.0.
 */
export const errorMessage = i18nErrorMessage;

export { DateInput, DatesProvider, useDates } from './dates.js';
export type { DateInputProps } from './dates.js';
export { FieldInput } from './field-input.js';
export type { FieldInputProps } from './field-input.js';
export { FieldValue, ItemValue, titleFromText } from './field-value.js';
export type { FieldValueProps, ItemValueProps } from './field-value.js';
export {
  choiceOptions,
  fieldTitle,
  fieldValue,
  formatValue,
  fromLocalDateTime,
  hasSearch,
  isLongText,
  isNumeric,
  isReverse,
  itemLabel,
  itemName,
  localizedName,
  permitted,
  resourceAt,
  routeOf,
  statusName,
  statusyModel,
  typeAt,
  useItemFields,
  useListFields,
  workflowStatuses,
} from './fields.js';
export type { FieldDisplay, Fields, ResourceObject } from './fields.js';
export {
  FILE_RESOURCES,
  FilesProvider,
  FileValue,
  FileView,
  formatSize,
  isFile,
  isImage,
  useFiles,
} from './files.js';
export type { ControlProps, FileControlProps, FileViewProps, UploadedFile } from './files.js';
export {
  formatPoint,
  geoJsonPoint,
  parsePoint,
  POINT_FIELDS,
  PointInput,
  pointOf,
  PointsProvider,
  usePoints,
} from './points.js';
export type { GeoJsonPoint, LatLng, PointControlProps } from './points.js';
export {
  text,
  useAnyFilterFields,
  useAnyItem,
  useAnyList,
  useAnyLists,
  useAnyRelated,
  useAnyResourceForm,
  useAnySchema,
} from './hooks.js';
export type { FilterFieldsDocument, ItemDocument, ListDocument, SavedDocument } from './hooks.js';
export { RelationLabel } from './relation.js';
export { SOFT_TONES, StatusLabel, statusTone } from './status.js';
export type { StatusLabelProps } from './status.js';
export { PICKER_PAGE, RelationListPicker, RelationPicker } from './relation-picker.js';
export type { RelationListPickerProps, RelationPickerProps } from './relation-picker.js';
