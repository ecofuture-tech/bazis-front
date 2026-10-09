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

import { OSM_TILES, type MapTiles } from '@/bazis/ui/map';

/** The name of the product (`product.name` of spec/product.yaml): the layout and the login show it. */
export const PRODUCT_NAME = 'Tasks';

/**
 * The tiles of the maps (`MapProvider`): those of OpenStreetMap with their attribution, for a
 * sample; a product in production sets those of its tile provider (and its CSP `img-src`).
 */
export const MAP_TILES: MapTiles = OSM_TILES;
