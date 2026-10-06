# bazis-front

The frontend layer of [Bazis](https://github.com/ecofuture-tech/bazis), the JSON:API
framework on Django + FastAPI + Pydantic. A product built on Bazis gets a React +
TypeScript + Vite frontend whose contract is generated from its own backend and whose
protocol code comes from versioned npm packages.

**Status: pre-release.** Nothing is published to npm yet; the API may change.

## Packages

| Package | What it is |
|---|---|
| `@bazis/client` | The JSON:API protocol of Bazis, typed by the OpenAPI types generated from a project |
| `@bazis/react` | React hooks over `@bazis/client` (planned) |

Protocol code is versioned and updated through these packages, so that fixes reach every
product. Visual components and screens are copied into a project and owned by it.

The layers and the principles are described in [docs/architecture.md](docs/architecture.md).
AI agents building a product read [AGENTS.md](AGENTS.md).

## License

Apache License 2.0, see [LICENSE](LICENSE).
