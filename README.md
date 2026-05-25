# Steam Rating

A Millennium plugin that adds personal ratings and completion markers directly to the Steam Library grid.

## Features

- Rate games from 0.5 to 5 stars in half-star steps.
- Mark games as completed with a small white circular check.
- Track repeated completions: click the check again to show `2x`, `3x`, and so on.
- Works with Steam games, non-Steam games, custom covers, and SteamGridDB/custom library assets when Steam exposes an app id in the cover URL.
- Saves all data locally in Steam's UI `localStorage`.

## Usage

- Click the left half of a star for a half-star rating.
- Click the right half of a star for a full-star rating.
- Click the same rating again to clear it.
- Click the completion check to cycle from unchecked to completed, then `2x`, `3x`, up to `9x`, and back to unchecked.

## Storage

Ratings are stored with keys like `steam-rating:v2:<appid>`.

Completion counts are stored with keys like `steam-rating:completed:v1:<appid>`.

## Development

```bash
npm install
npm run build
```

## Requirements

- Millennium for Steam
- Desktop Steam client

## License

MIT
