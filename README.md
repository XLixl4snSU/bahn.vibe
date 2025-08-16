# 🚂 sparpreis.guru

**Find the cheapest train tickets for every day of the month**

bahn.vibe is a Next.js application that helps you find the best train prices on Deutsche Bahn by searching multiple days at once. Originally converted from [bahn.sensei](https://github.com/hackgrid/bahn.sensei/) PHP project, it provides a clean, modern interface for comparing train prices across different dates.

<img width="927" height="758" alt="Screenshot 2025-07-26 at 19 55 47" src="https://github.com/user-attachments/assets/668cc691-48e3-4527-b07d-c4cab34a3bbf" />
<img width="904" height="768" alt="Screenshot 2025-07-26 at 19 56 02" src="https://github.com/user-attachments/assets/e9cef8c1-75fa-444b-a782-77e2b069df21" />
<img width="925" height="747" alt="Screenshot 2025-07-26 at 19 56 11" src="https://github.com/user-attachments/assets/21019e07-14ec-47de-a205-65cba53996d0" />

## ✨ Features

- 🔍 **Multi-day Price Search**: Search 1-30 consecutive days for the best prices
- 💰 **Price Comparison**: Visual highlighting of cheapest and most expensive days
- 🎯 **Direct Booking Links**: One-click booking to Deutsche Bahn with pre-filled details
- ⚡ **Fast Results**: Configurable search duration (3 days default for quick results)
- 📱 **Responsive Design**: Works perfectly on desktop and mobile
- 🎨 **Modern UI**: Clean interface built with shadcn/ui components
- 🔄 **Station Search**: Auto-complete station names with fuzzy matching
- 📊 **Price Analytics**: Shows min, max, and average prices across searched days

## 🚀 Quick Start

### Prerequisites

- Node.js
- pnpm or yarn

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/jschae23/bahn.vibe.git
   cd bahn.vibe
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   pnpm install
   \`\`\`

3. **Run the development server**
   \`\`\`bash
   pnpm run dev
   \`\`\`

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

### Basic Search

1. **Enter Stations**: Type start and destination stations (e.g., "München", "Berlin")
2. **Select Date**: Choose your travel start date
3. 
4. **Configure Options**: Select class, max transfers, and preferences
5. **Search**: Click "Bestpreise suchen" to find the best prices
6. **Book**: Click "Buchen →" on any result to book directly on bahn.de

### Advanced Options

- **Class Selection**: Choose between 1st and 2nd class
- **Fast Connections**: Prioritize speed over price
- **Deutschland-Ticket**: Search only Deutschland-Ticket compatible routes
- **Max Transfers**: Limit the number of connections (0-5)
- **Day Limit**: Search 1-30 consecutive days

## 🛠️ Technical Details

### Architecture

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **API**: Deutsche Bahn REST API integration
- **Deployment**: Vercel-ready - enter a valid NEXT_PUBLIC_BASE_URL as an Environment Variable

### Key Components

\`\`\`
├── app/
│   ├── api/search-prices/     # Main price search API
│   ├── api/search-station/    # Station lookup API
│   ├── api/test-minimal/      # Debug endpoint
│   └── page.tsx               # Main application page
├── components/
│   ├── train-search-form.tsx  # Search form component
│   ├── train-results.tsx      # Results display
│   └── ui/                    # shadcn/ui components
└── lib/
    └── train-api.ts           # API client functions
\`\`\`

### API Integration

The application integrates with Deutsche Bahn's internal APIs:

- **Station Search**: `https://www.bahn.de/web/api/reiseloesung/orte`
- **Price Search**: `https://www.bahn.de/web/api/angebote/tagesbestpreis`

## 🔧 Configuration

### Environment Variables

No environment variables are required for local deployment. The app works out of the box.

### Customization

- **Day Limits**: Modify the max day limit in `components/train-search-form.tsx`
- **Styling**: Customize colors and themes in `tailwind.config.ts`
- **API Timeouts**: Adjust delays in `app/api/search-prices/route.ts`

## 📊 Performance

### Search Times

- **1 day**: ~2-3 seconds
- **7 days**: ~14-21 seconds
- **30 days**: ~60-90 seconds

### Rate Limiting

The application includes built-in rate limiting (1 second delay between requests) to respect Deutsche Bahn's API limits.

## 🐛 Debugging

### Debug Mode

Access the debug page at `/debug` to:
- Test API connectivity
- Validate station searches
- Inspect request/response data
- Troubleshoot 422 errors

### Common Issues

1. **Station Not Found**: Try major city names like "München", "Berlin", "Hamburg"
2. **422 Errors**: Use the debug page to inspect API requests
3. **No Prices Found**: Try different dates or reduce transfer limits

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**: Import your GitHub repository to Vercel
2. **Deploy**: Vercel will automatically detect Next.js and deploy
3. **Custom Domain**: Configure your custom domain in Vercel settings

### Other Platforms

The application works on any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- Self-hosted with Docker

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing component structure
- Add proper error handling
- Include JSDoc comments for complex functions

## 📝 License

This project is licensed under the GNU General Public License v3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Deutsche Bahn**: For providing the underlying train data
- **shadcn/ui**: For the beautiful UI components
- **Next.js Team**: For the excellent framework
- **Original PHP Version**: This project was converted from a PHP implementation of [hackgrid](https://github.com/hackgrid/)

---

**Vibed with [v0](https://v0.dev) for German train travelers**

