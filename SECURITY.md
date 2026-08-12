# Security Policy

## Supported Versions

| Version | Support Status |
|---------|----------------|
| 1.x.x | ✅ Actively maintained, security updates |
| < 1.0.0 | ⚠️ Pre-release, no security backport guarantees |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities in public Issues.**

Report privately through the following channels:

- **Email**: see @Youzi9601 on GitHub for contact information
- **GitHub Security Advisories**: [Report privately](https://github.com/Youzi9601/typed-event-bus/security/advisories/new)

### Report Content

1. Vulnerability type and description
2. Affected versions
3. Reproduction steps or PoC
4. Potential impact assessment
5. Suggested fix direction (if any)

## Response Timeline

| Phase | Target Time |
|-------|-------------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix release | Severity-based: Critical 30 days / High 60 days / Medium 90 days / Low next release |
| Public disclosure | 14 days after fix release (coordinated CVE assignment) |

## Security Best Practices (Users)

### Event Definitions and Payloads

- **Do not** put sensitive data (passwords, tokens, PII) in event payloads
- Use the type system to enforce payload structure, preventing accidental leaks
- For cross-process transport (Electron, Worker), ensure transport-layer encryption

### Dependency Management

```bash
# Periodic audit
pnpm audit

# Update dependencies
pnpm update --latest
```

### Event Bus Configuration

- Enable `onError` in production to log exceptions
- Avoid running time-consuming sync operations in listeners (blocks event loop)
- Use `emitAsync` for async listeners, handle `MultiError` properly

## Known Security Considerations

### Prototype Pollution

This package **does not** use `Object.assign`, `_.merge`, or any operations that could cause prototype pollution. Event names are referenced via `EventDefinition` objects, not string-based path access.

### Denial of Service

- No built-in rate limiting; massive event emission may block the event loop
- Implement backpressure mechanisms at the application layer
- `maxListeners` warning (planned for P1) helps detect abnormal subscriptions

### Cross-Process Transport

When using `@typed-event-bus/adapter-*` adapters:
- Electron: enable `contextBridge` isolation
- Worker: validate `origin` and `data` structure
- WebSocket: use WSS, validate connection identity

## Security Update Notifications

- Major security updates will be published on [GitHub Releases](https://github.com/Youzi9601/typed-event-bus/releases)
- Subscribe to repository "Watch" → "Custom" → "Security advisories" for notifications
- Projects depending on this package are recommended to enable Dependabot

## Acknowledgments

Thanks to all researchers and users who responsibly disclose security issues.

---

*This policy references the [GitHub Security Policy](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository) best practices.*