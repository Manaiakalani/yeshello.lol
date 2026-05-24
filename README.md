<div align="center">

# 👋 YesHello.lol

**The Gen Z Communication Power Move**

[![Lint](https://github.com/Manaiakalani/yeshello.lol/actions/workflows/lint.yml/badge.svg)](https://github.com/Manaiakalani/yeshello.lol/actions/workflows/lint.yml)
[![Playwright Tests](https://github.com/Manaiakalani/yeshello.lol/actions/workflows/playwright.yml/badge.svg)](https://github.com/Manaiakalani/yeshello.lol/actions/workflows/playwright.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Azure Static Web Apps](https://img.shields.io/badge/Hosted%20on-Azure%20Static%20Web%20Apps-0078D4?logo=microsoftazure)](https://yeshello.lol)

🌐 **[yeshello.lol](https://yeshello.lol)**

</div>

---

A humorous website that explores the *"Yes Hello"* communication style popular among Gen Z - where starting a conversation with just "Hello" and making people wait is a playful power move in digital communication.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Conversation Examples** | Interactive scroll-triggered typing animations showing good vs. bad hellos |
| 📖 **Slang Glossary** | Comprehensive Gen Z dictionary hidden behind the 👀 emoji |
| 🌙 **Dark Mode** | Automatic OS preference detection with manual toggle |
| ♿ **Accessibility** | Keyboard navigation, reduced motion, focus trapping, ARIA labels |
| 📱 **Responsive** | Mobile-first design that works across all screen sizes |
| 🔗 **Social Sharing** | Share via X, native Web Share API, or copy link |
| 🖼️ **Optimized Images** | WebP with PNG/JPG fallbacks for broad compatibility |
| 📲 **PWA-Ready** | Installable as a progressive web app via manifest |

## 🛠️ Tech Stack

- **HTML5** - Semantic markup with structured data (JSON-LD)
- **CSS3** - Custom properties, dark theme, modern animations
- **Vanilla JavaScript** - Zero dependencies
- **Azure Static Web Apps** - Hosting with security headers (CSP, HSTS)

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/Manaiakalani/yeshello.lol.git
cd yeshello.lol

# Open in your browser
open index.html   # macOS
start index.html  # Windows
```

Then:
1. Click the **👀** emoji to reveal the Gen Z slang glossary
2. Scroll through the conversation examples
3. Try toggling dark mode

## 🧑‍💻 Development

| File | Purpose |
|------|---------|
| `index.html` | Page content and structure |
| `style.css` | All styling and themes |
| `script.js` | Interactive functionality |
| `staticwebapp.config.json` | Headers, caching, and routing |
| `404.html` | Custom 404 error page |

## 🧪 Testing

This project uses [Playwright](https://playwright.dev/) for end-to-end testing against the live site.

```bash
# Install dependencies
npm install

# Install browsers
npx playwright install --with-deps

# Run tests
npx playwright test

# Run tests with UI
npx playwright test --ui
```

## 🔄 CI/CD

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Lint** | PRs to `main` | HTMLHint, Stylelint, and ESLint checks |
| **Playwright** | Push & PRs to `main` | End-to-end tests with report artifacts |
| **Deploy** | Push to `main` | Auto-deploy via Azure Static Web Apps |

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to your branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

## 👤 Creator

Created by **[Manaiakalani](https://github.com/Manaiakalani)** © 2025

## Contributors

<a href="https://github.com/Manaiakalani/yeshello.lol/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Manaiakalani/yeshello.lol" alt="Contributors" />
</a>
