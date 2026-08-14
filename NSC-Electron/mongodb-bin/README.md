# MongoDB Binary Directory

This directory should contain the standalone `mongod.exe` binary from MongoDB Community Server.

## Setup Instructions

1. Download MongoDB Community Server 8.0 for Windows x64 from:
   https://www.mongodb.com/try/download/community

2. Choose "ZIP" package (not MSI installer)

3. Extract only the `mongod.exe` binary from `bin/mongod.exe` into this directory:
   ```
   NSC-Electron/mongodb-bin/mongod.exe
   ```

4. The file is ~30MB and will be bundled into the Electron installer via `extraResources`.

## Why Bundle?

End-users should NOT need to install MongoDB separately. The Electron app manages
its own local MongoDB instance on port 27018 with a dedicated data directory in
the user's AppData folder.

## Note

This binary is NOT committed to Git (see .gitignore). Each developer must download
it manually, or it can be fetched automatically in CI/CD.
