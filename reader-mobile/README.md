# Pale Blue Dot Reader

A simple, read-only mobile reader for Pale Blue Dot markdown files hosted on GitHub.

## Features

- 📱 **Android Native App** - Built with React Native (Expo)
- 🔄 **GitHub Integration** - Download and sync markdown files from any GitHub repository
- 🔐 **Private Repository Support** - Access private repos with GitHub Personal Access Token
- 📖 **Read-Only Viewer** - Clean, distraction-free reading experience
- 🖼️ **Image Support** - Automatically downloads and displays images from `.images/` directory
- 🏷️ **Tag & Column Support** - Organizes pages by kanban columns
- 💾 **Offline Mode** - Cached data available offline after initial download
- 🔒 **Secure Token Storage** - Tokens stored securely with expo-secure-store

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app (for testing on device)

### Installation

```bash
cd reader-mobile
npm install
```

### Development

```bash
# Start Expo development server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios
```

### Building for Production

```bash
# Build Android APK
npx eas build --platform android --profile preview

# Build for Google Play Store
npx eas build --platform android --profile production
```

## Usage

### For Public Repositories

1. **Enter GitHub Repository URL**
   - Format: `https://github.com/owner/repo`
   - Or: `owner/repo`

2. **Download Data**
   - Tap "Download" button to sync markdown files and images
   - Progress indicator shows download status

3. **Browse Columns**
   - View all kanban columns from your repository
   - Tap a column to see its pages

4. **Read Pages**
   - Tap a page to view its content
   - Markdown is rendered with proper formatting
   - Images are displayed inline

### For Private Repositories

1. **Create GitHub Personal Access Token**

   **Option A: Fine-grained token (Recommended)**
   - Go to https://github.com/settings/personal-access-tokens/new
   - Give it a name (e.g., "Pale Blue Dot Reader")
   - Set expiration (or "No expiration")
   - Under "Repository access", select "Only select repositories"
   - Choose your private repository
   - Under "Repository permissions", set:
     - **Contents**: Read-only
     - **Metadata**: Read-only (auto-selected)
   - Click "Generate token"
   - Copy the token (starts with `github_pat_`)

   **Option B: Classic token**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "Pale Blue Dot Reader")
   - Select scope: **repo** (Full control of private repositories)
   - Click "Generate token"
   - Copy the token (starts with `ghp_`)

2. **Add Token to App**
   - Tap the "🔑 Add Token" button in the app
   - Paste your GitHub Personal Access Token
   - Tap "Save Token"
   - Token is stored securely on your device

3. **Access Private Repository**
   - Enter your private repository URL
   - Tap "Download"
   - The app will use your token to access the repository

4. **Manage Token**
   - Tap "🔑 Token Set" to view token settings
   - You can delete the token anytime
   - Token remains on device until deleted

## File Format Support

The reader supports the same markdown format as Pale Blue Dot:

### Repository Structure

The app supports two repository structures:

**Option 1: Root-level files (simple)**
```
repo/
├── .images/
│   └── image.png
├── Page1.md
└── Page2.md
```

**Option 2: Workspace folder (Pale Blue Dot default)**
```
repo/
└── workspace/
    ├── .images/
    │   └── image.png
    ├── Page1.md
    └── Page2.md
```

The app automatically detects which structure you're using.

### Markdown Format

```yaml
---
id: "uuid"
title: "Page Title"
parentId: "parent-id"
kanbanColumn: "To Do"
tags: ["tag1", "tag2"]
dueDate: "2026-03-01"
createdAt: "2026-02-21T10:00Z"
updatedAt: "2026-02-21T15:30Z"
---

# Page Content

Your markdown content here...

Images: ![alt](.images/filename.png)
```

## Architecture

```
reader-mobile/
├── app/                    # Expo Router screens
│   ├── index.tsx          # Home: Columns list
│   ├── column/[name].tsx  # Pages in column
│   └── page/[id].tsx      # Page viewer
├── components/
│   └── MarkdownRenderer.tsx
├── services/
│   ├── githubService.ts   # GitHub API integration
│   ├── parserService.ts   # Markdown/YAML parsing
│   ├── cacheService.ts    # Local file storage
│   └── tokenService.ts    # Secure token management
└── types/
    └── index.ts           # TypeScript definitions
```

## Limitations

- **Read-only**: No editing capabilities
- **GitHub-only**: Must host files on GitHub
- **No real-time sync**: Manual refresh required
- **Token required for private repos**: Personal Access Token needed for private repositories

## Troubleshooting

### Repository Not Found

- **Public repos**: Check the URL format is correct
- **Private repos**: Ensure you've added a GitHub Personal Access Token with `repo` permissions
- Verify the repository contains `.md` files in the root
- Check that the token hasn't expired (tokens can expire after 30-90 days)

### Images Not Loading

- Ensure images are in `.images/` directory
- Check image filenames match markdown references
- Verify repository has proper permissions

### App Crashes on Sync

- Check your internet connection
- Ensure repository is not too large (>100 files may be slow)
- Clear cache and try again

## Future Enhancements

- [ ] Private repository support (GitHub token)
- [ ] Search functionality
- [ ] Tag filtering
- [ ] Dark/light theme toggle
- [ ] Export to PDF
- [ ] Share pages
- [ ] Bookmarks/favorites

## License

Same as Pale Blue Dot parent project.
