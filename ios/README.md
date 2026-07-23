# Archon iOS Companion App

This directory contains the native iOS companion application for Archon, built with SwiftUI, async/await, and the Supabase Swift SDK.

## Prerequisites

- macOS with Xcode 15 or later
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Build Instructions

To ensure a clean, reproducible, and git-conflict-free environment, this project uses **XcodeGen** to generate the `.xcodeproj` file declaratively from `project.yml`. Do not manually commit changes to `Archon.xcodeproj`.

### 1. Set up your environment config

This app requires a Supabase Anon Key to communicate with the backend. 
Secrets are excluded from git. You must create a local `.xcconfig` file before generating the project.

```bash
# From the ios/ directory:
cp Config.example.xcconfig Config.xcconfig
```
Open `Config.xcconfig` and replace `YOUR_ANON_KEY_HERE` with the actual Supabase Anon Key.

### 2. Generate the Xcode Project

Generate the `.xcodeproj` using XcodeGen:

```bash
# From the ios/ directory:
xcodegen generate
```

### 3. Build and Run

1. Open `Archon.xcodeproj` in Xcode.
2. Select your desired Simulator target (iPhone 15 Pro, iOS 17+ recommended).
3. Hit **Play** (Cmd+R).

## Architecture Notes

- **Auth**: Uses `supabase-swift` for official OAuth handling via `ASWebAuthenticationSession`. Tokens are stored securely using a custom `KeychainSessionStore` scoped to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- **UI**: SwiftUI first. Supports `DynamicTypeSize` and VoiceOver accessibility out of the box.
- **Branch Hygiene**: All native code lives strictly inside this `ios/` folder to prevent pollution or deletion of the web IDE monorepo structure.
