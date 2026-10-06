# bazis-front — guide for AI agents

How to build the frontend of a product on Bazis with the bazis-front packages. The layers
and the reasons behind these rules are in `docs/architecture.md`.

## Rules

- **Generate the contract, never write it.** The types of the backend API come from its
  OpenAPI through openapi-typescript with `--default-non-nullable=false`, into
  `src/bazis/generated/`. Regenerate them after every change of the backend and fix what
  the compiler reports; do not edit the generated files and do not declare resource types
  by hand.
- **Use the protocol packages, do not reimplement them.** Requests, filters, errors,
  pagination, authentication and permission checks go through `@bazis/client`.
- **The backend decides the permissions.** Do not encode roles or permission rules in the
  frontend. Hide or disable controls from what the backend reports: the permission meta
  and the runtime schema `schema_update` of the item.
- **Copy the visual layer, own it.** Components and screens are part of the product and may
  be changed freely; protocol code is updated only through package versions.

## Protocol facts that are easy to get wrong

- The list filter is one `filter` expression (`price__gte=10&(state=new|state=draft)`),
  not `filter[name]=value`.
- `include` works on retrieve, create and update; list ignores it.
- Pagination is `page[limit]` and `page[offset]`; sorting is `sort` with `-` for
  descending; meta fields such as `pagination` are returned only when requested with
  `meta`.
- Validation errors are 422 with `errors[].source.pointer` such as `/attributes/name`.
