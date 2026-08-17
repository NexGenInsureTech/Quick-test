# Application Core

## Objective

The Application Core is the operating system of Banc360.

It is responsible for:

- Bootstrapping the application
- Loading configuration
- Initializing themes
- Registering modules
- Managing navigation
- Managing workspaces
- Publishing events
- Providing shared services

Business logic must never exist inside the Application Core.

The Application Core should remain generic and reusable.
