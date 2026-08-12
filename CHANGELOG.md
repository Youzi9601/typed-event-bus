# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure and configuration
- Core type definitions (EventDefinition, EventNamespace)
- defineEvent, defineEvents API
- createEventBus with registry merging
- emit / emitAsync (sync/async emission)
- on / once / onAll (subscription APIs)
- Subscription lifecycle (unsubscribe, signal)
- Error handling (onError hook, AggregateError)
- Middleware support (bus.use)
- Comprehensive type tests (vitest expectTypeOf)
- Runtime tests (vitest)
- CI/CD pipeline (GitHub Actions)
- Benchmark infrastructure

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.1.0] - TBD 2026/08/11

### Added
- First public release

---

## Template for future releases

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements