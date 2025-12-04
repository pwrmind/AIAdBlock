# 🧠 AI Ad Blocker - Smart Browser Extension

## 🤔 What's This?

Meet **AI Ad Blocker** - your smart browsing buddy that learns what you hate (ads, trackers, pop-ups) and blocks them automatically! 🚫

Unlike boring old ad blockers with their static lists, this extension actually **learns from YOU** and gets smarter over time. It's like having a mini-brain in your browser! 🧠

## ✨ Cool Features

- **🤖 Machine Learning Magic**: Uses brain.js to predict what to block
- **👨‍🏫 Learns From You**: Every time you click "Block" or "Allow", it gets smarter
- **⚡ Auto-Rule Creation**: Creates real browser blocking rules for stuff you hate
- **🔒 Privacy First**: Everything happens locally in YOUR browser - no data sharing!

## 🛠️ How It Works (In Simple Terms)

1. **You browse the web** 🌐
2. **You see something annoying** 😠
3. **You click our extension icon** 🖱️
4. **You choose "Block" or "Allow"** ✅ ❌
5. **The AI learns your preference** 🧠
6. **Next time, it blocks similar junk automatically** 🎯

## 📁 What's Inside?

| File | What It Does | 
|------|--------------|
| `manifest.json` | Extension ID card (tells Chrome who we are) |
| `background.js` | The brain 🧠 + rule maker |
| `featureExtractor.js` | URL detective 🔍 (finds suspicious stuff) |
| `popup.js` | Handles your clicks 👆 |
| `popup.html` | The pretty buttons you see 🎨 |

## 🚀 Quick Start Guide

### For Users:
1. **Download/install the extension** 📥
2. **See an ad?** Click our icon! 🖱️
3. **Hit "Block"** ❌
4. **Repeat until happy** 😎
5. **Enjoy cleaner browsing** 🎉

### For Developers:
```bash
# 1. Get the code
git clone [your-repo-url]

# 2. Add missing files (we need these!):
#    - brain-browser.min.js (get from brain.js)
#    - popup.html (UI interface)
#    - icon.png (cute icon)

# 3. Open Chrome & go to:
chrome://extensions/

# 4. Turn on "Developer mode" 👨‍💻

# 5. Click "Load unpacked" 📂

# 6. Select the folder & voila! 🎊
```

## 🔧 Tech Stuff (For Nerds 🤓)

### The AI Part:
- **Library**: brain.js (neural networks in JavaScript!)
- **Training**: Happens in YOUR browser
- **Storage**: Saves what it learns in Chrome storage
- **Features it checks**:
  - 🤔 Is this a third-party request?
  - 🔍 Contains ad/tracker keywords?
  - 🖼️ Is it a script/image?
  - 📏 How deep is the URL path?

### The Blocking Part:
- Creates real Chrome blocking rules
- Rules survive browser restarts
- Each rule gets a unique ID

## 📋 What We Need Permission For (And Why)

| Permission | Why We Need It |
|------------|----------------|
| `declarativeNetRequest` | To actually block stuff 🛑 |
| `storage` | To save your preferences 💾 |
| `activeTab` | To see what page you're on 👀 |
| `<all_urls>` | To work everywhere 🌍 |

## ⚠️ Heads Up!

**This is a learning project!** 🎓
- Might not block EVERYTHING (yet!)
- Needs your feedback to get smarter
- Probably not as good as uBlock Origin... but it LEARNS! 🤖

## 🚧 Coming Soon (Maybe!)

- [ ] Auto-detection (no clicking needed!)
- [ ] "Undo" button for mistakes ↩️
- [ ] Export your trained brain 🧠➡️📤
- [ ] Cool stats dashboard 📊
- [ ] Dark mode 🌙 (because everything needs dark mode)

## 🎯 Why This Exists

1. **To learn about ML in browsers** 📚
2. **To make ad-blocking personalized** 👤
3. **Because building things is fun!** 🛠️

## 👏 Credits

- Made with ❤️ and JavaScript
- Uses [brain.js](https://brain.js.org/) for the AI magic
- Works on Chrome/Edge (Manifest V3)

## 📄 License

MIT - Do whatever you want with it! Just don't be evil. 😇

---

**P.S.** Found a bug? Have an idea? Feel free to contribute or fork! This is a work in progress and we love suggestions! 💡

**Happy (ad-free) browsing!** 🎉