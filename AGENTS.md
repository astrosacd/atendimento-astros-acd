# Project conventions

- Shared number-cache loading uses ordered, exhaustive API ranges through `fetchAllPages`; all consumers receive the complete dataset or an error, never silently truncated results.
- Manual number forms use the shared protected-field predicate and payload sanitizer; automatic metadata must never be sent back from stale form state.