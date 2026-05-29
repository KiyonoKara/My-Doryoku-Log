# My Doryoku Log

App made for logging finances and timed tasks. My Doryoku Log also means close to My Effort Log.

## Usage

### General Features
- Changing themes

### Finance Page Features
- Enter transactions with date, amount, category, and description
- Edit any field of the transaction
- Delete (or bulk delete) transactions
- View and search history of all income and expense transactions
- View a bar chart of income and expense categories
- Get predictions of future income and expense amounts if there are at least 10 transactions with refresh
- Change currency indicator
- Import/export transactions to a CSV file

### Time Page Features
- Start and stop a timer for any named task with an assigned category
- Timer can be paused and resumed
- View and search history of all tasks with their recorded time and dates
- Import/export tasks to a CSV file

## Running the project locally
1. Clone the repository
2. Install dependencies
3. Run `npm rebuild` (maybe required for some dependencies such as better-sqlite3)
4. Run the project in dev mode or preview from build

### Running the project in Dev Mode

Install dependencies with `npm install` (or `pnpm install` or `yarn`), then start a development server. Using `pnpm` is highly recommended.

```sh
npm run dev
# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of the app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

### Packaging as Electron App
Run the packaging script that corresponds to your OS and architecture: `npm run <packaging-script-name>`
The packaging scripts are defined in the `package.json` file:
- `pack:mac:x64:zip` for macOS x64
- `pack:mac:arm64:zip` for macOS arm64
- `pack:mac:x64:dmg` for macOS x64 with `dmg-builder` (requires Homebrew dependencies)
- `pack:mac:arm64:dmg` for macOS arm64 with `dmg-builder` (requires Homebrew dependencies)
- `pack:win:x64` for Windows x64
- `pack:linux:x64` for Linux x64

## Granting Permissions
macOS requires the app to be signed. However, this app doesn't come signed. The code is open-source, so you can take a look at it to verify the integrity of the app. To let the app run on macOS, you must run this command:

```sh
xattr -c '/Applications/My Doryoku Log.app'
```

## Resources Used and Acknowledgements

- Vector Icons: https://tablericons.com/
- App icon was created by the developer of this project
- App design and layout, especially the depth, were designed by the developer of this project