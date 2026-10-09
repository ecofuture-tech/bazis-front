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

// The contract of the maps: `map:<entity>` with a marker `marker:<id>` per item with a point
// (a click opens it), the tiles of `MapProvider` (OpenStreetMap by default), the map of a point
// field in the forms (a click places the point, given as GeoJSON). Leaflet is replaced by a fake
// that records what the components ask of it: jsdom draws no map. Keep it passing when the
// component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import type { FormField } from '@/bazis/react';
import { MapProvider, nearFilter, OSM_TILES, ResourceMap } from '@/bazis/ui/map';
import { FieldInput } from '@/bazis/ui/resource';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

interface Handler {
  (event?: unknown): void;
}

const fake = vi.hoisted(() => {
  const state = {
    maps: [] as FakeMap[],
    tiles: [] as { url: string; options: Record<string, unknown> }[],
    markers: [] as FakeMarker[],
  };

  class Events {
    readonly handlers = new Map<string, Handler>();
    on(event: string, handler: Handler) {
      this.handlers.set(event, handler);
      return this;
    }
    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload);
    }
  }

  class FakeMap extends Events {
    removed = false;
    view: unknown = null;
    constructor(readonly element: HTMLElement) {
      super();
    }
    setView(center: unknown, zoom: number) {
      this.view = { center, zoom };
      return this;
    }
    fitBounds(bounds: unknown) {
      this.view = { bounds };
      return this;
    }
    getZoom() {
      return 2;
    }
    remove() {
      this.removed = true;
    }
  }

  class FakeGroup {
    readonly markers: FakeMarker[] = [];
    map: FakeMap | null = null;
    addTo(map: FakeMap) {
      this.map = map;
      return this;
    }
    clearLayers() {
      for (const marker of this.markers.splice(0)) marker.element.remove();
    }
  }

  class FakeMarker extends Events {
    readonly element = document.createElement('span');
    tooltip: unknown = null;
    constructor(
      readonly position: [number, number],
      readonly options: Record<string, unknown>,
    ) {
      super();
      this.element.addEventListener('click', () => {
        this.fire('click');
      });
    }
    bindTooltip(content: unknown) {
      this.tooltip = content;
      return this;
    }
    addTo(group: FakeGroup) {
      group.markers.push(this);
      group.map?.element.append(this.element);
      state.markers.push(this);
      return this;
    }
    getElement() {
      return this.element;
    }
  }

  const L = {
    map: (element: HTMLElement) => {
      const map = new FakeMap(element);
      state.maps.push(map);
      return map;
    },
    tileLayer: (url: string, options: Record<string, unknown>) => {
      state.tiles.push({ url, options });
      return { addTo: () => undefined };
    },
    layerGroup: () => new FakeGroup(),
    circleMarker: (position: [number, number], options: Record<string, unknown>) => new FakeMarker(position, options),
  };
  return { state, L };
});

vi.mock('leaflet', () => ({ default: fake.L }));

beforeEach(() => {
  fake.state.maps.length = 0;
  fake.state.tiles.length = 0;
  fake.state.markers.length = 0;
});

const point = (latitude: number, longitude: number) => ({ type: 'Point', coordinates: [longitude, latitude] });

const items = listDocument([
  resource('a', { name: 'North', location: point(55.75, 37.62) }),
  resource('b', { name: 'Nowhere', location: null }),
  resource('c', { name: 'South', location: point(-33.86, 151.21) }),
]);

describe('ResourceMap', () => {
  it('is busy until its items are loaded', () => {
    renderWithBazis(<ResourceMap path={ITEMS as never} entity="item" field="location" />, new Backend().hold('GET', ITEMS));
    expect(screen.getByTestId('map:item').getAttribute('aria-busy')).toBe('true');
    expect(fake.state.maps).toHaveLength(0);
  });

  it('puts the items with a point on the map, and a click opens one', async () => {
    const backend = new Backend().on('GET', ITEMS, items);
    const onOpen = vi.fn();
    renderWithBazis(
      <ResourceMap path={ITEMS as never} entity="item" field="location" filter={Filter.where('kind', 'site')} onOpen={onOpen} selected="c" />,
      backend,
    );
    expect(await screen.findByTestId('marker:a')).toBeTruthy();
    expect(screen.getByTestId('map:item').getAttribute('aria-busy')).toBeNull();
    expect(screen.queryByTestId('marker:b')).toBeNull();
    expect(fake.state.markers.map((it) => it.position)).toEqual([
      [55.75, 37.62],
      [-33.86, 151.21],
    ]);
    // the label of the item as the text of its tooltip; the open item drawn larger
    expect(fake.state.markers.map((it) => (it.tooltip as HTMLElement).textContent)).toEqual(['North', 'South']);
    expect((fake.state.markers[1]?.options.radius as number) > (fake.state.markers[0]?.options.radius as number)).toBe(true);
    expect(backend.requests('GET')).toEqual([`GET ${ITEMS}?filter=kind%3Dsite&page%5Blimit%5D=200`]);
    // the tiles of OpenStreetMap with their attribution, without a provider
    expect(fake.state.tiles).toEqual([{ url: OSM_TILES.url, options: expect.objectContaining({ attribution: OSM_TILES.attribution }) as unknown }]);

    fireEvent.click(screen.getByTestId('marker:c'));
    expect(onOpen).toHaveBeenCalledWith('c');
  });

  it('says that no item has a point', async () => {
    const backend = new Backend().on('GET', ITEMS, listDocument([resource('b', { name: 'Nowhere' })]));
    renderWithBazis(<ResourceMap path={ITEMS as never} entity="item" field="location" emptyMessage="No sites" />, backend);
    expect(await screen.findByText('No sites')).toBeTruthy();
    expect(screen.getByTestId('map:item')).toBeTruthy();
    expect(fake.state.markers).toHaveLength(0);
  });

  it('shows the error of its list', async () => {
    const backend = new Backend().on('GET', ITEMS, errors(403), 403);
    renderWithBazis(<ResourceMap path={ITEMS as never} entity="item" field="location" />, backend);
    expect(await screen.findByTestId('state:forbidden')).toBeTruthy();
  });

  it('draws the tiles of the provider', async () => {
    const tiles = { url: 'https://tiles.example.test/{z}/{x}/{y}.png', attribution: 'Example tiles' };
    renderWithBazis(
      <MapProvider tiles={tiles}>
        <ResourceMap path={ITEMS as never} entity="item" field="location" />
      </MapProvider>,
      new Backend().on('GET', ITEMS, items),
    );
    expect(await screen.findByTestId('marker:a')).toBeTruthy();
    expect(fake.state.tiles).toEqual([{ url: tiles.url, options: expect.objectContaining({ attribution: 'Example tiles' }) as unknown }]);
  });
});

describe('the map of a point field', () => {
  const location: FormField = {
    kind: 'attribute', name: 'location', title: 'Location', required: false, readOnly: false, nullable: true,
    type: 'object', format: null, enum: null, labels: null, schema: {},
  };

  // the value of the field, as a form keeps it
  function Controlled({ onChange }: { onChange: (value: unknown) => void }) {
    const [value, setValue] = useState<unknown>(null);
    return (
      <FieldInput
        path={ITEMS}
        field={location}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it('places the point with a click on the map, and shows the point typed', async () => {
    const onChange = vi.fn();
    renderWithBazis(
      <MapProvider points={{ [ITEMS]: ['location'] }}>
        <Controlled onChange={onChange} />
      </MapProvider>,
      new Backend(),
    );
    const input = screen.getByTestId<HTMLInputElement>('field:location');
    expect(screen.getByTestId('map:location')).toBeTruthy();
    fake.state.maps.at(-1)?.fire('click', { latlng: { lat: 10.5, lng: 20 } });
    await waitFor(() => {
      expect(input.value).toBe('10.5, 20');
    });
    expect(onChange).toHaveBeenLastCalledWith(point(10.5, 20));
    expect(fake.state.markers.at(-1)?.position).toEqual([10.5, 20]);
    fireEvent.change(input, { target: { value: '-33.86 151.21' } });
    expect(onChange).toHaveBeenLastCalledWith(point(-33.86, 151.21));
    expect(fake.state.markers.at(-1)?.position).toEqual([-33.86, 151.21]);
  });

  it('is not placed on a read-only field', () => {
    const onChange = vi.fn();
    renderWithBazis(
      <MapProvider points={{ [ITEMS]: ['location'] }}>
        <FieldInput path={ITEMS} field={{ ...location, readOnly: true }} value={point(1, 2)} onChange={onChange} />
      </MapProvider>,
      new Backend(),
    );
    fake.state.maps.at(-1)?.fire('click', { latlng: { lat: 10.5, lng: 20 } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('action:locate-location')).toBeNull();
  });
});

describe('nearFilter', () => {
  it('is the lookup near of the core: longitude, latitude, meters', () => {
    expect(nearFilter('location', { latitude: 55.75, longitude: 37.62 }, 1500.4).toString()).toBe(
      'location__near=37.62,55.75,1500',
    );
  });
});
