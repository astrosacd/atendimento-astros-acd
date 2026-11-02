# Project conventions

- Shared number-cache loading uses ordered, exhaustive API ranges through `fetchAllPages`; all consumers receive the complete dataset or an error, never silently truncated results.