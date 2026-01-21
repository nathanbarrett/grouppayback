# GroupPayback

A simple, elegant bill splitting app. No accounts, no sign-ups, no backend — just split bills and share a link.

**Live at [grouppayback.com](https://grouppayback.com)**

## Features

- **No backend required** — All data is stored in the URL. Share the link to share your split.
- **Real-time calculations** — Settlements update automatically as you type (with debounce).
- **Multi-currency support** — Choose from 10 popular currency symbols.
- **Mobile-friendly** — Responsive design works on any device.
- **Privacy-first** — Your data never touches a server. It lives entirely in your browser and URL.

## How It Works

1. Add people and their expenses
2. The app calculates each person's fair share
3. Settlements are generated showing who owes whom
4. Copy the link to share with your group

### The Algorithm

1. **Calculate fair share**: Total all expenses and divide by number of people
2. **Calculate balances**: For each person: `balance = what they paid - fair share`
3. **Match payments**: Pair up people who owe money with people who are owed, minimizing the number of transactions

## Tech Stack

- [Vue 3](https://vuejs.org/) with Composition API
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS v4](https://tailwindcss.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/) for hosting

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deployed to Cloudflare Pages:

```bash
# First time: authenticate with Cloudflare
wrangler login

# Deploy (builds and deploys)
npm run deploy

# Deploy to production
npm run deploy:prod
```

## License

MIT
