# Architecture

A customer runs an agent that generates an independent product: a backend on Bazis and a
frontend on React + TypeScript + Vite. bazis-front supplies the parts of the frontend that
must stay correct across products and be fixed in one place, and the rules for the parts
that the product owns.

## Layers

| Layer | What | Where it lives | How it changes |
|---|---|---|---|
| 0. Contract | TypeScript types of the product API | the product, `src/bazis/generated/` | regenerated from the live backend |
| 1. Protocol | the JSON:API protocol of Bazis | npm `@bazis/client` | package releases |
| 2. Hooks | data access for React | npm `@bazis/react` (planned) | package releases |
| 3. Components and screens | visual building blocks | copied into the product (planned) | edited in the product |
| 4. Project spec | product spec → screens → design tokens → implementation | the product (planned) | validated against the layers below |

### 0. Contract

The contract is generated from the OpenAPI of the product backend with
[openapi-typescript](https://openapi-ts.dev):

```bash
npx openapi-typescript openapi.json -o src/bazis/generated/schema.d.ts --default-non-nullable=false
```

`--default-non-nullable=false` is required: without it the fields with a server default
(`is_active`, `dt_created`) become required in the bodies of create.

The contract is never written by hand: when the backend changes, the types are
regenerated and the compiler shows every place of the frontend that must follow.

### 1. Protocol: `@bazis/client`

The protocol of Bazis is more than plain JSON:API, and every product would otherwise
reimplement it:

- one `filter` expression with its own grammar (`&`, `|`, groups, `~`) and encoding,
  instead of `filter[name]=`;
- `include` only on retrieve, create and update, not on list;
- relationship endpoints with `{data}` bodies in `application/json`;
- errors as JSON:API `errors` with `source.pointer`;
- runtime schemas (`schema_list`, `schema_create`, `schema_retrieve`, `schema_update`) and
  `route_filter_fields`;
- the token endpoint of bazis-users, the permission meta of bazis-permit and the transits
  of bazis-statusy.

`@bazis/client` implements these once. It is generic over the generated `paths` type of a
product, so the same release serves every product, and a fix reaches all of them through a
version update.

Operations are addressed by the path of a route set (`/api/v1/shop/order/`) and an item
id. The OpenAPI of Bazis will mark operations with
`x-bazis: {resource, route_set, action, kind}`; the client does not depend on it yet, and
its operations already follow the same split into resource, action and kind.

### 2. Hooks: `@bazis/react` (planned)

React hooks over the client: queries, mutations, cache invalidation, forms bound to the
runtime schemas.

### 3. Components and screens (planned)

Copied into the product, in the way of shadcn/ui, rather than imported: the product owns
and edits its look. They use only layers 0–2 for data.

### 4. Project spec (planned)

The product is described in layers: the product spec, the screens, the design tokens, the
implementation. Validators check every layer against the one above it and against the
contract.

## Principles

- **The backend is the source of truth.** The contract is generated from it; what the user
  may see and change is decided by it.
- **The frontend is not a security boundary.** Permissions live in the backend
  (bazis-permit). The frontend only adapts to them: the runtime schema `schema_update`
  shows which fields the current user may change, and the permission meta (`crud_actions`,
  `for_change`, `for_delete`, `for_create`) which actions he may take.
- **Protocol in packages, look in the product.** Code that must be correct everywhere is
  versioned; code that must differ between products is copied.
- **No hand-written contract.** Types that describe the backend are only generated.
